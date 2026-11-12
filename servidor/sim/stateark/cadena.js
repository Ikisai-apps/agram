// Una cadena de bloques SIMULADA, con cabeceras con FORMA de Bitcoin, para que AGRAM las compruebe con
// `cabecera(b)` como comprobará las reales. No es Bitcoin: no hay red ni reorganizaciones, y la prueba de
// trabajo es la de regtest (bits 0x207fffff), que se cumple en un par de intentos.
//
// Cabecera (80 bytes, todo little-endian salvo los hashes, que van en orden interno):
//   versión (4) ‖ hash del bloque anterior (32) ‖ raíz de Merkle (32) ‖ hora Unix (4) ‖ bits (4) ‖ nonce (4)
// Hash del bloque = doble SHA-256 de la cabecera, en orden interno (al revés de como lo enseña un explorador).
// Raíz de Merkle = la de Bitcoin (doble SHA-256 de cada par; el impar se duplica) sobre los COMPROMISOS del
// bloque: las raíces de lote del §3 y los txid del §5. Sin compromisos, 32 bytes a cero.

import { sha256, sha256d, aBytes, leHex, deLe } from './hash.js';

export const RED = 'stateark-sim';
const CERO = '0'.repeat(64);
const DIEZ_MINUTOS = 10 * 60 * 1000;
const VERSION = 0x20000000;
const BITS = 0x207fffff; // regtest
export const OBJETIVO = (BigInt(BITS & 0xffffff) << (8n * BigInt((BITS >>> 24) - 3)));

/** El hash de un bloque como número (para comparar con el objetivo): sus bytes al revés. */
export function comoNumero(hashInterno) {
  return BigInt('0x' + hashInterno.match(/../g).reverse().join(''));
}

/** Raíz de Merkle de Bitcoin sobre hashes en orden interno. */
export async function raizMerkleBitcoin(hojas) {
  if (!hojas.length) return CERO;
  let nivel = [...hojas];
  while (nivel.length > 1) {
    if (nivel.length % 2) nivel.push(nivel[nivel.length - 1]);
    const siguiente = [];
    for (let i = 0; i < nivel.length; i += 2) siguiente.push(await sha256d(nivel[i] + nivel[i + 1]));
    nivel = siguiente;
  }
  return nivel[0];
}

/**
 * Los pasos OpenTimestamps que llevan una hoja hasta la raíz de Merkle de Bitcoin: por cada nivel, anteponer
 * o añadir el hermano y luego dos «sha256». Una hoja sola no necesita pasos (la raíz es ella).
 */
export async function pasosOts(hojas, indice) {
  const pasos = [];
  let nivel = [...hojas];
  let i = indice;
  while (nivel.length > 1) {
    if (nivel.length % 2) nivel.push(nivel[nivel.length - 1]);
    const hermano = nivel[i ^ 1];
    pasos.push(i % 2 === 0 ? ['append', hermano] : ['prepend', hermano], ['sha256'], ['sha256']);
    const siguiente = [];
    for (let k = 0; k < nivel.length; k += 2) siguiente.push(await sha256d(nivel[k] + nivel[k + 1]));
    nivel = siguiente;
    i >>= 1;
  }
  return pasos;
}

/** Aplica pasos OTS (prepend, append, sha256) a un hash en hex. Devuelve null si un paso está mal formado. */
export async function aplicarOts(hex, pasos) {
  let x = hex;
  for (const p of pasos ?? []) {
    if (!Array.isArray(p)) return null;
    if (p[0] === 'prepend' && /^[0-9a-f]*$/.test(p[1] ?? '')) x = p[1] + x;
    else if (p[0] === 'append' && /^[0-9a-f]*$/.test(p[1] ?? '')) x = x + p[1];
    else if (p[0] === 'sha256' && p.length === 1) x = await sha256(aBytes(x));
    else return null;
  }
  return x;
}

/** Arma la cabecera de 80 bytes en hex. */
export function cabeceraHex({ previo, raiz, segundos, nonce }) {
  return leHex(VERSION, 4) + previo + raiz + leHex(segundos, 4) + leHex(BITS, 4) + leHex(nonce, 4);
}

/** Lee una cabecera de 80 bytes en hex (lo que hará `cabecera(b)` en BQL). */
export async function leerCabecera(hex) {
  if (!/^[0-9a-f]{160}$/.test(hex ?? '')) return null;
  return {
    version: Number(deLe(hex.slice(0, 8))),
    anterior: hex.slice(8, 72),
    raiz: hex.slice(72, 136),
    hora: Number(deLe(hex.slice(136, 144))),
    bits: Number(deLe(hex.slice(144, 152))),
    nonce: Number(deLe(hex.slice(152, 160))),
    hash: await sha256d(hex),
  };
}

