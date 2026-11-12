// Una cadena de bloques SIMULADA. No es Bitcoin: no hay prueba de trabajo, ni red, ni reorganizaciones.
// Imita lo que el §3 necesita de Bitcoin: bloques con altura, hash, instante y los compromisos
// (raíces de lote) que se meten en ellos.
//
// El hash de un bloque es SHA-256 de su cabecera canónica, que incluye el hash del anterior y la raíz
// de sus lotes: cambiar cualquier cosa de un bloque cambia su hash y el de todos los siguientes.

import { sha256Texto, sha256Etiquetado } from './hash.js';

export const RED = 'stateark-sim';
const CERO = '0'.repeat(64);
const DIEZ_MINUTOS = 10 * 60 * 1000;

function cabecera(b) {
  // Orden fijo de campos: el JSON es la forma canónica.
  return JSON.stringify({ red: RED, altura: b.altura, previo: b.previo, instante: b.instante, raiz_lotes: b.raiz_lotes });
}

/** Raíz plana de los lotes de un bloque (hash encadenado: basta para la simulación). */
async function raizLotes(lotes) {
  let r = CERO;
  for (const l of lotes) r = await sha256Etiquetado(0x02, r, l);
  return r;
}

export async function hashBloque(b) {
  return sha256Texto(cabecera(b));
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

  /** Crea el génesis. Hay que llamarlo (o usar Cadena.crear) antes de minar. */
  async iniciar() {
    if (this.bloques.length) return this;
    const g = { altura: 0, previo: CERO, instante: new Date(this.inicio).toISOString(), lotes: [] };
    g.raiz_lotes = await raizLotes(g.lotes);
    g.hash = await hashBloque(g);
    this.bloques.push(Object.freeze(g));
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

  /** Mina un bloque con estos lotes. Su instante es el mayor entre el anterior + intervalo y el reloj. */
  async minar(lotes = []) {
    if (!this.bloques.length) await this.iniciar();
    const previo = this.bloques[this.bloques.length - 1];
    const t = Math.max(Date.parse(previo.instante) + this.intervalo, this.reloj());
    const b = { altura: previo.altura + 1, previo: previo.hash, instante: new Date(t).toISOString(), lotes: [...lotes] };
    b.raiz_lotes = await raizLotes(b.lotes);
    b.hash = await hashBloque(b);
    Object.freeze(b.lotes);
    this.bloques.push(Object.freeze(b));
    return b;
  }

  /** Comprueba que el bloque de esa altura es íntegro y está encadenado con el anterior. */
  async integro(altura) {
    const b = this.bloque(altura);
    if (!b) return false;
    if (b.raiz_lotes !== (await raizLotes(b.lotes))) return false;
    if (b.hash !== (await hashBloque(b))) return false;
    if (altura === 0) return b.previo === CERO;
    return b.previo === this.bloques[altura - 1].hash;
  }

  /** Estado serializable (para guardar y restaurar la simulación). */
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
