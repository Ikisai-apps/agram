// El contexto de evaluación del BQL mínimo sobre el eje actual (src/bqlm.js,
// docs/BQLM.md §4). Resuelve cada posición X.d con sus ocupantes, y materializa
// como ocupantes IMPLÍCITOS, sin tocar el eje, las vistas y los despliegues
// (docs/notas/INVENTARIO_REGLAS.md §2.2):
//
//   D-META   en un evento (la candidata `ev` o un registro del eje): 3 autor y firmante, 5 id, 6.0 t,
//            6.5 sobre y en, 1 los movimientos (colisionan con lo que el payload tenga en el 1)
//   D-MOV    un movimiento como décupla: 0 serie, 1 cuánto, 2 estado, salida y caducidad (las que haya),
//            3 de quién a quién (3.0 de, 3.1 a; null es «nadie»), 4 primitiva, 5 registro de la serie,
//            7 caducidad o fecha a la que se refiere, 9 nota
//   D-SERIE  una clave de serie como décupla: 0 familia, 1 escala de T (un dígito) o emisor (E, R) o
//            ámbito (P), 2 denominación, 5 registro, 7 franja
//   D-FECHA  un instante como décupla: k = el número de periodo de la escala k desde 1970-01-01T00:00Z
//            (0 segundo, 1 minuto, 2 hora, 3 día civil, 4 semana, 5 ciclo de 28 días, 6 año de 364 + 1)
//   D-VALOR  un terminal «12 EUR» o «EUR 12»: 1 cuánto, 2 unidad (solo lectura)
//   vistas   de una identidad A: A.1 la cartera (un ocupante por serie: 0 serie, 1 disponible,
//            2 bloqueado, uno por salida: 0 salida, 1 cuánto), A.6 su alta (el registro que abrió su
//            cuenta: A.6.6.0 su t, A.6.3 su autor), A.7.e el T de la escala e gastado de la
//            asignación del día civil de ev.6.0.3; de un registro X: X.1 sus series de E atadas y vivas
//            (0 serie, 1 lo vivo, 7 caducidad); de una serie del libro S (la de un movimiento o de una
//            entrada de la cartera): S.8 lo emitido hasta antes de ev
//
// Orden de los ocupantes de una posición: primero los implícitos (D-META y
// vistas), después lo propio del payload (por camino exacto: una lista da sus
// elementos, una referencia lo que alcanza en el payload del otro registro) y
// al final lo escrito anclado ahí, por llegada. Un texto es a la vez su valor
// y, si se despliega, una décupla: un instante (D-FECHA), una clave de serie
// (D-SERIE), el id de un registro del eje (el registro), una identidad con
// alta (sus vistas) o una magnitud (D-VALOR).
//
// Solo usa la API pública del eje (obtener, alta, libro.vista, gastadoT,
// series, serie, vivo, registroDe, sobre, identidades, tMaximo, genesisId; sin libro,
// saldos, saldo y bloqueos).
// Lo que el libro tendría que dar y hoy se lee aparte: docs/BQLM.md §7,
// «Pendiente de integrar». No lee el tipo de ninguna identidad (R10).

import { ARIDAD, esReferencia, esLista, direccion, indicesDe, resolver } from './btml.js';
import { ESCALAS_T, ESCALAS_REALES, SEGUNDOS, claveToken, partirClave, franjaDe, diaCivil } from './tokens.js';
import { esInstante, msUTC } from './instante.js';
import { pendiente, Presupuesto, SIMBOLOS, NADIE } from './bqlm.js';

/** Quien está al otro lado de una emisión o de un consumo: el símbolo de src/bqlm.js, nunca un texto (SEG-11). */
export { NADIE };

/** Cuántas referencias encadenadas se siguen (como src/encaje.js). */
const MAX_SALTOS = 20;