async function construir({ altura, previo, instante, lotes }) {
  const raiz = await raizMerkleBitcoin(lotes);
  const segundos = Math.floor(Date.parse(instante) / 1000);
  for (let nonce = 0; ; nonce++) {
    const cabecera = cabeceraHex({ previo, raiz, segundos, nonce });
    const hash = await sha256d(cabecera);
    if (comoNumero(hash) <= OBJETIVO) {
      return { altura, previo, instante: new Date(segundos * 1000).toISOString(), lotes: [...lotes], raiz_lotes: raiz, cabecera, hash };
    }
  }
}

export class Cadena {
  /**
   * @param {object} [opciones]
   * @param {string} [opciones.inicio] instante ISO del bloque génesis (por defecto, ahora)
   * @param {number} [opciones.intervalo] milisegundos entre bloques (por defecto, 10 min)
   * @param {() => number} [opciones.reloj] reloj inyectable en ms (por defecto, Date.now)
   */
  constructor(opciones = {}) {
    this.intervalo = opciones.intervalo ?? DIEZ_MINUTOS;
    this.reloj = opciones.reloj ?? (() => Date.now());
    this.inicio = opciones.inicio ?? new Date(this.reloj()).toISOString();
    this.bloques = [];
  }

  async iniciar() {
    if (this.bloques.length) return this;
    const g = await construir({ altura: 0, previo: CERO, instante: new Date(this.inicio).toISOString(), lotes: [] });
    this.bloques.push(Object.freeze({ ...g, lotes: Object.freeze(g.lotes) }));
    return this;
  }

  static async crear(opciones) {
    return new Cadena(opciones).iniciar();
  }

  get altura() {
    return this.bloques.length - 1;
  }

  bloque(altura) {
    return Number.isInteger(altura) && altura >= 0 ? this.bloques[altura] ?? null : null;
  }

  /** Mina un bloque con estos compromisos. Su hora es la mayor entre la del anterior + intervalo y el reloj. */
  async minar(lotes = []) {
    if (!this.bloques.length) await this.iniciar();
    const previo = this.bloques[this.bloques.length - 1];
    const t = Math.max(Date.parse(previo.instante) + this.intervalo, this.reloj());
    const b = await construir({ altura: previo.altura + 1, previo: previo.hash, instante: new Date(t).toISOString(), lotes });
    const congelado = Object.freeze({ ...b, lotes: Object.freeze(b.lotes) });
    this.bloques.push(congelado);
    return congelado;
  }

  /** Los pasos OTS de un compromiso hasta la raíz de Merkle de su bloque. */
  pasosDe(altura, compromiso) {
    const b = this.bloque(altura);
    const i = b?.lotes.indexOf(compromiso) ?? -1;
    if (i < 0) return null;
    return pasosOts(b.lotes, i);
  }

  /** Comprueba que el bloque es íntegro: su raíz, su cabecera, su hash, su prueba de trabajo y su enlace. */
  async integro(altura) {
    const b = this.bloque(altura);
    if (!b) return false;
    if (b.raiz_lotes !== (await raizMerkleBitcoin(b.lotes))) return false;
    const c = await leerCabecera(b.cabecera);
    if (!c || c.raiz !== b.raiz_lotes || c.anterior !== b.previo || c.hash !== b.hash) return false;
    if (c.hora !== Math.floor(Date.parse(b.instante) / 1000)) return false;
    if (comoNumero(b.hash) > OBJETIVO) return false;
    if (altura === 0) return b.previo === CERO;
    return b.previo === this.bloques[altura - 1].hash;
  }

  exportar() {
    return { red: RED, intervalo: this.intervalo, inicio: this.inicio, bloques: this.bloques };
  }

  static async importar(estado, opciones = {}) {
    if (estado?.red !== RED) throw new TypeError(`no es un estado de ${RED}`);
    const c = new Cadena({ ...opciones, intervalo: estado.intervalo, inicio: estado.inicio });
    c.bloques = estado.bloques.map((b) => Object.freeze({ ...b, lotes: Object.freeze([...b.lotes]) }));
    for (let h = 0; h <= c.altura; h++) {
      if (!(await c.integro(h))) throw new Error(`el bloque ${h} del estado importado no es íntegro`);
    }
    return c;
  }
}

/** Para las pruebas y la carta: la altura en 4 bytes little-endian (lo que firma el observador junto a la cabecera). */
export const alturaLe = (altura) => leHex(altura, 4);
