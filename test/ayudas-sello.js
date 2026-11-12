// Ayudas de prueba de los encargos «verificado-regla» y «taproot» (#64 d, #67, H20): sellos de tiempo COMPLETOS sintéticos
// (la décupla del SIP 0 con el anclaje por Taproot: la hoja de compromiso OP_RETURN <raíz del lote> en el árbol Taproot de
// una salida P2TR de una transacción de anclaje hecha con la simulación de StateArk, servidor/sim/stateark/taproot.js; la
// cabecera de 80 bytes cuya raíz de Merkle es la de esa transacción, con prueba de trabajo de regtest, y la firma BIP-340
// de un observador de prueba),
// recibos de llegada firmados por un relé de prueba, y la declaración de las «observer keys» y la «seal url» en los
// ajustes del exterior de la cuenta raíz del eje. Las claves son de prueba, generadas en cada ejecución: nada real.

import { schnorr } from '../src/vendor/noble-secp256k1.js';
import { sha256, sha256d, hashEtiquetado, concatenar, deHex, aHex } from '../src/cripto.js';
import { generarClaves } from '../src/autoridad.js';
import { decuplaDeSello } from '../src/sello.js';
import { salida } from '../src/index.js';
import * as G from '../carta/guia.js';
import { arbol } from '../servidor/sim/stateark/merkle.js';
import { anclar } from '../servidor/sim/stateark/taproot.js';

/** La clave interna NUMS de BIP-341 (la de la simulación: nadie gasta por clave). */
export const NUMS = '50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0';

export const ETIQUETA_OBSERVADOR = 'StateArk/Observador/Cabecera/v1';
/** Los bits de regtest: el objetivo más fácil (la mitad de los hashes lo cumplen). */
const BITS = 0x207fffff;
const OBJETIVO = (() => { const o = new Uint8Array(32); o[0] = 0x7f; o[1] = 0xff; o[2] = 0xff; return o; })();

const le = (n, bytes) => Uint8Array.from({ length: bytes }, (_, k) => Number((BigInt(n) >> BigInt(8 * k)) & 0xffn));
const menor = (a, b) => { for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k] < b[k]; return false; };

/** Un observador de cabeceras de prueba: { privada, publica } (x-only, hex). */
export const observadorDePrueba = () => generarClaves();

/** Una cabecera de Bitcoin de 80 bytes con esa raíz de Merkle (orden interno) y prueba de trabajo de regtest. */
export function cabeceraCon(raiz, { instante = '2026-11-10T11:00:00.000Z', anterior = new Uint8Array(32) } = {}) {
  const hora = Math.floor(Date.parse(instante) / 1000);
  for (let nonce = 0; ; nonce++) {
    const c = concatenar(le(1, 4), anterior, raiz, le(hora, 4), le(BITS, 4), le(nonce, 4));
    if (menor(sha256d(c).slice().reverse(), OBJETIVO)) return c;
  }
}

/** Hex de 32 bytes derivado de un texto (ids, txids y raíces de relleno en las pruebas). */
const de = (texto) => aHex(sha256(new TextEncoder().encode(texto)));

/**
 * La raíz de Merkle «bitcoin» de unos txids (orden interno; doble SHA-256; el impar se duplica) y los pasos (los de la
 * simulación de StateArk: append o prepend del hermano y dos sha256 por nivel) del de la posición k a la raíz.
 */
function merkleBitcoin(txids, k) {
  let nivel = txids.map(deHex);
  const pasos = [];
  let i = k;
  while (nivel.length > 1) {
    if (nivel.length % 2) nivel = [...nivel, nivel[nivel.length - 1]];
    const hermano = i % 2 ? nivel[i - 1] : nivel[i + 1];
    pasos.push([i % 2 ? 'prepend' : 'append', aHex(hermano)], ['sha256'], ['sha256']);
    const siguiente = [];
    for (let a = 0; a < nivel.length; a += 2) siguiente.push(sha256d(concatenar(nivel[a], nivel[a + 1])));
    nivel = siguiente;
    i = Math.floor(i / 2);
  }
  return { raiz: nivel[0], pasos };
}

