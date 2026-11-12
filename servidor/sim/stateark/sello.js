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
// Lo que finge: la cadena (ver cadena.js). El anclaje es POR TAPROOT (VG, 13-11), no OpenTimestamps: cada
// bloque que sella lleva una transacción de anclaje con forma de Bitcoin cuya salida P2TR compromete, como
// hojas «OP_RETURN <raíz>» de su árbol Taproot, las raíces de los lotes (taproot.js). La prueba trae:
//   taproot     { tx, vout, interna, hermanos }: la transacción de anclaje, la salida, la clave interna y los
//               hermanos de la hoja del lote en el árbol Taproot
//   pasos       los pasos (append|prepend, sha256, sha256) que llevan el txid de anclaje a la raíz de Merkle
//               de la cabecera: el camino de Merkle de Bitcoin
//   cabecera    los 80 bytes del bloque (forma de Bitcoin; su doble SHA-256 es el hash)
//   observador  { clave, firma, altura_le }: StateArk, como servicio, firmó esa cabecera a esa altura (H9)
// y `selloComoDecupla(prueba, id)` la da como la décupla del SIP 0 para X.6.8.2.

import { esId, sha256Texto, sha256d } from './hash.js';
import { arbol, raizDesde } from './merkle.js';
import { Cadena, leerCabecera, aplicarOts, alturaLe } from './cadena.js';
import { Custodia, verificarObservacion } from './custodia.js';
import { madurez } from './madurez.js';
import { anclar, scriptDeCompromiso, raizDesdeHermanos, claveDeSalida, scriptDeSalida, VIA_TAPROOT } from './taproot.js';
import { hoja, NUMS } from './miniscript.js';

export const VIA = VIA_TAPROOT;

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
    this.interna = opciones.interna ?? NUMS; // la clave interna de las salidas de anclaje (la de la cartera, en real)
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
    // Con lotes pendientes, una transacción de anclaje los compromete todos en el árbol Taproot de su salida.
    const ancla = raices.length
      ? await anclar(raices, { interna: this.interna, previa: await sha256Texto(`stateark-sim/anclaje:${this.cadena.altura + 1}`) })
      : null;
    const bloque = await this.cadena.minar(ancla ? [ancla.txid, ...extra] : [...extra]);
    for (const r of raices) {
      const l = this.lotes.get(r);
      l.altura = bloque.altura;
      l.anclaje = { tx: ancla.tx, vout: 0, interna: ancla.interna, hermanos: ancla.hermanos.get(r) };
      l.pasos = await this.cadena.pasosDe(bloque.altura, ancla.txid);
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
        via: VIA,
        taproot: { tx: lote.anclaje.tx, vout: lote.anclaje.vout, interna: lote.anclaje.interna, hermanos: [...lote.anclaje.hermanos] },
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
    if (prueba.prueba?.via !== VIA) return { ok: false, motivo: `esta simulación solo comprueba sellos por «${VIA}»` };
    const raiz = await raizDesde(id, prueba.prueba?.camino);
    if (raiz === null) return { ok: false, motivo: 'el camino de Merkle está mal formado' };
    if (raiz !== lote) return { ok: false, motivo: 'el id y su camino no dan la raíz del lote' };
    const b = this.cadena.bloque(altura);
    if (!b) return { ok: false, motivo: `no hay bloque a la altura ${altura}` };
    if (b.hash !== hash) return { ok: false, motivo: 'el hash no es el del bloque de esa altura' };
    if (!(await this.cadena.integro(altura))) return { ok: false, motivo: 'el bloque no es íntegro' };
    // El anclaje por Taproot: hoja de compromiso → árbol → TapTweak → la salida de la transacción.
    const { cabecera, pasos, observador, taproot } = prueba.prueba;
    if (!taproot || typeof taproot.tx !== 'string') return { ok: false, motivo: 'la prueba no trae la transacción de anclaje' };
    const raizTaproot = await raizDesdeHermanos(await hoja(scriptDeCompromiso(lote)), taproot.hermanos);
    let clave;
    try { clave = await claveDeSalida(taproot.interna, raizTaproot); } catch { return { ok: false, motivo: 'la clave interna no es un punto de la curva' }; }
    if (scriptDeSalida(taproot.tx, taproot.vout) !== '5120' + clave) return { ok: false, motivo: 'la salida de la transacción no compromete ese lote' };
    const txid = await sha256d(taproot.tx);
    if (!b.lotes.includes(txid)) return { ok: false, motivo: 'el bloque no contiene la transacción de anclaje' };
    // H9: la cabecera, el camino de la transacción y el observador, como los comprobará la regla «sealed».
    const c = await leerCabecera(cabecera);
    if (!c) return { ok: false, motivo: 'la prueba no trae una cabecera de 80 bytes' };
    if (c.hash !== hash) return { ok: false, motivo: 'la cabecera no da el hash del bloque' };
    if ((await aplicarOts(txid, pasos)) !== c.raiz) return { ok: false, motivo: 'el camino no lleva la transacción a la raíz de la cabecera' };
    if (observador?.altura_le !== alturaLe(altura)) return { ok: false, motivo: 'la altura firmada no es la del sello' };
    const aceptados = this.aceptados ?? [this.claveObservador];
    if (!aceptados.includes(observador?.clave)) return { ok: false, motivo: 'el observador no está entre los declarados' };
    if (!(await verificarObservacion({ cabecera, ...observador }, { esquema: this.observador.custodia.esquema }))) return { ok: false, motivo: 'la firma del observador no verifica' };
    return { ok: true, motivo: 'sellado', altura: b.altura, hash: b.hash, instante: b.instante };
  }

  exportar() {
    return {
      cadena: this.cadena.exportar(),
      lotes: [...this.lotes].map(([raiz, l]) => ({ raiz, ids: l.ids, altura: l.altura, anclaje: l.anclaje ?? null })),
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
      const anclaje = l.anclaje ?? null;
      s.lotes.set(raiz, { ids: l.ids, caminos, altura: l.altura, anclaje, pasos: anclaje ? await s.cadena.pasosDe(l.altura, await sha256d(anclaje.tx)) : null });
      if (l.altura === null) s.pendientes.push(raiz);
      for (const id of l.ids) {
        if (!s.porId.has(id)) s.porId.set(id, []);
        s.porId.get(id).push(raiz);
      }
    }
    return s;
  }
}