const RE_ID = /^[0-9a-f]{64}$/;
const RE_SERIE = /^([EPRT]):(.+)$/;
// Como la magnitud de src/bql.js, pero con un espacio al menos entre la cifra y la unidad: «huesped2» no es «2 huesped».
const RE_MAGNITUD = /^(?:(-?\d+(?:\.\d+)?)\s+([\p{L}€$%][\p{L}\p{N}_€$%]*)|([\p{L}€$%][\p{L}\p{N}_€$%]*)\s+(-?\d+(?:\.\d+)?))$/u;

const CANDIDATA = Object.freeze({ k: 'ev' });
const EN_CURSO = Symbol('en curso');
const EPOCA = Object.freeze({ k: 'epoch' });
const ANTES = Object.freeze({ k: 'before' });

/** La primitiva de un movimiento (las cinco de la capa de transacciones). */
export function primitivaDe(m) {
  if (m.de === null) return 'mint';
  if (m.a === null) return 'burn';
  if (m.estado === 'bloqueo') return 'lock';
  if (m.estado === 'liberacion') return 'release';
  return 'transfer';
}

/** D-FECHA: { k: el periodo de la escala real k } de un instante, o null si no lo es. */
export function desplegarFecha(t) {
  if (!esInstante(t)) return null;
  const segundos = Math.floor(msUTC(t) / 1000);
  return Object.fromEntries(ESCALAS_REALES.map((e, k) => [k, [Math.floor(segundos / SEGUNDOS[e])]]));
}

/** D-VALOR: { 1: [cuánto], 2: [unidad] } de un terminal «12 EUR» o «EUR 12», o null. */
export function desplegarValor(s) {
  const m = typeof s === 'string' ? RE_MAGNITUD.exec(s.trim()) : null;
  if (!m) return null;
  return m[1] !== undefined ? { 1: [Number(m[1])], 2: [m[2]] } : { 1: [Number(m[4])], 2: [m[3]] };
}

/** D-SERIE: { posición: [ocupantes] } de una clave de serie, o null si no lo es. `registroDe(clave)` da el registro de una E que no lo nombra. */
export function desplegarSerie(s, registroDe = () => null, { delLibro = false } = {}) {
  const fam = (f) => (delLibro ? SIMBOLOS[f] : f);
  const m = typeof s === 'string' ? RE_SERIE.exec(s) : null;
  if (!m) return null;
  const familia = m[1];
  if (familia === 'T') {
    const k = ESCALAS_T.indexOf(m[2]);
    return k < 0 ? null : { 0: [fam('T')], 1: [k] };
  }
  if (familia === 'P') return { 0: [fam('P')], 1: [m[2]] };
  if (familia === 'R') return { 0: [fam('R')], 1: [m[2]] };
  if (!m[2].includes('/')) return null;
  const p = partirClave(s);
  if (!p.emisor || !p.denominacion) return null;
  const registro = p.registro ?? registroDe(s);
  const franja = franjaDe(p.denominacion);
  return { 0: [fam('E')], 1: [p.emisor], 2: [p.denominacion], ...(registro ? { 5: [registro] } : {}), ...(franja ? { 7: [franja] } : {}) };
}

/** El payload de la época: la décupla misma, o lo que expone su cargador (src/epocas.js, cargarEpocaBtml). */
function payloadDeEpoca(epoch) {
  if (Array.isArray(epoch)) return epoch;
  return epoch?.registro ?? epoch?.payload ?? null;
}

/**
 * Contexto del BQL mínimo sobre un eje (o sin eje: solo payloads y
 * despliegues). `ev` es la transacción candidata (un evento, aún fuera del eje:
 * el eje es el libro de antes); `epoch`, la época (su décupla o el objeto de
 * cargarEpocaBtml).
 */
export class ContextoEje {
  #eje;
  #ev;
  #epoch;
  #presupuesto = null; // el de la evaluación en curso (src/bqlm.js, Presupuesto)

  constructor(eje = null, { ev, epoch } = {}) {
    this.#eje = eje ?? null;
    this.#ev = ev ?? null;
    this.#epoch = epoch ? payloadDeEpoca(epoch) : null;
  }

