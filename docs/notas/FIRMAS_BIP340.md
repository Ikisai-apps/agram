# Firmas Schnorr BIP-340 en lugar de ECDSA P-256

Nota de decisión · 11-11-2026 · Decisión de VG (11-11 noche; issue #27c). Lo implementa la rama `beta-schnorr`.

## 1. Qué se decidió

AGRAM firma con **Schnorr sobre secp256k1 según [BIP-340](https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki)**, como Nostr (NIP-01) y Taproot. Desaparece ECDSA P-256 por completo, **sin compatibilidad hacia atrás**: no hay verificación legada ni migración. VG borra las cuentas y el eje actuales y empieza de cero.

## 2. Por qué

- **El estándar de las firmas abiertas.** BIP-340 es lo que usan Bitcoin (Taproot) y Nostr: claves y firmas que otras herramientas leen y comprueban tal cual, sin envoltorios (JWK, DER, base64url).
- **Más simple de escribir y de comparar.** Una clave pública es un solo texto hexadecimal de 64 caracteres (la x del punto); una firma, uno de 128. Una sola escritura por valor: una clave se compara por igualdad de texto (la invitación que nombra una clave en su 3.5 la nombra entera).
- **Firma determinista con azar auxiliar** (`aux_rand`), como manda BIP-340: el nonce no depende solo del generador de azar.

## 3. Formato

| | |
|---|---|
| Clave pública | 32 bytes, **x-only**, hexadecimal en minúsculas (64 caracteres). Válida si la x es de un punto de la curva (`lift_x`). Va en `contexto.claves[identidad]` del alta (B4, el 5). |
| Clave privada | 32 bytes, `0 < d < n`, hexadecimal en minúsculas. Nunca entra en el eje. En el navegador se guarda tal cual (`agram.clave.<alta>`, `agram.claves`); en la copia de seguridad, cifrada con la frase como antes (PBKDF2 → AES-GCM). |
| Firma | 64 bytes, hexadecimal en minúsculas (128 caracteres), en `firma` y en `posesion[identidad]`. |
| Mensaje firmado | los **32 bytes del id** del evento: el SHA-256 del JSON canónico del cuerpo (`src/evento.js`, sin cambios). La firma sigue fuera del hash: firmar no cambia el id. |

Mayúsculas, prefijos (`02…`) u otros largos no valen. La API (`src/autoridad.js`, `docs/BTML.md` §7.3) mantiene sus nombres: `generarClaves`, `firmar`, `verificar`, `firmarPosesion`, `verificarPosesion`, `clavePublicaValida`, `huella`, `exportarPrivada`/`importarPrivada` (ahora comprueban y devuelven el mismo texto) y una nueva, `publicaDe(privada)`.

## 4. La librería

La regla «JavaScript puro sin dependencias» se mantiene con **una única excepción**: la curva secp256k1 y BIP-340, que Web Crypto no trae. VG pidió «la de Bitcoin Core o la de Nostr»; la de Bitcoin Core (libsecp256k1, C) exigiría WebAssembly, así que se toma **la de Nostr**: `nostr-tools` (la librería de referencia) firma con `schnorr` de **`@noble/curves`** (Paul Miller). nostr-tools 2.26.0 (07-11-2026) fija la 2.0.1; se vendoriza la **2.3.0** de la misma línea, la más reciente con auditoría (Trail of Bits, agosto de 2026, alcance completo), con `@noble/hashes` 2.3.0, empaquetadas en **un solo archivo ESM** sin dependencias, `src/vendor/noble-secp256k1.js`, que corre igual en Node ≥ 20, en el navegador y en Deno. Origen, versiones, auditorías, sha256 y cómo se actualiza: **`src/vendor/LEEME.md`**. La función de borde lleva una copia idéntica byte a byte (`servidor/supabase/funciones/eventos/noble-secp256k1.js`) porque se despliega sola. El azar (claves y `aux_rand`) sale de `crypto.getRandomValues`.

## 5. Qué cambia y qué no

- **Sin compatibilidad.** Una cuenta guardada con una privada P-256 (JWK) no se abre: la carta lo dice y ofrece borrarla. Una copia de seguridad de la versión 1 no se restaura: el archivo pasa a la **versión 2**. Las claves de las identidades de ejemplo se regeneran solas (y con ellas, el eje de ejemplo). Un eje guardado con eventos P-256 no se restaura (sus claves ya no son válidas).
- **Los ids no cambian de definición** y los ejemplos de los documentos dan la misma salida: las claves de los ejemplos salen del azar, así que sus ids nunca estuvieron impresos (`node docs/comprobar.mjs`: 57 de 57, solo cambió la salida de `docs/BTML.md` §7.3, que imprimía el tipo de clave).
- **Rendimiento.** Verificar en JavaScript es más lento que con Web Crypto: unos milisegundos por firma frente a menos de uno (medido en esta máquina, cargada: ≈6–8 ms verificar, ≈10 ms firmar, frente a ≈0,7 ms de ECDSA). La caché de claves importadas (`docs/notas/RENDIMIENTO.md` §8.4) desaparece: no hay nada que importar. Restaurar un eje grande tarda más en proporción.
- **El servidor** comprueba lo mismo que antes (forma, id, firma con la clave del alta), con BIP-340; `test/paridad-funcion.test.js` sigue comprobando que decide igual que el núcleo.

## 6. Pruebas

`test/autoridad.test.js`: los **19 vectores oficiales** de BIP-340 (`test/bip340-vectores.csv`, el `test-vectors.csv` del BIP) con la librería (clave pública, firma con su `aux_rand`, verificación) y los 15 de 32 bytes por `src/autoridad.js` (los inválidos, rechazados; las claves sin punto, no declarables); el formato (una sola escritura), las claves inválidas, la posesión, un eje real firmado, y el sha256 de las dos copias del archivo vendorizado.
