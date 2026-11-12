# `src/vendor/`: la única dependencia de AGRAM

AGRAM es JavaScript puro sin dependencias, con **una excepción** (VG, 11-11): la criptografía de curva elíptica para las firmas **Schnorr sobre secp256k1 según BIP-340**, que Web Crypto no trae. Por qué y con qué formato: `docs/notas/FIRMAS_BIP340.md`.

## `noble-secp256k1.js`

Un solo módulo ESM, sin dependencias ni `import`, que exporta `schnorr` (BIP-340: `getPublicKey`, `sign`, `verify`, `keygen`, `utils.randomSecretKey`, `utils.lift_x`, …). Funciona tal cual en Node ≥ 20, en el navegador (la web se sirve estática, sin empaquetador) y en Deno (la función de borde). El azar sale de `crypto.getRandomValues` (Web Crypto); el SHA-256 de BIP-340 (los hashes etiquetados) va dentro, de `@noble/hashes`.

| | |
|---|---|
| Origen | [`@noble/curves`](https://github.com/paulmillr/noble-curves) **2.3.0** (`secp256k1.js`: `schnorr`) y lo que usa de [`@noble/hashes`](https://github.com/paulmillr/noble-hashes) **2.3.0** (`sha256`, `hmac`, utilidades), de Paul Miller, publicados en npm el 06-08-2026 con procedencia firmada (*Trusted Publishing*) |
| Integridad npm | `@noble/curves@2.3.0` `sha512-v7cY+4oWYPQszRj6ZFGzTVL7uP2TaLo1xMhWHzYC5wj0ZhOXQ5x+sBre8rF3hi8cAoi0bh1qXoovoOkdFtvqEg==` · `@noble/hashes@2.3.0` `sha512-oN+QwyX7VSHotibwubG3kpzbwKrfnyR6OOO+3Nk/53ADL7FmgHHz4TgrbaYKvvOw09u6QTx0oiH1cNCIOuN0CQ==` |
| Empaquetado | con `esbuild` **0.28.2**, sin minificar (se puede leer y comparar con el original): `--bundle --format=esm --platform=neutral --target=es2022`, solo lo que alcanza `schnorr`. Un solo retoque a mano sobre el empaquetado (12-11-2026, #67): el bloque `export` final exporta también `sha256` (el de `@noble/hashes`, que ya iba dentro) para que `src/cripto.js` no lleve una copia propia; nada más cambia |
| Licencia | MIT (© 2022 Paul Miller), copiada entera en la cabecera del archivo |
| **sha256** | `75335671f06a2a71b38c663cda8938f5478037e953632e5a3dbe866841f04a64` |

`servidor/supabase/funciones/eventos/noble-secp256k1.js` es **el mismo archivo, byte a byte** (la función de borde se despliega sola, sin el núcleo). `test/autoridad.test.js` comprueba que los dos dan este sha256 y que este LEEME lo dice.

**Qué se usa del paquete** (encargo «taproot», 13-11-2026, H20): `src/autoridad.js` firma y verifica con `schnorr`; `src/cripto.js` (las primitivas puras del BQL mínimo) usa `sha256`, `schnorr.verify` y, para el TapTweak de BIP-341 (`taptweak`), la aritmética pública de la curva que `schnorr` ya exporta: `schnorr.utils.lift_x` y `schnorr.Point` (`BASE.multiplyUnsafe` de un ajuste público y `add`), sin secretos. Por eso el Taproot **no exporta nada de más**: el bloque `export` final sigue siendo `schnorr` y `sha256`, el archivo no cambia y su sha256 es el mismo (`test/seguridad-bqlm.test.js`, SEG-16, comprueba qué llama `src/cripto.js`).

### Por qué esta librería y esta versión

VG pidió «la de Bitcoin Core o la de Nostr». La de Bitcoin Core (libsecp256k1, en C) exigiría WebAssembly: descartada por ahora. Queda **la de Nostr**: la librería de referencia de Nostr, [`nostr-tools`](https://github.com/nbd-wtf/nostr-tools), firma y verifica los eventos (NIP-01) con `schnorr` de `@noble/curves/secp256k1.js` (`pure.ts`). En su versión **2.26.0** (npm, 07-11-2026; commit `2027d15a39b7605e28ca22f54509cb767fd13751` de `master`, 07-11-2026) fija `@noble/curves` **2.0.1** y `@noble/hashes` **2.0.1**, de septiembre de 2025.

Se toma la **2.3.0** de esa misma línea (2.x, la misma API) y no la 2.0.1, porque la 2.3.0 es **la más reciente auditada**: la 2.0.1 es anterior a la auditoría completa de agosto de 2026, y entre una y otra `schnorr.sign` dejó de rechazar (lanzando) un nonce `rand ≥ n` que BIP-340 manda reducir módulo n (en la 2.0.1, `schnorrGetExtPubKey(rand)`; probabilidad despreciable, pero era una desviación del estándar), y la verificación pasó a `mulAddUnsafe` y a rechazar `s = 0`. La 2.4.0, posterior, aún no tiene auditoría propia.

Auditorías, según la sección *Security* de los `README.md` publicados en npm (leídos el 11-11-2026):

- **`@noble/curves`**: **Trail of Bits**, versión **2.3.0**, agosto de 2026 (iniciativa «Patch the Planet», con OpenAI; alcance: todo; lo dice el README de la 2.4.0); **Cure53**, 1.6.0, septiembre de 2024 (ed25519/ed448, bls12-381, bn254, hash-to-curve y primitivas: no secp256k1); **Kudelski Security**, 1.2.0, septiembre de 2023 (`curve`, `modular`, `poseidon`, `weierstrass`); **Trail of Bits**, 0.7.3, febrero de 2023 (`curve`, `hash-to-curve`, `modular`, `poseidon`, `utils`, `weierstrass`, `_shortw_utils` y **`secp256k1`**). Además, autoauditorías asistidas por IA desde abril de 2026 (la de la 2.2.0, «self-audited», alcance: todo). Se prueba con vectores de Wycheproof, propiedades y pruebas cruzadas, y se fuzzea en CI. Los PDF están en la carpeta `audit/` de su repositorio y en las webs de los auditores; el de agosto de 2026 no se ha leído (no viene en el paquete): lo de arriba es lo que dicen los README.
- **`@noble/hashes`**: **Cure53**, 1.0.0, enero de 2022 (todo salvo blake3, sha3-addons, sha1 y argon2: sha256 y hmac, dentro).
- **`@noble/secp256k1`** (la hermana pequeña, descartada): su README dice que la versión actual (3.x) **no tiene auditoría independiente** y remite a `@noble/curves`.

Otros usuarios de peso de `@noble/curves` (sus dependencias en npm, 11-11-2026), además de nostr-tools: `@scure/btc-signer` 2.4.1 (Bitcoin, con Taproot/BIP-340) fija la 2.4.0; viem 2.57.18, la 1.9.1; ethers 6.17.0, la 1.2.0; `@metamask/key-tree` 10.1.1 (MetaMask), `^1.8.1`.

## Cómo se actualiza

Nunca a mano, y nunca con `npm install` en el proyecto: `package.json` no tiene dependencias de ejecución. En una carpeta **fuera del repositorio**:

```sh
mkdir noble-build && cd noble-build
echo '{ "name": "noble-build", "private": true, "type": "module" }' > package.json
npm install --save-exact @noble/curves@<versión> @noble/hashes@<la que pida curves> esbuild@<versión>
echo "export { schnorr } from '@noble/curves/secp256k1.js';" > entrada.js
```

y este `construir.mjs` (pone la licencia y las versiones en la cabecera):

```js
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
const salida = process.argv[2];
const v = (p) => JSON.parse(readFileSync(`node_modules/${p}/package.json`, 'utf8')).version;
const licencia = readFileSync('node_modules/@noble/curves/LICENSE', 'utf8').trim();
const cabecera = `/*!
 * Vendorizado para AGRAM: Schnorr BIP-340 sobre secp256k1.
 * @noble/curves ${v('@noble/curves')} + @noble/hashes ${v('@noble/hashes')} (Paul Miller), empaquetados
 * con esbuild ${v('esbuild')} en un solo ESM sin dependencias. No editar a mano:
 * src/vendor/LEEME.md dice de dónde sale, su sha256 y cómo se actualiza.
 *
${licencia.split('\n').map((l) => (' * ' + l).trimEnd()).join('\n')}
 */`;
await build({
  entryPoints: ['entrada.js'], bundle: true, format: 'esm', platform: 'neutral',
  target: 'es2022', legalComments: 'inline', treeShaking: true, minify: false,
  charset: 'utf8', banner: { js: cabecera }, outfile: salida, logLevel: 'warning',
});
```

`node construir.mjs <repo>/src/vendor/noble-secp256k1.js`, copiar el resultado a `servidor/supabase/funciones/eventos/noble-secp256k1.js`, y actualizar el sha256 aquí, en `test/autoridad.test.js` (`SHA256_VENDOR`) y la tabla de arriba (versiones, integridad, auditorías: leer la sección *Security* del `README.md` de cada paquete). Con las mismas versiones el resultado es el mismo byte a byte (con 2.3.0/2.3.0/0.28.2 sale el sha256 de arriba). Antes de aceptar una versión nueva: `node --test` entero (los vectores oficiales de BIP-340 están en `test/bip340-vectores.csv`) leer el cambio de `secp256k1.js` y `abstract/weierstrass.js` respecto a la versión anterior, y mirar qué versión fija `nostr-tools` en su `package.json`. Al publicar la carta, el service worker tiene que cambiar de versión para que los navegadores no mezclen un `src/autoridad.js` nuevo con uno viejo.