/** Los pasos OTS de la sim (append|prepend X, sha256, sha256) como camino de Merkle «bitcoin»: lados y hermanos. */
export function caminoDePasos(pasos) {
  const lados = [];
  const hermanos = [];
  for (let i = 0; i < pasos.length; i += 3) {
    const [op, x] = pasos[i];
    if (!(op === 'append' || op === 'prepend') || pasos[i + 1]?.[0] !== 'sha256' || pasos[i + 2]?.[0] !== 'sha256') throw new TypeError('pasos que no son un camino de Merkle de Bitcoin');
    lados.push(op === 'append' ? 'd' : 'i'); // append: el hermano va a la derecha
    hermanos.push(x);
  }
  return { lados, hermanos };
}

/**
 * La prueba como la décupla BTML del sello del SIP 0, lista para ir en X.6.8.2 del registro sellado.
 * Sin huecos, sin relleno y sin tuplas (VG, 12-11 y 13-11); lo opcional, al final de su décupla.
 *   0 ["sello de tiempo", "SIP 0"]  1 altura  2 hash del bloque  3 raíz del lote  4 el id sellado (la hoja)
 *   5 instante del bloque  6 vía («taproot»)
 *   7 lo observado, SIEMPRE una décupla: [[cabecera], [firma], [altura en 4 bytes LE], [clave del observador],
 *                    lados, hermanos del camino «bitcoin» de la transacción a la raíz de la cabecera (si lo hay)]
 *   8 el anclaje, SIEMPRE una décupla: [[transacción de anclaje], [vout], [clave interna],
 *                    hermanos de la hoja en el árbol Taproot (si los hay)]
 * Cada hoja suelta va entre corchetes (la forma canónica de BTML, VG 8-11): una décupla de solo hojas sería una
 * LISTA, sin posiciones que una regla pueda leer (7.0, 7.1… no existirían). Core AGRAM, 13-11.
 *   9 el camino «sip» del id a la raíz del lote: [lados, hermanos] (si lo hay)
 */
export function selloComoDecupla(prueba, id) {
  if (!prueba || prueba.pendiente) throw new TypeError('un sello pendiente aún no tiene décupla');
  const p = prueba.prueba;
  const observado = [[p.cabecera], [p.observador.firma], [p.observador.altura_le], [p.observador.clave]];
  if (p.pasos.length) {
    const { lados, hermanos } = caminoDePasos(p.pasos);
    observado.push(lados, hermanos);
  }
  const anclaje = [[p.taproot.tx], [p.taproot.vout], [p.taproot.interna]];
  if (p.taproot.hermanos.length) anclaje.push([...p.taproot.hermanos]);
  const d = [['sello de tiempo', 'SIP 0'], prueba.altura, prueba.hash, prueba.lote, id, prueba.instante, p.via, observado, anclaje];
  if (p.camino.length) d.push([p.camino.map(([l]) => l), p.camino.map(([, h]) => h)]);
  return d;
}