  /** El nodo de 'ev', 'epoch' o 'before', o undefined si este contexto no lo tiene. */
  nombre(n) {
    if (n === 'ev') return this.#ev ? CANDIDATA : undefined;
    if (n === 'epoch') return this.#epoch ? EPOCA : undefined;
    if (n === 'before') return this.#eje ? ANTES : undefined;
    return undefined;
  }

  /**
   * Ocupantes de la posición `camino` (dígitos 0-9) de un nodo, por llegada.
   * Se baja un dígito cada vez y lo que queda del camino se aplica a cada
   * ocupante, así que X.a.b es siempre (X.a).b. Además, en un registro, lo
   * escrito anclado exactamente en el camino entero, aunque el payload no
   * tenga una décupla por el medio (como encaje.ocupantes con `exacto`).
   */
  ocupantes(nodo, camino, presupuesto) {
    if (presupuesto && presupuesto !== this.#presupuesto) {
      const antes = this.#presupuesto;
      this.#presupuesto = presupuesto;
      try {
        return this.ocupantes(nodo, camino, presupuesto);
      } finally {
        this.#presupuesto = antes;
      }
    }
    if (!this.#presupuesto) return this.ocupantes(nodo, camino, new Presupuesto());
    if (!camino.length) return [nodo];
    if (camino.length > ARIDAD) throw pendiente('más de diez profundidades: ' + camino.join('.'));
    const [d, ...resto] = camino;
    const cabeza = this.#un(nodo, d);
    this.#presupuesto.gastar(cabeza.length);
    if (!resto.length) return cabeza;
    const fuera = cabeza.flatMap((o) => this.ocupantes(o, resto));
    const raiz = this.#raizDe(nodo);
    if (raiz) {
      const ya = new Set(fuera.filter((o) => o?.k === 'reg').map((o) => o.id));
      for (const h of this.#escritos(raiz.id, [...raiz.camino, ...camino])) if (!ya.has(h.id)) fuera.push(h);
    }
    return fuera;
  }

  /** Los ocupantes del dígito d de un nodo. */
  #un(nodo, d) {
    if (typeof nodo === 'string') return this.#deTexto(nodo, d);
    if (nodo === null || typeof nodo !== 'object') return [];
    switch (nodo.k) {
      case 'serie':
        // Vista del libro (familia ciclo, encargo 2): el 8 de una serie del libro es lo emitido hasta antes de ev.
        if (d === 8) return this.#eje ? [this.#eje.serie(nodo.clave).emitido] : [];
        return desplegarSerie(nodo.clave, (k) => this.#eje?.registroDe(k) ?? null, { delLibro: true })?.[d] ?? [];
      case 'ev':
        return [...this.#meta(this.#ev, d), ...this.#propio(this.#ev.payload, d, null, [])];
      case 'reg': {
        const e = this.#eje.obtener(nodo.id);
        return [...this.#meta(e, d), ...this.#vistasDeRegistro(nodo.id, d), ...this.#propio(e.payload, d, nodo.id, []), ...this.#escritos(nodo.id, [d])];
      }
      case 'epoch':
        return this.#propio(this.#epoch, d, null, []);
      case 'dec':
        return [...this.#propio(nodo.v, d, nodo.id, nodo.camino), ...(nodo.id ? this.#escritos(nodo.id, [...nodo.camino, d]) : [])];
      default:
        return this.#posicion(nodo, d);
    }
  }

  /** Dónde está un nodo en un registro del eje ({ id, camino }), para lo escrito anclado; null si no está en ninguno. */
  #raizDe(nodo) {
    if (nodo?.k === 'reg') return { id: nodo.id, camino: [] };
    if (nodo?.k === 'dec' && nodo.id) return { id: nodo.id, camino: nodo.camino };
    if (typeof nodo === 'string' && RE_ID.test(nodo) && this.#eje?.obtener(nodo)) return { id: nodo, camino: [] };
    return null;
  }

  /** El registro padre (por `sobre`, el ancla 6.5), null en el génesis, undefined si no es un registro. */
  padre(nodo) {
    const e = this.#evento(nodo);
    if (!e) return undefined;
    if (e.sobre === null || e.sobre === undefined) return null;
    if (!this.#eje?.obtener(e.sobre)) throw pendiente('up: el foco ' + String(e.sobre).slice(0, 8) + ' no está en el eje');
    return { k: 'reg', id: e.sobre };
  }

  /** Los registros anclados sobre él, por llegada; undefined si no es un registro. */
  hijos(nodo) {
    if (nodo?.k === 'ev') return [];
    const e = this.#evento(nodo);
    if (!e) return undefined;
    return this.#eje.sobre(e.id).map((h) => ({ k: 'reg', id: h.id }));
  }

  /** El valor de un nodo: el id de un registro (o de la candidata, si lo tiene); una décupla no tiene. */
  valor(nodo) {
    if (nodo?.k === 'reg') return nodo.id;
    if (nodo?.k === 'serie') return nodo.clave;
    if (nodo?.k === 'ev') return this.#ev.id;
    return undefined;
  }

  /** Cómo se escribe un nodo en un mensaje. */
  texto(nodo) {
    switch (nodo?.k) {
      case 'reg': return nodo.id;
      case 'ev': return this.#ev.id ?? 'ev';
      case 'epoch': return 'epoch';
      case 'before': return 'before';
      case 'dec': return JSON.stringify(nodo.v);
      case 'mov': return primitivaDe(nodo.m) + ' ' + nodo.m.cantidad + ' ' + claveToken(nodo.m) + ' (' + (nodo.m.de ?? 'nadie') + ' → ' + (nodo.m.a ?? 'nadie') + ')';
      case 'serie': return nodo.clave;
      case 'entrada': return nodo.clave;
      case 'viva': return nodo.clave;
      case 'bloqueo': return nodo.salida;
      default: return '«' + (nodo?.k ?? 'nodo') + '»';
    }
  }

  // ---------- registros ----------

  /** El evento de un nodo registro (o de la candidata, o de un texto que es el id de un registro), o undefined. */
  #evento(nodo) {
    if (nodo?.k === 'ev') return this.#ev;
    if (nodo?.k === 'reg') return this.#eje.obtener(nodo.id);
    if (typeof nodo === 'string' && RE_ID.test(nodo)) return this.#eje?.obtener(nodo);
    return undefined;
  }

  /** D-META: los ocupantes implícitos del dígito d de un evento. */
  #meta(e, d) {
    if (d === 1) return (Array.isArray(e.movimientos) ? e.movimientos : []).map((m, i) => ({ k: 'mov', m, i }));
    if (d === 3) return [e.autor, ...(e.firmante ? [e.firmante] : [])];
    if (d === 5) return e.id ? [e.id] : [];
    if (d === 6) return [{ k: 'meta6', e }];
    return [];
  }

  /** Vista de un registro: en su 1, las series de E atadas a él y vivas a la fecha de ev. */
  #vistasDeRegistro(id, d) {
    if (d !== 1) return [];
    const t = this.#ev?.t;
    return this.#eje.series()
      .filter((s) => s.token === 'E' && s.registro === id)
      .map((s) => ({ k: 'viva', clave: s.clave, vivo: this.#eje.vivo(s.clave, t), caduca: s.caduca }))
      .filter((s) => s.vivo > 0);
  }

  /** Lo escrito anclado exactamente en `camino` del registro `id` (un camino que acaba en 0 no es exacto: colisiona con el de arriba). */
  #escritos(id, camino) {
    if (!this.#eje || !camino.length || camino.length > ARIDAD) return [];
    const en = direccion(camino);
    if (indicesDe(en).length !== camino.length) return [];
    return this.#eje.sobre(id, en).map((h) => ({ k: 'reg', id: h.id }));
  }

  /**
   * Lo propio del dígito d de una décupla del payload (la raíz o una de más
   * abajo): una lista da sus elementos; una referencia, lo que alcanza; una
   * décupla, un ocupante que sabe dónde está (`id` y `camino`: para lo escrito
   * anclado más abajo; id null si no está en el eje); una hoja, ella misma.
   * Un payload que es un terminal no tiene posiciones.
   */
  #propio(decupla, d, id, camino) {
    if (!Array.isArray(decupla)) return [];
    return this.#expandir(decupla[d], id, [...camino, d], 0);
  }

  /** Los ocupantes que da un nodo del payload en una posición. */
  #expandir(nodo, id, camino, saltos) {
    if (nodo === undefined) return [];
    if (esReferencia(nodo)) return this.#seguir(nodo, saltos);
    if (!Array.isArray(nodo)) return [nodo];
    if (esLista(nodo)) {
      // Lo que devuelve cada referencia se cobra en #seguir, también cuando
      // está memoizada (SEG-13): una lista de referencias al mismo registro
      // grande no sale gratis.
      this.#presupuesto.gastar(nodo.length);
      return nodo.flatMap((x) => this.#expandir(x, null, [], saltos));
    }
    return [{ k: 'dec', id, camino, v: nodo }];
  }

  /**
   * Lo que alcanza una referencia: el registro entero (sin dirección), o lo que
   * hay en esa dirección de su payload (como encaje.seguir: no entra en una
   * lista, y no trae lo escrito anclado allí).
   */
  #seguir(ref, saltos) {
    const llave = ref.ref + '|' + (ref.dir ?? '');
    const memo = this.#presupuesto.memo;
    if (memo.has(llave)) {
      const hecho = memo.get(llave);
      if (hecho === EN_CURSO) throw pendiente('referencias en ciclo: ' + ref.ref.slice(0, 8));
      this.#presupuesto.gastar(hecho.length); // el resultado cuenta aunque no se recalcule (SEG-13)
      return hecho;
    }
    this.#presupuesto.gastar(1);
    memo.set(llave, EN_CURSO);
    try {
      const fuera = this.#seguirSin(ref, saltos);
      memo.set(llave, fuera);
      return fuera;
    } catch (e) {
      memo.delete(llave);
      throw e;
    }
  }

  /** Seguir una referencia, sin la memoria. */
  #seguirSin(ref, saltos) {
    if (saltos >= MAX_SALTOS) throw pendiente('más de ' + MAX_SALTOS + ' referencias encadenadas');
    const destino = this.#eje?.obtener(ref.ref);
    if (!destino) throw pendiente('referencia a un evento ausente del eje: ' + ref.ref.slice(0, 8));
    if (!ref.dir || !indicesDe(ref.dir).length) return [{ k: 'reg', id: ref.ref }];
    return this.#expandir(resolver(destino.payload, ref.dir), null, indicesDe(ref.dir), saltos + 1);
  }

  // ---------- textos: despliegues, registros e identidades ----------

  /** El dígito d de un texto: su despliegue (fecha, serie), el registro que nombra, la identidad que es o su valor. */
  #deTexto(s, d) {
    const tabla = desplegarFecha(s) ?? desplegarSerie(s, (k) => this.#eje?.registroDe(k) ?? null);
    if (tabla) return tabla[d] ?? [];
    if (RE_ID.test(s) && this.#eje?.obtener(s)) return this.#un({ k: 'reg', id: s }, d);
    if (this.#eje?.alta(s)) return this.#deIdentidad(s, d);
    return desplegarValor(s)?.[d] ?? [];
  }

  /** Vistas del libro como posiciones de una identidad: 1 la cartera, 6 su alta (el registro que la abrió), 7 el tiempo gastado hoy. */
  #deIdentidad(a, d) {
    if (d === 1) return this.#cartera(a);
    if (d === 6) {
      // «pasado: de dónde viene (quién la dio de alta)», epoch.3.6 (familia ciclo, encargo 2): A.6.6.0 es el t del alta, A.6.3 su autor.
      const alta = this.#eje.alta(a);
      return alta && this.#eje.obtener(alta.id) ? [{ k: 'reg', id: alta.id }] : [];
    }
    if (d === 7) return [{ k: 'tiempo', id: a }];
    return [];
  }

  /**
   * La cartera de una identidad: un ocupante por serie con algo disponible o
   * bloqueado, en el orden en que la recibió. La da el libro (libro.vista,
   * «lo que será la posición 1 de su alta»); un eje sin libro, sus saldos.
   */
  #cartera(a) {
    if (typeof this.#eje.libro?.vista === 'function') {
      return Object.entries(this.#eje.libro.vista(a)).map(([clave, { disponible, bloqueado }]) => ({ k: 'entrada', clave, disponible, bloqueado }));
    }
    const claves = [];
    for (const [clave, n] of this.#eje.saldos?.get(a) ?? []) if (n !== 0) claves.push(clave);
    for (const b of this.#eje.bloqueos(a)) if (!claves.includes(b.clave)) claves.push(b.clave);
    return claves.map((clave) => ({
      k: 'entrada',
      clave,
      disponible: this.#eje.saldo(a, clave),
      bloqueado: Object.fromEntries(this.#eje.bloqueos(a).filter((b) => b.clave === clave).map((b) => [b.salida, b.cantidad])),
    }));
  }

  // ---------- nodos de las vistas y de los despliegues ----------

  /** Los ocupantes del dígito d de un nodo que no es un registro ni una décupla del payload. */
  #posicion(nodo, d) {
    switch (nodo.k) {
      case 'before':
        if (d === 3) return this.#eje.identidades();
        if (d === 5) return this.#eje.genesisId ? [this.#eje.genesisId] : [];
        if (d === 6) return [{ k: 'reloj' }];
        return [];
      case 'reloj': {
        const ms = this.#eje.tMaximo();
        return d === 0 && Number.isFinite(ms) ? [new Date(ms).toISOString()] : [];
      }
      case 'meta6':
        if (d === 0) return nodo.e.t === undefined ? [] : [nodo.e.t];
        if (d === 5) return [...(nodo.e.sobre ? [nodo.e.sobre] : []), nodo.e.en ?? '0000000000'];
        return [];
      case 'mov':
        return this.#movimiento(nodo.m, d);
      case 'par':
        return d === 0 ? [nodo.de ?? NADIE] : d === 1 ? [nodo.a ?? NADIE] : [];
      case 'entrada':
        if (d === 0) return [{ k: 'serie', clave: nodo.clave }];
        if (d === 1) return [nodo.disponible];
        if (d === 2) return Object.entries(nodo.bloqueado).filter(([, cantidad]) => cantidad > 0).map(([salida, cantidad]) => ({ k: 'bloqueo', salida, cantidad }));
        return [];
      case 'bloqueo':
        return d === 0 ? [nodo.salida] : d === 1 ? [nodo.cantidad] : [];
      case 'tiempo': {
        if (d >= ESCALAS_REALES.length) return [];
        const dia = this.#ev ? diaCivil(this.#ev.t) : NaN;
        if (!Number.isFinite(dia)) throw pendiente('A.7 se lee a la fecha de la transacción (ev.6.0.3), y no hay ev con fecha');
        return [this.#eje.gastadoT(nodo.id, ESCALAS_T[d], dia)];
      }
      case 'viva':
        return d === 0 ? [{ k: 'serie', clave: nodo.clave }] : d === 1 ? [nodo.vivo] : d === 7 && nodo.caduca ? [nodo.caduca] : [];
      default:
        return [];
    }
  }

  /** D-MOV: el dígito d de un movimiento. */
  #movimiento(m, d) {
    switch (d) {
      case 0: return [{ k: 'serie', clave: claveToken(m) }];
      case 1: return [m.cantidad];
      case 2: return [m.estado, m.salida, m.caduca].filter((x) => x !== undefined);
      case 3: return [{ k: 'par', de: m.de, a: m.a }];
      case 4: return [SIMBOLOS[primitivaDe(m)]];
      case 5: {
        if (m.token !== 'E') return [];
        const registro = m.registro ?? this.#eje?.registroDe(claveToken(m));
        return registro ? [registro] : [];
      }
      case 7: return [m.caduca ?? m.refiere].filter((x) => x !== undefined);
      case 9: return m.nota === undefined ? [] : [m.nota];
      default: return [];
    }
  }
}
