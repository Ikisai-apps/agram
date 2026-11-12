// Ayudas de prueba del encargo «verificado-regla» (#64 d, #67): sellos de tiempo COMPLETOS sintéticos (la décupla del
// SIP 0 con cabecera de 80 bytes coherente, prueba de trabajo de regtest y la firma BIP-340 de un observador de prueba),
// recibos de llegada firmados por un relé de prueba, y la declaración de las «observer keys» y la «seal url» en los
// ajustes del exterior de la cuenta raíz del eje. Las claves son de prueba, generadas en cada ejecución: nada real.

import { schnorr } from '../src/vendor/noble-secp256k1.js';
import { sha256, sha256d, hashEtiquetado, concatenar, deHex, aHex } from '../src/cripto.js';
import { generarClaves } from '../src/autoridad.js';
import { decuplaDeSello } from '../src/sello.js';
import { salida } from '../src/index.js';
import * as G from '../carta/guia.js';
import { arbol } from '../servidor/sim/stateark/merkle.js';

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

/**
 * El sello completo de `id` para eje.marcarSello: { altura, hash, instante, verificado: true, decupla } con la décupla del
 * SIP 0 (src/sello.js decuplaDeSello). El lote son `ids` (con `id`; por defecto, solo él), su raíz «sip» va tal cual como
 * raíz de Merkle de la cabecera (sin pasos OTS) y el observador firma cabecera ‖ altura LE. `cambiar(prueba)` deja tocar
 * la prueba antes de hacer la décupla (para las pruebas en negativo).
 */
export async function selloCompleto(id, { altura = 1, instante = '2026-11-10T11:00:00.000Z', observador, ids = [id], cambiar } = {}) {
  const lista = [...new Set(ids)].sort();
  const { raiz, caminos } = await arbol(lista);
  const cabecera = cabeceraCon(deHex(raiz), { instante });
  const alturaLe = le(altura, 4);
  const firma = schnorr.sign(hashEtiquetado(ETIQUETA_OBSERVADOR, concatenar(cabecera, alturaLe)), deHex(observador.privada), new Uint8Array(32));
  const prueba = {
    altura, hash: aHex(sha256d(cabecera)), instante, lote: raiz,
    prueba: { camino: caminos.get(id), pasos: [], via: 'simulado', cabecera: aHex(cabecera), observador: { clave: observador.publica, firma: aHex(firma), altura_le: aHex(alturaLe) } },
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
