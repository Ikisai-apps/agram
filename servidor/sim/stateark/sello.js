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
//
// Desde H9 (VG, 12-11) la prueba trae además, en `prueba`:
//   cabecera    los 80 bytes del bloque (forma de Bitcoin; su doble SHA-256 es el hash)
//   pasos       los pasos OpenTimestamps que llevan la raíz del lote a la raíz de Merkle de la cabecera
//   observador  { clave, firma, altura_le }: StateArk, como servicio, firmó esa cabecera a esa altura
// y `selloComoDecupla(prueba, id)` la da como la décupla del SIP 0 (X.6.8.2: 1 altura … 8.0–8.4).

import { esId } from './hash.js';
import { arbol, raizDesde } from './merkle.js';
import { Cadena, leerCabecera, aplicarOts, alturaLe } from './cadena.js';
import { Custodia, verificarObservacion } from './custodia.js';
import { madurez } from './madurez.js';

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
  /**
   * @param {Cadena} cadena una cadena ya iniciada
   * @param {object} [opciones]
   * @param {{ custodia: Custodia, nombre: string }} [opciones.observador] quién firma las cabeceras (por defecto,
   *        una custodia propia con el esquema simulado; con la noble de AGRAM, `new Custodia({ esquema })`)
   * @param {string[]} [opciones.observadores] claves aceptadas al verificar (por defecto, la del observador)
   */
  constructor(cadena, opciones = {}) {
    this.cadena = cadena;
    this.observador = opciones.observador ?? null;
    this.aceptados = opciones.observadores ?? null;
    this.observaciones = new Map(); // altura → { clave, firma, altura_le }
    this.lotes = new Map(); // raíz → { ids, caminos: Map, altura: number|null }
    this.porId = new Map(); // id → raíces de los lotes que lo contienen (un id puede sellarse más de una vez)
    this.pendientes = []; // raíces aún sin bloque, en orden de llegada
  }

  static async crear(opciones = {}) {
    const s = new Sellador(await Cadena.crear(opciones), opciones);
    await s.#asegurarObservador();
    await s.#observar(0);
    return s;
  }

  async #asegurarObservador() {
    if (this.observador) return;
    const custodia = new Custodia();
    await custodia.crearClave('nostr', 'observador');
    this.observador = { custodia, nombre: 'observador' };
  }

  /** La clave del observador (la que la cuenta raíz declara en «exterior settings», posición 6). */
  get claveObservador() {
    return this.observador.custodia.publica('nostr', this.observador.nombre);
  }

  async #observar(altura) {
    const b = this.cadena.bloque(altura);
    this.observaciones.set(altura, await this.observador.custodia.firmarCabecera(this.observador.nombre, b.cabecera, b.altura));
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

  /**
   * Mina un bloque con todos los lotes pendientes (en la simulación, lo que haría el calendario OTS).
   * `extra`: otros compromisos que entran en el mismo bloque (los txid de los pagos del §5).
   */
  async minar(extra = []) {
    const raices = this.pendientes.splice(0);
    const bloque = await this.cadena.minar([...raices, ...extra]);
    for (const r of raices) {
      const l = this.lotes.get(r);
      l.altura = bloque.altura;
      l.pasos = await this.cadena.pasosDe(bloque.altura, r);
    }
    await this.#observar(bloque.altura);
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
      prueba: {
        camino: lote.caminos.get(id).map(([lado, h]) => [lado, h]),
        ots: null,
        via: VIA,
        cabecera: b.cabecera,
        pasos: lote.pasos.map((p) => [...p]),
        observador: { ...this.observaciones.get(b.altura) },
      },
    };
  }

  /** La profundidad y la madurez de un sello frente a la cadena de hoy (H11). */
  madurezDe(prueba, n) {
    return madurez(this.cadena.altura, prueba?.pendiente ? null : prueba?.altura ?? null, n);
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
    // H9: la cabecera, los pasos OTS y el observador, comprobados como los comprobará la regla «sealed».
    const { cabecera, pasos, observador } = prueba.prueba;
    const c = await leerCabecera(cabecera);
    if (!c) return { ok: false, motivo: 'la prueba no trae una cabecera de 80 bytes' };
    if (c.hash !== hash) return { ok: false, motivo: 'la cabecera no da el hash del bloque' };
    if ((await aplicarOts(lote, pasos)) !== c.raiz) return { ok: false, motivo: 'los pasos OTS no llevan el lote a la raíz de la cabecera' };
    if (observador?.altura_le !== alturaLe(altura)) return { ok: false, motivo: 'la altura firmada no es la del sello' };
    const aceptados = this.aceptados ?? [this.claveObservador];
    if (!aceptados.includes(observador?.clave)) return { ok: false, motivo: 'el observador no está entre los declarados' };
    if (!(await verificarObservacion({ cabecera, ...observador }, { esquema: this.observador.custodia.esquema }))) return { ok: false, motivo: 'la firma del observador no verifica' };
    return { ok: true, motivo: 'sellado', altura: b.altura, hash: b.hash, instante: b.instante };
  }

  exportar() {
    return {
      cadena: this.cadena.exportar(),
      lotes: [...this.lotes].map(([raiz, l]) => ({ raiz, ids: l.ids, altura: l.altura })),
      observaciones: [...this.observaciones].map(([altura, o]) => ({ altura, ...o })),
      observador: this.claveObservador, // solo la pública: la privada no sale de su custodia
    };
  }

  static async importar(estado, opciones = {}) {
    const s = new Sellador(await Cadena.importar(estado.cadena, opciones), opciones);
    await s.#asegurarObservador();
    // Sin el observador original (su privada no se exporta), se aceptan sus firmas pasadas y las del nuevo.
    if (!opciones.observadores && estado.observador && estado.observador !== s.claveObservador) s.aceptados = [estado.observador, s.claveObservador];
    for (const { altura, ...o } of estado.observaciones ?? []) s.observaciones.set(altura, o);
    for (const l of estado.lotes) {
      const { raiz, caminos } = await arbol(l.ids);
      if (raiz !== l.raiz) throw new Error('un lote del estado importado no da su raíz');
      s.lotes.set(raiz, { ids: l.ids, caminos, altura: l.altura, pasos: l.altura === null ? null : await s.cadena.pasosDe(l.altura, raiz) });
      if (l.altura === null) s.pendientes.push(raiz);
      for (const id of l.ids) {
        if (!s.porId.has(id)) s.porId.set(id, []);
        s.porId.get(id).push(raiz);
      }
    }
    return s;
  }
}

/**
 * La prueba como la décupla BTML del sello del SIP 0, lista para ir en X.6.8.2 del registro sellado:
 *   0 ["sello de tiempo", "SIP 0"], 1 altura, 2 hash, 3 lote, 4 camino (o «-» si el lote es de un solo id),
 *   5 el id, 6 instante, 7 vía, 8 [cabecera, pasos (o «-»), firma del observador, altura en 4 bytes LE, clave], 9 «-»
 */
export function selloComoDecupla(prueba, id) {
  if (!prueba || prueba.pendiente) throw new TypeError('un sello pendiente aún no tiene décupla');
  const p = prueba.prueba;
  return [
    ['sello de tiempo', 'SIP 0'],
    prueba.altura,
    prueba.hash,
    prueba.lote,
    p.camino.length ? p.camino.map(([l, h]) => [l, h]) : '-',
    id,
    prueba.instante,
    p.via,
    [p.cabecera, p.pasos.length ? p.pasos.map((x) => [...x]) : '-', p.observador.firma, p.observador.altura_le, p.observador.clave],
    '-',
  ];
}