/**
 * El sello completo de `id` para eje.marcarSello: { altura, hash, instante, verificado: true, decupla } con la décupla del
 * SIP 0 (src/sello.js decuplaDeSello). El lote son `ids` (con `id`; por defecto, solo él); su raíz «sip» es una hoja de
 * compromiso del árbol Taproot de la salida 0 de una transacción de anclaje (con `otrosLotes` lotes más: hermanos
 * Taproot), de clave interna `interna` (NUMS por defecto); esa transacción, con `otrasTx` transacciones más en el bloque
 * (camino «bitcoin»), da la raíz de Merkle de la cabecera; y el observador firma cabecera ‖ altura LE. `cambiar(prueba)`
 * deja tocar la prueba antes de hacer la décupla (para las pruebas en negativo).
 */
export async function selloCompleto(id, { altura = 1, instante = '2026-11-10T11:00:00.000Z', observador, ids = [id], otrosLotes = 0, otrasTx = 0, interna = NUMS, cambiar } = {}) {
  const lista = [...new Set(ids)].sort();
  const { raiz, caminos } = await arbol(lista);
  const otras = Array.from({ length: otrosLotes }, (_, k) => de('otro lote ' + k + ' ' + raiz));
  const ancla = await anclar([raiz, ...otras], { interna, previa: de('previa ' + raiz) });
  const bloque = merkleBitcoin([ancla.txid, ...Array.from({ length: otrasTx }, (_, k) => de('otra tx ' + k))], 0);
  const cabecera = cabeceraCon(bloque.raiz, { instante });
  const alturaLe = le(altura, 4);
  const firma = schnorr.sign(hashEtiquetado(ETIQUETA_OBSERVADOR, concatenar(cabecera, alturaLe)), deHex(observador.privada), new Uint8Array(32));
  const prueba = {
    altura, hash: aHex(sha256d(cabecera)), instante, lote: raiz,
    prueba: {
      camino: caminos.get(id), via: 'taproot',
      taproot: { tx: ancla.tx, vout: 0, interna, hermanos: [...ancla.hermanos.get(raiz)] },
      pasos: bloque.pasos, cabecera: aHex(cabecera), observador: { clave: observador.publica, firma: aHex(firma), altura_le: aHex(alturaLe) },
    },
  };
  if (cambiar) cambiar(prueba);
  return { altura: prueba.altura, hash: prueba.hash, instante: prueba.instante, verificado: true, decupla: decuplaDeSello(prueba, id) };
}

/** Un relé de prueba: { privada, publica }. */
export const releDePrueba = () => generarClaves();

/**
 * Un recibo de llegada (X.6.8.1) para eje.marcarRecibo, firmado por el relé de prueba como en servidor/sim/aarpia: la
 * firma BIP-340 del relé sobre el id del recibo (aquí, un id de prueba derivado de `semilla`).
 */
export function reciboFirmado(rele, { instante = '2026-11-10T10:30:00.000Z', semilla = instante } = {}) {
  const recibo = aHex(sha256(new TextEncoder().encode('recibo de prueba ' + semilla)));
  return { instante, rele: rele.publica, firma: aHex(schnorr.sign(deHex(recibo), deHex(rele.privada), new Uint8Array(32))), recibo };
}

/**
 * La cuenta raíz del eje (el autor del génesis) declara en sus ajustes del exterior las «observer keys» y, si se da, la
 * «seal url» (con ella el eje tiene sello configurado: «sin verificar no se ejecuta»). `privada` es la de la raíz (en un
 * eje de demostración, ninguna).
 */
export async function declararExterior(eje, { observadores = [], sello, privada, t } = {}) {
  const raiz = eje.obtener(eje.genesisId).autor;
  const valores = { 'observer keys': observadores.join(' '), ...(sello ? { 'seal url': sello } : {}) };
  const a = G.ajustesEditablesDe('exterior settings', eje, raiz, valores);
  const cuando = t ?? new Date(eje.tMaximo() + 60_000).toISOString();
  return salida.escribirDesde(eje, { modo: 'sequenced', autor: raiz, sobre: a.sobre, en: a.en, payload: a.payload, t: cuando }, privada);
}
