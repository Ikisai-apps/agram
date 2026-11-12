// §3 del contrato AGRAM ↔ exterior: el sello de tiempo en Bitcoin, SIMULADO.
//
//   sellar(ids)              → { lote, pendiente: true, ids }
//   prueba(id)               → { altura, hash, instante, lote, prueba } | { pendiente: true, lote } | null
//   verificar(evento, prueba) → { ok, motivo, altura?, hash?, instante? }
//
// Lo que se sella es una lista de ids de AGRAM (SHA-256 del cuerpo canónico, 64 hex). El evento no se
// toca ni se lee: de un evento solo se usa su `id`. El bloque dice que el lote existía COMO MUY TARDE
// en su instante (cota superior), no la hora del evento.
//
// Lo que finge: la cadena (ver cadena.js) y el calendario de OpenTimestamps (`ots` va a null y
// `via: "simulado"`). La forma de la prueba es la del contrato, para que cambiar a lo real no cambie
// a quien la usa.

import { esId } from './hash.js';
import { arbol, raizDesde } from './merkle.js';
import { Cadena } from './cadena.js';

export const VIA = 'simulado';

function comprobarIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) throw new TypeError('sellar necesita una lista no vacía de ids');
  for (const id of ids) {
    if (!esId(id)) throw new TypeError(`no es un id de AGRAM (64 hex en minúsculas): ${String(id).slice(0, 80)}`);
  }
  return [...new Set(ids)].sort();
}

export class Sellador {
  /** @param {Cadena} cadena una cadena ya iniciada */
  constructor(cadena) {
    this.cadena = cadena;
    this.lotes = new Map(); // raíz → { ids, caminos: Map, altura: number|null }
    this.porId = new Map(); // id → raíces de los lotes que lo contienen (un id puede sellarse más de una vez)
    this.pendientes = []; // raíces aún sin bloque, en orden de llegada
  }

  static async crear(opcionesCadena) {
    return new Sellador(await Cadena.crear(opcionesCadena));
  }

  /** Sella un lote de ids. Queda pendiente hasta que se mine un bloque. Sellar dos veces el mismo lote no lo duplica. */
  async sellar(ids) {
    const lista = comprobarIds(ids);
    const { raiz, caminos } = await arbol(lista);
    if (!this.lotes.has(raiz)) {
      this.lotes.set(raiz, { ids: lista, caminos, altura: null });
      this.pendientes.push(raiz);
      for (const id of lista) {
        if (!this.porId.has(id)) this.porId.set(id, []);
        this.porId.get(id).push(raiz);
      }
    }
    const lote = this.lotes.get(raiz);
    return { lote: raiz, pendiente: lote.altura === null, ids: lista };
  }

  /** Mina un bloque con todos los lotes pendientes (en la simulación, lo que haría el calendario OTS). */
  async minar() {
    const raices = this.pendientes.splice(0);
    const bloque = await this.cadena.minar(raices);
    for (const r of raices) this.lotes.get(r).altura = bloque.altura;
    return { altura: bloque.altura, hash: bloque.hash, instante: bloque.instante, lotes: raices.length };
  }

  /**
   * La prueba de un id. Si está en varios lotes, da la del primero que entró en un bloque (el sello más antiguo).
   * Devuelve { pendiente: true, lote } si aún no hay bloque, y null si nunca se selló.
   */
  prueba(id) {
    if (!esId(id)) throw new TypeError('prueba necesita un id de AGRAM (64 hex en minúsculas)');
    const raices = this.porId.get(id);
    if (!raices) return null;
    const sellados = raices.map((r) => [r, this.lotes.get(r)]).filter(([, l]) => l.altura !== null);
    if (!sellados.length) return { pendiente: true, lote: raices[0] };
    sellados.sort((a, b) => a[1].altura - b[1].altura);
    const [raiz, lote] = sellados[0];
    const b = this.cadena.bloque(lote.altura);
    return {
      altura: b.altura,
      hash: b.hash,
      instante: b.instante,
      lote: raiz,
      prueba: { camino: lote.caminos.get(id).map(([lado, h]) => [lado, h]), ots: null, via: VIA },
    };
  }

  /**
   * Comprueba una prueba sin fiarse de ella: recalcula la raíz desde el id y el camino, y mira en la
   * cadena que el bloque de esa altura tiene ese hash, es íntegro y contiene ese lote.
   * @param {string|{id:string}} evento el id, o un evento de AGRAM (solo se lee su id)
   */
  async verificar(evento, prueba) {
    const id = typeof evento === 'string' ? evento : evento?.id;
    if (!esId(id)) return { ok: false, motivo: 'el evento no tiene un id de AGRAM válido' };
    if (!prueba || typeof prueba !== 'object') return { ok: false, motivo: 'no hay prueba' };
    if (prueba.pendiente) return { ok: false, motivo: 'pendiente: el lote aún no está en un bloque' };
    const { altura, hash, lote } = prueba;
    if (!esId(lote)) return { ok: false, motivo: 'la prueba no trae la raíz del lote' };
    if (prueba.prueba?.via !== VIA) return { ok: false, motivo: `esta simulación solo comprueba pruebas «${VIA}»` };
    const raiz = await raizDesde(id, prueba.prueba?.camino);
    if (raiz === null) return { ok: false, motivo: 'el camino de Merkle está mal formado' };
    if (raiz !== lote) return { ok: false, motivo: 'el id y su camino no dan la raíz del lote' };
    const b = this.cadena.bloque(altura);
    if (!b) return { ok: false, motivo: `no hay bloque a la altura ${altura}` };
    if (b.hash !== hash) return { ok: false, motivo: 'el hash no es el del bloque de esa altura' };
    if (!(await this.cadena.integro(altura))) return { ok: false, motivo: 'el bloque no es íntegro' };
    if (!b.lotes.includes(lote)) return { ok: false, motivo: 'el bloque no contiene ese lote' };
    return { ok: true, motivo: 'sellado', altura: b.altura, hash: b.hash, instante: b.instante };
  }

  exportar() {
    return {
      cadena: this.cadena.exportar(),
      lotes: [...this.lotes].map(([raiz, l]) => ({ raiz, ids: l.ids, altura: l.altura })),
    };
  }

  static async importar(estado, opcionesCadena) {
    const s = new Sellador(await Cadena.importar(estado.cadena, opcionesCadena));
    for (const l of estado.lotes) {
      const { raiz, caminos } = await arbol(l.ids);
      if (raiz !== l.raiz) throw new Error('un lote del estado importado no da su raíz');
      s.lotes.set(raiz, { ids: l.ids, caminos, altura: l.altura });
      if (l.altura === null) s.pendientes.push(raiz);
      for (const id of l.ids) {
        if (!s.porId.has(id)) s.porId.set(id, []);
        s.porId.get(id).push(raiz);
      }
    }
    return s;
  }
}
