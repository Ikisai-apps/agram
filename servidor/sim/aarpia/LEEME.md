# AARPIA simulado (el transporte: relé Nostr, recibo de llegada, Blossom)

**Esto es una SIMULACIÓN.** Un relé Nostr y un Blossom en memoria, sin red ni persistencia. Se **sustituirá por AARPIA real** con la misma forma; quien lo usa (la carta, por las APIs de `eventos` y `archivos`) no cambia.

- **Origen:** copia del paquete `aarpia-transporte` de Core AARPIA (`C:/Users/acer/Documents/InTheState/aarpia/transporte`, git local), **commit 73bfc4d** (`src/`, `servidor.mjs` y este LEEME; el relé y el recibo llegaron en bc99eda, el Blossom y `/archivos` en b6c1a80). Sus pruebas (12) están en `test/sim-aarpia.test.js`, con las rutas adaptadas.
- **Un único cambio respecto al original:** no lleva `vendor/agram/` (copias de `eventos/api.js`, `eventos/verificar.js`, `eventos/noble-secp256k1.js` y `archivos/api.js`): `src/servicio.js`, `src/nostr.js` y `src/archivos.js` importan directamente `servidor/supabase/funciones/` de este repo (solo cambian esas rutas y los comentarios que las citan), así que la simulación habla SIEMPRE la API vigente de AGRAM, sin copia que se quede atrás. `test/vendor.test.js` desaparece con ellas.
- **Para la carta:** `node servidor/sim/aarpia/servidor.mjs` (http://127.0.0.1:8788/eventos y /archivos); `GET /eventos/recibo?eje=…&id=…` da `{ instante, rele, firma, recibo }`, el reloj X.6.8.1 (lo pide `src/sincronia.js`).
- **No editar aquí** salvo esos imports. Si algo hay que cambiar, se pide a Core AARPIA y se vuelve a copiar.

## Lo que dice el original


Sprint 1 de In the State, fijado por Core AGRAM: lo que AARPIA da a AGRAM según `state/COORDINACION/CONTRATO_AGRAM_EXTERIOR.md`, **fingido en memoria**, en JavaScript puro, sin dependencias (Node ≥ 22). Sustituye a las funciones de Supabase de AGRAM el día que VG lo diga, **sin que la carta cambie**: habla su misma API.

```sh
npm test                 # (aquí: node --test test/sim-aarpia.test.js, 12 pruebas, sin red)
node servidor.mjs        # (aquí: node servidor/sim/aarpia/servidor.mjs) http://127.0.0.1:8788/eventos y /archivos  (--puerto, --secreto)
```

Como módulo: `import { Rele, envolver, crearServicio, crearBlossom } from './src/index.js'`.

## Qué hay

| pieza | qué hace | contrato |
|---|---|---|
| `src/nostr.js` | eventos NIP-01: id, firma y verificación BIP-340 (la misma curva y la misma librería que AGRAM) | §1, §6 |
| `src/rele.js` | relé en memoria: acepta kinds 7700/7701, filtra por `ids`, `authors`, `kinds`, `#g #s #p #h #u…`, `since`, `until`, `limit`; suscripciones vivas con EOSE; **recibo de llegada 7701** firmado por el relé | §1, §2 |
| `src/sobre.js` | el sobre 7700 de un evento AGRAM: `g` id AGRAM, `s` sobre, `p` destinatarios (nombre → clave por el alta, sin el autor), `h` eje, `u` autor | §1 |
| `src/servicio.js` | la API de la función `eventos` (su `api.js`, copiado sin tocar) sobre el relé, más `GET /eventos/recibo?eje&id` → `{ instante, rele, firma, recibo }` (el reloj X.6.8.1) | §1, §2 |
| `src/blossom.js` | Blossom en memoria (BUD-01/02): `PUT /upload` con autorización 24242 firmada (t, x, expiración), `GET`/`HEAD`/`DELETE /<sha256>`; sirve con `CSP: sandbox`, `nosniff` y `attachment` para lo que no es imagen | §4 |
| `src/archivos.js` | la API de la función `archivos` (su `api.js`, sin tocar) sobre Blossom, **cifrando antes de subir** (AES-256-GCM, clave por eje): Blossom solo ve el cifrado; la carta sigue pidiendo `archivo:<sha256 del original>` | §4 |
| `servidor.mjs` | todo lo anterior por `node:http`; el Blossom también se ve en `/blossom/<sha256>` | |
| `vendor/agram/` | (en el original) copias de AGRAM; aquí no están: se importan las de `servidor/supabase/funciones/` |

## Qué cambia respecto a la función de Supabase (nada visible para la carta)

- `recibido` es el instante del **recibo 7701 firmado por el relé**, no la hora de Postgres.
- El sobre 7700 lo firma la **clave de transporte** del servicio, porque la carta, por HTTP, no manda su clave privada. Cuando la carta publique directamente en un relé, lo firmará el autor (acordado en el contrato §1); el módulo ya lo admite (`envolver({ privada })`).
- El orden es el de llegada al relé dentro del eje.

## Lo que no hace (todavía)

- Es memoria: al parar, se pierde. No hay relé real ni red Nostr.
- El cifrado lo hace el servicio (la carta no cambia); en el sistema real lo hará la carta, con una clave que no salga del eje. Las claves por eje y el índice viven en memoria.
- `GET` autenticado en Blossom: [X] decidir VG.
- Sellar los recibos en la cadena simulada de StateArk (§3, `stateark/sim`): acordado con Core StateArk, pendiente.
