// Los vectores de rust-miniscript de Core StateArk, copiados como constante: InTheState/stateark/sim/test/vectores/miniscript.json
// del commit 0ddd6e7 de stateark-sim (el mismo contenido que en 7e1dae0; solo lectura allí). Su fuente, la de su campo
// «fuente»: rust-miniscript 12.3.7, programa ref-miniscript, 12-11-2026, con las claves públicas de los vectores 0 y 1 de
// BIP-340 y la clave interna NUMS de BIP-341. Los usan test/bqlm-cripto.test.js (tapleaf y taptweak) y las pruebas copiadas
// de la simulación (test/sim-stateark.test.js, taproot; test/sim-stateark-candado.test.js), en vez de leer el JSON de la
// máquina de Core StateArk.

export const NUMS = '50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0';

export const VECTORES_MINISCRIPT = Object.freeze({
  "fuente": "rust-miniscript 12.3.7 (crate offline del registro de cargo), programa de referencia ref-miniscript, 12-11-2026. Claves: las públicas de los vectores oficiales 0 y 1 de BIP-340. El compilador de políticas (compile_tr con clave interna NUMS) da el mismo descriptor que el fijado a mano.",
  "claves": {
    "cobra": "f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9",
    "reembolso": "dff1d77f2a671c5f36183726db2341be58feae1da2deced843240f7b502ba659"
  },
  "hash": "53ada8e6de01c26ff43040887ba7b22bddce19f8658fd1ba00716ed79d15cd5e",
  "vence": 800000,
  "hash160": "e5f4a8d4b1b4c1f0a6e2c3b4a5d6e7f8091a2b3c",
  "candado": {
    "politica": "or(and(pk(f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9),sha256(53ada8e6de01c26ff43040887ba7b22bddce19f8658fd1ba00716ed79d15cd5e)),and(pk(dff1d77f2a671c5f36183726db2341be58feae1da2deced843240f7b502ba659),after(800000)))",
    "descriptor": "tr(50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0,{and_v(v:pk(f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9),sha256(53ada8e6de01c26ff43040887ba7b22bddce19f8658fd1ba00716ed79d15cd5e)),and_v(v:pk(dff1d77f2a671c5f36183726db2341be58feae1da2deced843240f7b502ba659),after(800000))})",
    "hojas": [
      {
        "script": "20f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9ad82012088a82053ada8e6de01c26ff43040887ba7b22bddce19f8658fd1ba00716ed79d15cd5e87",
        "hoja": "610c3bb3ddccd47f975be55cc33fafe5b7840f953ac6bfde0b24be03c5b457ce"
      },
      {
        "script": "20dff1d77f2a671c5f36183726db2341be58feae1da2deced843240f7b502ba659ad0300350cb1",
        "hoja": "486c2838732af84245e815261f66fe421975ddc26756a248e6eeb55b7cffddf9"
      }
    ],
    "raiz": "9fc59d5459419e447bd4a9f6fe44490569e7a0ff78fca3f03fee2e84d7c57c9b",
    "clave_salida": "82987f1522fde699327e97d9f0164bd4fccd88808f8b62c746ab4c5919aac1eb",
    "scriptPubKey": "512082987f1522fde699327e97d9f0164bd4fccd88808f8b62c746ab4c5919aac1eb",
    "direccion_regtest": "bcrt1ps2v879fzlhnfjvn7jlvlq9jt6n7vmzyq379k936x4dx9jxd2c84s85r9ze"
  },
  "multi_a": {
    "miniscript": "multi_a(2,cobra,reembolso,NUMS)",
    "script": "20f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9ac20dff1d77f2a671c5f36183726db2341be58feae1da2deced843240f7b502ba659ba2050929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0ba529c"
  },
  "older": {
    "miniscript": "and_v(v:pk(cobra),older(144))",
    "script": "20f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9ad029000b2"
  },
  "hash160_frag": {
    "miniscript": "and_v(v:pk(cobra),hash160(…))",
    "script": "20f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9ad82012088a914e5f4a8d4b1b4c1f0a6e2c3b4a5d6e7f8091a2b3c87"
  }
});
