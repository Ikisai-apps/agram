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
//            ámbito (P), 2 denominación (E) u origen (P: quien lo obtuvo), 5 registro, 7 franja
//   D-FECHA  un instante como décupla: k = el número de periodo de la escala k desde 1970-01-01T00:00Z
//            (0 segundo, 1 minuto, 2 hora, 3 día civil, 4 semana, 5 ciclo de 28 días, 6 año de 364 + 1)
//   D-VALOR  un terminal «12 EUR» o «EUR 12»: 1 cuánto, 2 unidad (solo lectura)
//   vistas   de una identidad A: A.1 la cartera (un ocupante por serie: 0 serie, 1 disponible,
//            2 bloqueado, uno por salida: 0 salida, 1 cuánto), A.2.1 su P posicionado (por registro,
//            con sus orígenes en el 6), A.2.6 el P de su origen en todas las manos (encargo 3b-bis;
//            su reparto en A.2.6.8), A.6 su alta (el registro que abrió su
//            cuenta: A.6.6.0 su t, A.6.3 su autor), A.7.e el T de la escala e gastado de la
//            asignación del día civil de ev.6.0.3, A.8.6 lo recibido de su emisor por serie de E y R
//            (0 serie, 1 neto, 3 emisor; la base del tope de la obtención, VG tras 3b-bis); de un
//            registro X: X.1 sus series de E atadas y vivas
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
// series, serie, vivo, registroDe, sobre, identidades, tMaximo, genesisId,
// obtenidoPor, recibidoDelEmisor; sin libro, saldos, saldo y bloqueos).
// Lo que el libro tendría que dar y hoy se lee aparte: docs/BQLM.md §7,
// «Pendiente de integrar». No lee el tipo de ninguna identidad (R10).

import { ARIDAD, esReferencia, esLista, direccion, indicesDe, resolver } from './btml.js';
import { ESCALAS_T, ESCALAS_REALES, SEGUNDOS, claveToken, partirClave, franjaDe, diaCivil, validarMovimiento } from './tokens.js';
import { esInstante, msUTC } from './instante.js';
import { contenido } from './modos.js';
import { pendiente, Parada, Presupuesto, SIMBOLOS, NADIE, leerRegla, posicionDeLectura, nombreDeRegla } from './bqlm.js';

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
  if (familia === 'P') {
    // El P guarda su origen (encargo 3b-bis): 1 el registro donde está, 2 quien lo obtuvo.
    const p = partirClave(s);
    return { 0: [fam('P')], 1: [p.ambito], ...(p.origen ? { 2: [p.origen] } : {}) };
  }
  if (familia === 'R') return { 0: [fam('R')], 1: [m[2]] };
  if (!m[2].includes('/')) return null;
  const p = partirClave(s);
  if (!p.emisor || !p.denominacion) return null;
  const registro = p.registro ?? registroDe(s);
  const franja = franjaDe(p.denominacion);
  return { 0: [fam('E')], 1: [p.emisor], 2: [p.denominacion], ...(registro ? { 5: [registro] } : {}), ...(franja ? { 7: [franja] } : {}) };
}

/** La huella de una clave pública (como autoridad.huella): los ocho primeros caracteres de su x. */
const huella = (jwk) => String(jwk?.x ?? '').slice(0, 8) || '?';

/** Las claves públicas que declara un evento (contexto.claves), como nodos: titular, clave y prueba de posesión. */
function llavesDe(e) {
  const claves = e?.contexto?.claves;
  if (!claves || typeof claves !== 'object' || Array.isArray(claves)) return [];
  const pruebas = e.posesion && typeof e.posesion === 'object' && !Array.isArray(e.posesion) ? e.posesion : {};
  return Object.entries(claves).map(([titular, jwk]) => ({ k: 'llave', titular, jwk, prueba: Object.hasOwn(pruebas, titular) ? pruebas[titular] : undefined }));
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

  #idEpoca = null; // el id de la raíz de la época (encargo 3b): lo que referencia una invitación
  #registrosDeEpoca; // id → registro (las reglas del 2 de la época, src/epocas.js): lo que alcanza una referencia del 2
  #lecturas = new Map(); // «X.6.1» → las lecturas de la época (B5) que se materializan ahí
  #leyendo = new Set(); // las lecturas en curso (regla y sujeto): una que vuelve sobre sí misma es PENDIENTE

  constructor(eje = null, { ev, epoch } = {}) {
    this.#eje = eje ?? null;
    this.#ev = ev ?? null;
    this.#epoch = epoch ? payloadDeEpoca(epoch) : null;
    this.#registrosDeEpoca = epoch?.registros instanceof Map ? epoch.registros : new Map();
    this.#idEpoca = typeof epoch?.id === 'string' ? epoch.id : null;
    for (const regla of Array.isArray(epoch?.lecturas) ? epoch.lecturas : []) {
      const donde = posicionDeLectura(regla);
      if (typeof donde !== 'string') continue;
      if (!this.#lecturas.has(donde)) this.#lecturas.set(donde, []);
      this.#lecturas.get(donde).push(regla);
    }
  }

  /** ¿Hay lecturas que se materializan bajo «letra.d»? */
  #hayLecturas(letra, d) {
    for (const donde of this.#lecturas.keys()) if (donde.startsWith(letra + '.' + d + '.')) return true;
    return false;
  }

  /** Cómo se nombra un sujeto de lectura (para no volver sobre sí misma): una identidad, la candidata o un nodo. */
  #llaveDeSujeto(sujeto) {
    if (typeof sujeto === 'string') return sujeto;
    if (sujeto.k === 'ev') return 'ev';
    return [sujeto.k, sujeto.id ?? '', sujeto.titular ?? sujeto.origen ?? '', sujeto.registro ?? sujeto.serie ?? '', sujeto.decision ?? ''].join('|');
  }

  /**
   * B5 (VG, 10-11): lo que dan las lecturas de la época que se materializan en «letra.d1.d2» (X un registro o la
   * candidata, A una identidad), leídas del sujeto en este mismo contexto. Una lectura que no se resuelve deja la
   * posición como ella (PENDIENTE o ERROR).
   */
  #lectura(letra, sujeto, d1, d2) {
    return this.#lecturaEn(letra + '.' + d1 + '.' + d2, sujeto);
  }

  /** Lo que dan las lecturas de la época que se materializan en la posición `donde` («X.2.4.8», «A.2.6.8»…) de `sujeto`. */
  #lecturaEn(donde, sujeto) {
    const reglas = this.#lecturas.get(donde);
    if (!reglas) return [];
    const fuera = [];
    for (const regla of reglas) {
      const clave = nombreDeRegla(regla) + '|' + this.#llaveDeSujeto(sujeto);
      if (this.#leyendo.has(clave)) throw pendiente('la lectura ' + nombreDeRegla(regla) + ' vuelve sobre sí misma');
      this.#leyendo.add(clave);
      let r;
      const presupuesto = this.#presupuesto;
      try {
        r = leerRegla(regla, sujeto, this);
      } finally {
        this.#leyendo.delete(clave);
        this.#presupuesto = presupuesto;
      }
      if (r.estado !== 'RESUELTO') throw new Parada(r.estado, r.motivo, r.subtipo);
      fuera.push(...r.valor);
    }
    return fuera;
  }

  /** B6: [{ k: 'bloqueados', salida, clave, cantidad, titulares }], uno por salida y serie con algo bloqueado, por llegada de su titular. */
  #bloqueadosPorSalida() {
    const porLlave = new Map();
    for (const id of this.#eje.identidades()) {
      for (const b of this.#eje.bloqueos(id)) {
        const llave = b.salida + '\u0000' + b.clave;
        if (!porLlave.has(llave)) porLlave.set(llave, { k: 'bloqueados', salida: b.salida, clave: b.clave, cantidad: 0, titulares: [] });
        const x = porLlave.get(llave);
        x.cantidad += b.cantidad;
        if (!x.titulares.includes(id)) x.titulares.push(id);
      }
    }
    return [...porLlave.values()];
  }

  /** El sujeto de una lectura de registro: la candidata o el registro del eje. */
  #sujetoDe(e) {
    return e === this.#ev ? CANDIDATA : { k: 'reg', id: e.id };
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
        return this.#serie(nodo.clave, d);
      case 'clave':
        // El 0 de una serie: su clave legible, por partes (0 familia, 1 escala, emisor o ámbito, 2 denominación).
        return desplegarSerie(nodo.clave, () => null, { delLibro: true })?.[d] ?? [];
      case 'cuanto':
        // El 1 de una serie: 0 lo emitido y 1 lo consumido, hasta antes de ev.
        return d === 0 ? [nodo.emitido] : d === 1 ? [nodo.consumido] : [];
      case 'contrato':
        // El 2 de una serie de E: 0 «divisible» si lo es, 7 su caducidad si la tiene.
        return d === 0 && nodo.divisible ? ['divisible'] : d === 7 && nodo.caduca ? [nodo.caduca] : [];
      case 'fechas':
        // El 7 de un movimiento: 0 la caducidad (de una emisión de E), 1 la fecha a la que se refiere (T informativo).
        return d === 0 && nodo.m.caduca !== undefined ? [nodo.m.caduca] : d === 1 && nodo.m.refiere !== undefined ? [nodo.m.refiere] : [];
      case 'ev':
        // B4: el 5 de un evento es solo suyo (su id y las claves que declara): ni el payload ni lo anclado lo ocupan.
        if (d === 5) return this.#meta(this.#ev, d);
        return [...this.#meta(this.#ev, d), ...this.#propio(this.#ev.payload, d, null, [])];
      case 'reg': {
        const e = this.#eje.obtener(nodo.id);
        // B4: el alta de una identidad, leída desde ella (A.6), tiene en su 5 solo su id y la clave de esa identidad:
        // ni lo que el payload ni lo que otros anclen ahí se confunde con su clave.
        if (nodo.titular !== undefined && d === 5) return [nodo.id, ...llavesDe(e).filter((l) => l.titular === nodo.titular)];
        // Suelo de persistencia (VG, 10-11, A4 y B1): un alta del prefijo de la versión 2 declaraba el tipo; leída desde
        // su identidad, su 3 es esa declaración en la convención de ahora: una persona escribió su propia alta; lo
        // demás, otro (su autor, o «nadie» si fue ella misma).
        if (nodo.titular !== undefined && d === 3 && this.#eje.esDeV2?.(nodo.id)) {
          const persona = this.#eje.esPersona(nodo.titular) === true;
          return [persona ? nodo.titular : e.autor !== nodo.titular ? e.autor : NADIE, NADIE];
        }
        if (d === 5) return this.#meta(e, d);
        return [...this.#meta(e, d), ...this.#vistasDeRegistro(nodo.id, d), ...this.#propio(e.payload, d, nodo.id, []), ...this.#escritos(nodo.id, [d])];
      }
      case 'epoch':
        return this.#propio(this.#epoch, d, null, []);
      case 'regla':
        // Un registro de la época: lo suyo, con sus correcciones detrás (el cargador las pone en su posición).
        return this.#propio(nodo.v, d, null, []);
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
    if (nodo?.k === 'reg' || nodo?.k === 'regla') return nodo.id;
    if (nodo?.k === 'serie' || nodo?.k === 'clave' || nodo?.k === 'salida') return nodo.clave;
    if (nodo?.k === 'llave') return huella(nodo.jwk);
    if (nodo?.k === 'bloqueados') return nodo.salida;
    if (nodo?.k === 'origenP') return nodo.origen;
    if (nodo?.k === 'ev') return this.#ev.id;
    return undefined;
  }

  /** Cómo se escribe un nodo en un mensaje. */
  texto(nodo) {
    switch (nodo?.k) {
      case 'reg': return nodo.id;
      case 'regla': return nodo.id;
      case 'ev': return this.#ev.id ?? 'ev';
      case 'epoch': return 'epoch';
      case 'before': return 'before';
      case 'dec': return JSON.stringify(nodo.v);
      case 'mov': return primitivaDe(nodo.m) + ' ' + nodo.m.cantidad + ' ' + claveToken(nodo.m) + ' (' + (nodo.m.de ?? 'nadie') + ' → ' + (nodo.m.a ?? 'nadie') + ')';
      case 'serie': return nodo.clave;
      case 'clave': return nodo.clave;
      case 'salida': return String(nodo.clave);
      case 'llave': return 'clave ' + huella(nodo.jwk) + ' de ' + nodo.titular;
      case 'bloqueados': return nodo.cantidad + ' ' + nodo.clave + ' con la salida ' + nodo.salida;
      case 'entrada': return nodo.clave;
      case 'viva': return nodo.clave;
      case 'bloqueo': return nodo.salida;
      case 'posicionado': return 'P de ' + nodo.titular + ' en ' + String(nodo.registro).slice(0, 8);
      case 'origenP': return nodo.origen;
      case 'obtenido': return 'P de origen ' + nodo.origen + ' en ' + String(nodo.registro).slice(0, 8);
      case 'frente': return nodo.id + ' frente a otros';
      case 'recibido': return nodo.neto + ' ' + nodo.clave + ' de ' + nodo.emisor;
      case 'grupo': return 'grupo ' + nodo.zona + ' de ' + nodo.titular;
      case 'compromiso': return nodo.cantidad + ' ' + nodo.serie + ' de ' + nodo.titular + ' con ' + String(nodo.decision).slice(0, 8);
      case 'ocho': return 'frente a otros de ' + String(nodo.e.id ?? 'ev').slice(0, 8);
      case 'medida': return 'medida de ' + String(nodo.e.id ?? 'ev').slice(0, 8);
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
    // B4 (VG, 10-11): el firmante es el segundo ocupante del 3, siempre: «nadie» si no va firmado (así nada del
    // payload ocupa su sitio).
    if (d === 3) return [e.autor, e.firma && e.firmante ? e.firmante : NADIE];
    // B4: en el 5, el id y las claves públicas que el registro declara (en un alta: la de quien la escribe para sí,
    // o la de la cosa que da de alta), cada una con su titular (3) y su prueba de posesión (4).
    // El id va siempre primero («nadie» si la candidata aún no lo tiene): las claves son el resto.
    if (d === 5) return [e.id ?? NADIE, ...llavesDe(e)];
    if (d === 6) return [{ k: 'meta6', e }];
    // Encargo 3b (mapa §15, «P como peso de criterio»): en el 2 de un registro, 2.4 los compromisos con él (el P
    // bloqueado con la salida = su id, de cualquiera) y las lecturas que la época pone en el 2.
    if (d === 2 && e.id && this.#eje?.obtener(e.id)) return [{ k: 'criterioX', e }];
    // B6: el 7, el futuro del registro: 7.1 las series vivas de su subárbol; y las lecturas que la época pone en el 7.
    if (d === 7) return [{ k: 'futuro', e }];
    // Encargo 3c-1: el 8, frente a otros: 8.6 la medida bruta de la madurez (de dónde viene) y las lecturas que la
    // época pone en el 8 (X.8.1, «maturity»).
    if (d === 8) return [{ k: 'ocho', e }];
    // B5: una posición donde la época materializa lecturas del registro tiene su nodo implícito.
    if (this.#hayLecturas('X', d)) return [{ k: 'lectura', letra: 'X', sujeto: this.#sujetoDe(e), d }];
    return [];
  }

  /**
   * El reloj de la caducidad (SEG-03, SEG-05, RL-4): el menor entre el t de la candidata y el reloj de los demás
   * (el mayor t del libro entre las identidades que no son su autor ni emiten la E que ella acuña). Sin los demás
   * no hay reloj y nada caduca: undefined. Como src/condiciones/tope.js.
   */
  #relojDeCaducidad() {
    const demas = this.#relojDeLosDemas();
    const t = this.#ev?.t;
    if (!Number.isFinite(demas) || !esInstante(t)) return undefined;
    return new Date(Math.min(msUTC(t), demas)).toISOString();
  }

  /** El reloj de los demás, en milisegundos (-Infinity si no hay ninguno): el mayor t de las identidades que no son el autor de la candidata ni emiten la E que acuña. */
  #relojDeLosDemas() {
    const excluidos = new Set(this.#ev ? [this.#ev.autor] : []);
    for (const m of Array.isArray(this.#ev?.movimientos) ? this.#ev.movimientos : []) {
      if (!m || m.token !== 'E' || m.de !== null) continue;
      excluidos.add(m.emisor);
      for (const x of Array.isArray(m.emisores) ? m.emisores : []) excluidos.add(x);
    }
    return this.#eje.tMaximo([...excluidos]);
  }

  /** Las series de E vivas (con el reloj de la caducidad) atadas a uno de los registros `ids`. */
  #vivas(pertenece) {
    const t = this.#relojDeCaducidad();
    return this.#eje.series()
      .filter((s) => s.token === 'E' && s.registro && pertenece(s.registro))
      .map((s) => ({ k: 'viva', clave: s.clave, vivo: t === undefined ? this.#eje.vivo(s.clave) : this.#eje.vivo(s.clave, t), caduca: s.caduca }))
      .filter((s) => s.vivo > 0);
  }

  /** Vista de un registro: en su 1, las series de E atadas a él y vivas con el reloj de la caducidad. */
  #vistasDeRegistro(id, d) {
    if (d !== 1) return [];
    return this.#vivas((r) => r === id);
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
    // La época misma (su raíz, por su id: el 2 de una invitación, encargo 3b): se alcanza como epoch.
    if (this.#idEpoca && ref.ref === this.#idEpoca) {
      if (!ref.dir || !indicesDe(ref.dir).length) return [EPOCA];
      return this.#expandir(resolver(this.#epoch, ref.dir), null, indicesDe(ref.dir), saltos + 1);
    }
    // Un registro de la época (una regla del 2, VG 10-11, A1): se alcanza por su id, como un registro del eje.
    if (this.#registrosDeEpoca.has(ref.ref)) {
      const regla = this.#registrosDeEpoca.get(ref.ref);
      if (!ref.dir || !indicesDe(ref.dir).length) return [{ k: 'regla', id: ref.ref, v: regla }];
      return this.#expandir(resolver(regla, ref.dir), null, indicesDe(ref.dir), saltos + 1);
    }
    const destino = this.#eje?.obtener(ref.ref);
    if (!destino) throw pendiente('referencia a un evento ausente del eje: ' + ref.ref.slice(0, 8));
    if (!ref.dir || !indicesDe(ref.dir).length) return [{ k: 'reg', id: ref.ref }];
    return this.#expandir(resolver(destino.payload, ref.dir), null, indicesDe(ref.dir), saltos + 1);
  }

  // ---------- textos: despliegues, registros e identidades ----------

  // ---------- la serie como registro (VG, 10-11, B3) ----------

  /**
   * ¿Es `clave` una serie que existe: del libro de antes, o que la candidata
   * acuña? Entonces es un registro (#serie). Se recuerda por contexto.
   */
  #esSerie(clave) {
    if (!this.#seriesConocidas) this.#seriesConocidas = new Map();
    if (this.#seriesConocidas.has(clave)) return this.#seriesConocidas.get(clave);
    let r = null;
    if (desplegarSerie(clave)) {
      const delLibro = this.#eje && this.#eje.serie(clave).emisor !== null;
      const acunada = (Array.isArray(this.#ev?.movimientos) ? this.#ev.movimientos : [])
        .find((m) => m && typeof m === 'object' && m.de === null && !validarMovimiento(m).length && claveToken(m) === clave);
      if (delLibro || acunada) r = { delLibro, acunada };
    }
    this.#seriesConocidas.set(clave, r);
    return r;
  }

  #seriesConocidas = null;

  /**
   * El dígito d de una serie como registro (B3): 0 su clave legible (vale la
   * clave; 0.0 familia, 0.1 escala de T como dígito, emisor o ámbito, 0.2
   * denominación u origen), 1 lo emitido (1.0) y lo consumido (1.1) hasta antes de ev, 2
   * su contrato de E (2.0 «divisible», 2.7 caducidad), 3 sus emisores (en P, su origen: quien lo obtuvo), 5 el
   * registro al que está atada (E), 7 su franja (E). Lo materializa el libro
   * como vista; una serie que nace en la candidata, su primera emisión.
   */
  #serie(clave, d) {
    if (d === 0) return [{ k: 'clave', clave }];
    const p = desplegarSerie(clave);
    if (!p) return [];
    const conocida = this.#esSerie(clave);
    const libro = conocida?.delLibro ? this.#eje.serie(clave) : null;
    const m = conocida?.acunada;
    const familia = clave[0];
    if (d === 1) {
      const consumido = libro ? this.#eje.libro.sumas({ primitiva: 'quemar', serie: clave }) : 0;
      return [{ k: 'cuanto', emitido: libro ? libro.emitido : 0, consumido }];
    }
    if (familia === 'P') return d === 3 ? p[2] ?? [] : [];
    if (familia !== 'E' && familia !== 'R') return [];
    if (d === 3) {
      if (familia === 'R') return [...p[1]];
      return libro ? (libro.emisores ?? [libro.emisor]) : m ? (m.emisores ?? [m.emisor]) : [...p[1]];
    }
    if (familia !== 'E') return [];
    if (d === 2) {
      const contrato = libro ? { divisible: libro.divisible === true, caduca: libro.caduca ?? null } : m ? { divisible: m.divisible === true, caduca: m.caduca ?? null } : null;
      return contrato && (contrato.divisible || contrato.caduca) ? [{ k: 'contrato', ...contrato }] : [];
    }
    if (d === 5) {
      const registro = partirClave(clave).registro ?? (libro ? this.#eje.registroDe(clave) : null);
      return registro ? [registro] : [];
    }
    if (d === 7) return p[7] ?? [];
    return [];
  }

  /**
   * El dígito d de un texto: su despliegue (fecha), el registro que nombra, la
   * identidad que es o su valor. Una clave de serie escrita como texto ya no se
   * despliega (B3): la serie es un registro al que llegan el 0 de un
   * movimiento, de una entrada de la cartera o de una serie viva, y la salida
   * de un bloqueo; un texto del payload no la fabrica (SEG-09).
   */
  #deTexto(s, d) {
    const fecha = desplegarFecha(s);
    if (fecha) return fecha[d] ?? [];
    if (RE_ID.test(s) && this.#eje?.obtener(s)) return this.#un({ k: 'reg', id: s }, d);
    if (this.#eje?.alta(s)) return this.#deIdentidad(s, d);
    return desplegarValor(s)?.[d] ?? [];
  }

  /** Vistas del libro como posiciones de una identidad: 1 la cartera, 6 su alta (el registro que la abrió), 7 el tiempo gastado hoy. */
  #deIdentidad(a, d) {
    if (d === 1) return this.#cartera(a);
    // Encargo 3b (mapa §15): el 2 de una identidad es su criterio: 2.1 su P posicionado (una entrada por registro),
    // 2.3 las personas cuyos criterios adopta (la lente de criterios).
    if (d === 2) return [{ k: 'criterio', id: a }];
    // Encargo 3b (mapa §16 [D] «PV3 = regla de atención»): el 3 de una identidad son sus grupos de atención, uno por
    // zona: los de la época (epoch.1.2.1) y los que ella declara, con sus correcciones.
    if (d === 3) return this.#grupos(a);
    if (d === 6) {
      // «pasado: de dónde viene (quién la dio de alta)», epoch.3.6 (familia ciclo, encargo 2): A.6.6.0 es el t del alta, A.6.3 su autor.
      const alta = this.#eje.alta(a);
      return alta && this.#eje.obtener(alta.id) ? [{ k: 'reg', id: alta.id, titular: a }] : [];
    }
    if (d === 7) return [{ k: 'tiempo', id: a }];
    // El 8 de una identidad, frente a otros: 8.6 lo recibido de su emisor por serie (de dónde viene lo que tiene; VG
    // tras 3b-bis: la base del tope de la obtención) y las lecturas que la época pone ahí (A.8.1, «obligation»).
    if (d === 8) return [{ k: 'frente', id: a }];
    // B5: una posición donde la época materializa lecturas de la identidad.
    if (this.#hayLecturas('A', d)) return [{ k: 'lectura', letra: 'A', sujeto: a, d }];
    return [];
  }

  /**
   * Lo recibido de su emisor por una identidad (VG, tras 3b-bis: la obtención de P es un tope acumulado, diez por
   * unidad neta recibida del emisor): una entrada por serie de E o de R que le ha llegado alguna vez directamente de su
   * emisor, también la que ya no tiene; vale la serie (se indexa por su clave: A.8.6.(serie)). Lo que pasa entre
   * tenedores no cuenta. Lee el libro de antes de la candidata.
   */
  #recibidos(a) {
    if (typeof this.#eje?.recibidoDelEmisor !== 'function') return [];
    return this.#eje.recibidoDelEmisor(a).map((x) => ({ k: 'recibido', titular: a, clave: x.serie, emisor: x.emisor, recibido: x.recibido, devuelto: x.devuelto, neto: x.neto }));
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

  /**
   * El P posicionado de una identidad (encargo 3b, mapa §15): una entrada por registro sobre el que tiene P, en el
   * orden de su cartera; cada una con lo disponible y lo bloqueado por salida, sumando todos sus orígenes, y los
   * orígenes aparte (encargo 3b-bis: el P guarda quién lo obtuvo; lo delegado sigue siendo de quien lo obtuvo).
   */
  #posicionado(a) {
    const porRegistro = new Map();
    for (const x of this.#cartera(a)) {
      if (!x.clave.startsWith('P:')) continue;
      const { ambito: registro, origen } = partirClave(x.clave);
      if (!porRegistro.has(registro)) porRegistro.set(registro, { k: 'posicionado', titular: a, registro, disponible: 0, bloqueado: {}, origenes: [] });
      const e = porRegistro.get(registro);
      e.disponible += x.disponible;
      for (const [salida, c] of Object.entries(x.bloqueado)) e.bloqueado[salida] = (Object.hasOwn(e.bloqueado, salida) ? e.bloqueado[salida] : 0) + c;
      e.origenes.push({ k: 'origenP', titular: a, registro, origen: origen ?? a, clave: x.clave, disponible: x.disponible, bloqueado: x.bloqueado });
    }
    return [...porRegistro.values()];
  }

  /**
   * El P de origen `a` (encargo 3b-bis, VG 10-11: «el P guarda su origen»): lo que obtuvo `a`, esté en la mano que
   * esté, una entrada por registro (A.2.6). Sobre él se lee su reparto por dominio (la lectura «share», A.2.6.8).
   */
  #obtenidos(a) {
    if (typeof this.#eje?.obtenidoPor !== 'function') return [];
    return this.#eje.obtenidoPor(a).map((x) => ({ k: 'obtenido', origen: a, registro: x.registro, cantidad: x.cantidad, titulares: x.titulares }));
  }

  /**
   * Las personas cuyos criterios adopta una identidad (mapa §15: «tomar prestados criterios de quien tengo localizado»;
   * encargo 3b, la lente de criterios): los nombres que ella misma escribe en el 2.3 de su alta (en el payload o
   * anclados ahí por ella), por llegada.
   */
  #adoptados(a) {
    const alta = this.#eje.alta(a);
    const ev = alta && this.#eje.obtener(alta.id);
    if (!ev) return [];
    const nombres = [];
    const de = (x) => { for (const n of Array.isArray(x) ? x : [x]) if (typeof n === 'string' && n && !n.startsWith('=')) nombres.push(n); };
    if (Array.isArray(ev.payload) && Array.isArray(ev.payload[2]) && !esLista(ev.payload[2])) de(ev.payload[2][3]);
    for (const h of this.#eje.sobre(ev.id, direccion([2, 3]))) if (h.autor === a) de(h.payload);
    return nombres;
  }

  /**
   * Los grupos de atención de una identidad (mapa §16 [D]: «cada persona clasifica al mundo respecto a sí misma por
   * el precio de su atención»; encargo 3b): uno por zona, en su orden; las seis de la época (epoch.1.2.1: desconocidos
   * 0, comercial 1, expertos 2, cercanos 3, equipo 4, vetados 5) y las que la identidad abra con un precio propio
   * (anclando en el 3.k.2 de su alta).
   */
  #grupos(a) {
    const defecto = this.#epoch?.[1]?.[2]?.[1];
    const zonas = new Map();
    if (Array.isArray(defecto)) defecto.forEach((z, k) => { if (Array.isArray(z)) zonas.set(k, z); });
    const alta = this.#eje?.alta(a);
    if (alta) {
      for (let k = 0; k < ARIDAD; k++) {
        if (!zonas.has(k) && this.#eje.sobreDe(alta.id, direccion([3, k, 2]), new Set([a])).length) zonas.set(k, null);
      }
    }
    return [...zonas.keys()].sort((x, y) => x - y).map((k) => ({ k: 'grupo', titular: a, zona: k, defecto: zonas.get(k), alta: alta?.id ?? null }));
  }

  /** Lo que la identidad de un grupo ancla en el 3.k.d de su alta (d = 2, el precio; 3, quiénes), por llegada: su payload. */
  #corregido(grupo, d) {
    if (!grupo.alta) return [];
    const fuera = [];
    for (const h of this.#eje.sobreDe(grupo.alta, direccion([3, grupo.zona, d]), new Set([grupo.titular]))) {
      if (Array.isArray(h.payload) && !esLista(h.payload)) fuera.push({ k: 'dec', id: h.id, camino: [], v: h.payload });
      else fuera.push(...this.#expandir(h.payload, null, [], 0));
    }
    return fuera;
  }

  /** Los compromisos con un registro (mapa §15: «comprometer = bloquear con salida la decisión»): lo bloqueado con salida = su id. */
  #compromisos(id) {
    return this.#eje.bloqueosCon(id).map((b) => ({ k: 'compromiso', decision: id, titular: b.identidad, serie: b.clave, cantidad: b.cantidad }));
  }

  // ---------- nodos de las vistas y de los despliegues ----------

  /** Los ocupantes del dígito d de un nodo que no es un registro ni una décupla del payload. */
  #posicion(nodo, d) {
    switch (nodo.k) {
      case 'before':
        // 1, lo que hay: los registros del libro, por llegada (B5: «atendido» busca ahí quién cita una devolución).
        if (d === 1) return this.#eje.orden.map((id) => ({ k: 'reg', id }));
        // 2, con qué condición: lo bloqueado por salida y serie, sumado sobre todos los titulares (B6); vale su salida.
        if (d === 2) return this.#bloqueadosPorSalida();
        if (d === 3) return this.#eje.identidades();
        if (d === 5) return this.#eje.genesisId ? [this.#eje.genesisId] : [];
        if (d === 6) return [{ k: 'reloj' }];
        // 9, cómo es este libro: «demostración» si su génesis lo marca (sin clave se actúa; R9). Para el propio
        // génesis, que aún no está, lo que diga él.
        if (d === 9) {
          const demo = this.#eje.genesisId ? this.#eje.demostracion === true : this.#ev?.contexto?.genesis === true && this.#ev.contexto.demostracion === true;
          return demo ? ['demostración'] : [];
        }
        return [];
      case 'llave':
        // Una clave pública declarada (B4): 0 su huella, 3 su titular, 4 su prueba de posesión (si la lleva).
        return d === 0 ? [huella(nodo.jwk)] : d === 2 && typeof nodo.jwk?.x === 'string' ? [nodo.jwk.x] : d === 3 ? [nodo.titular] : d === 4 && nodo.prueba !== undefined ? [nodo.prueba] : [];
      case 'reloj': {
        // 0 el mayor t del libro; 3, «con quién»: el reloj de los demás (B6), sin el autor de la candidata ni quien
        // emite la E que acuña; nada si no hay ninguno.
        const ms = d === 0 ? this.#eje.tMaximo() : d === 3 ? this.#relojDeLosDemas() : NaN;
        return Number.isFinite(ms) ? [new Date(ms).toISOString()] : [];
      }
      case 'futuro': {
        // B6: 7.1 las series de E vivas del subárbol del registro (él y todo lo que cuelga de él), con el reloj de la
        // caducidad; lo demás, las lecturas que la época pone en X.7.d.
        if (d === 1) {
          const id = nodo.e.id;
          return id && this.#eje?.obtener(id) ? this.#vivas((r) => this.#eje.hilo(r).some((x) => x.id === id)) : [];
        }
        return this.#lectura('X', this.#sujetoDe(nodo.e), 7, d);
      }
      case 'bloqueados':
        // B6: lo bloqueado con una salida en una serie, sumado sobre todos los titulares: 0 la serie, 1 cuánto, 3 quiénes.
        return d === 0 ? [{ k: 'serie', clave: nodo.clave }] : d === 1 ? [nodo.cantidad] : d === 3 ? nodo.titulares : [];
      case 'meta6':
        if (d === 0) return nodo.e.t === undefined ? [] : [nodo.e.t];
        if (d === 5) return [...(nodo.e.sobre ? [nodo.e.sobre] : []), nodo.e.en ?? '0000000000'];
        // 6.4, «de dónde viene: qué se hace»: lo que el registro atiende (contexto.atiende, los ids que cita; RR-5).
        if (d === 4) {
          const atiende = nodo.e.contexto?.atiende;
          return (Array.isArray(atiende) ? atiende : atiende === undefined ? [] : [atiende]).filter((x) => typeof x === 'string');
        }
        // B5: las lecturas del registro que la época pone aquí (X.6.1 «present», X.6.7 «informative»).
        return this.#lectura('X', this.#sujetoDe(nodo.e), 6, d);
      case 'lectura':
        return this.#lectura(nodo.letra, nodo.sujeto, nodo.d, d);
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
        return d === 0 ? [{ k: 'salida', clave: nodo.salida }] : d === 1 ? [nodo.cantidad] : [];
      case 'salida':
        // La salida de un bloqueo vale su texto; si nombra una serie que existe, es la referencia a su registro (B3).
        return this.#esSerie(nodo.clave) ? this.#serie(nodo.clave, d) : [];
      case 'tiempo': {
        if (d >= ESCALAS_REALES.length) return [];
        const dia = this.#ev ? diaCivil(this.#ev.t) : NaN;
        if (!Number.isFinite(dia)) throw pendiente('A.7 se lee a la fecha de la transacción (ev.6.0.3), y no hay ev con fecha');
        return [this.#eje.gastadoT(nodo.id, ESCALAS_T[d], dia)];
      }
      case 'viva':
        return d === 0 ? [{ k: 'serie', clave: nodo.clave }] : d === 1 ? [nodo.vivo] : d === 7 && nodo.caduca ? [nodo.caduca] : [];
      case 'criterio':
        // El criterio de una identidad (A.2): 1 su P posicionado, 3 los criterios que adopta, 6 el P de su origen (de
        // dónde viene: lo que obtuvo, esté en la mano que esté; encargo 3b-bis).
        if (d === 1) return this.#posicionado(nodo.id);
        if (d === 3) return this.#adoptados(nodo.id);
        if (d === 6) return this.#obtenidos(nodo.id);
        return this.#lecturaEn('A.2.' + d, nodo.id);
      case 'frente':
        // El 8 de una identidad, frente a otros: 6 lo recibido de su emisor por serie (de dónde viene); lo demás, las
        // lecturas que la época pone en A.8.d (8.1, «obligation»: su R en manos de otros).
        if (d === 6) return this.#recibidos(nodo.id);
        return this.#lecturaEn('A.8.' + d, nodo.id);
      case 'recibido':
        // Una entrada de lo recibido de su emisor (A.8.6): 0 la serie, 1 cuánto neto (recibido del emisor menos
        // devuelto al emisor), 3 el emisor, 4 lo devuelto, 6 lo recibido.
        if (d === 0) return [{ k: 'serie', clave: nodo.clave }];
        if (d === 1) return [nodo.neto];
        if (d === 3) return [nodo.emisor];
        if (d === 4) return [nodo.devuelto];
        if (d === 6) return [nodo.recibido];
        return [];
      case 'posicionado':
        // Una entrada del P posicionado (A.2.1): 0 el registro, 1 cuánto (disponible y bloqueado), 2 lo bloqueado por
        // salida, 3 su titular, 4 lo disponible, 6 sus orígenes (encargo 3b-bis: uno por quien lo obtuvo, que vale su
        // nombre); lo demás, las lecturas que la época ponga ahí.
        if (d === 0) return [nodo.registro];
        if (d === 1) return [nodo.disponible + Object.values(nodo.bloqueado).reduce((x, y) => x + y, 0)];
        if (d === 2) return Object.entries(nodo.bloqueado).filter(([, c]) => c > 0).map(([salida, cantidad]) => ({ k: 'bloqueo', salida, cantidad }));
        if (d === 3) return [nodo.titular];
        if (d === 4) return [nodo.disponible];
        if (d === 6) return nodo.origenes;
        return this.#lecturaEn('A.2.1.' + d, nodo);
      case 'origenP':
        // Un origen del P posicionado (A.2.1.r.6): vale quien lo obtuvo; 0 la serie, 1 cuánto, 2 lo bloqueado por
        // salida, 3 su origen, 4 lo disponible.
        if (d === 0) return [{ k: 'serie', clave: nodo.clave }];
        if (d === 1) return [nodo.disponible + Object.values(nodo.bloqueado).reduce((x, y) => x + y, 0)];
        if (d === 2) return Object.entries(nodo.bloqueado).filter(([, c]) => c > 0).map(([salida, cantidad]) => ({ k: 'bloqueo', salida, cantidad }));
        if (d === 3) return [nodo.origen];
        if (d === 4) return [nodo.disponible];
        return [];
      case 'obtenido':
        // Una entrada del P de un origen (A.2.6): 0 el registro, 1 cuánto (en todas las manos, disponible y
        // bloqueado), 3 en qué manos está, 6 su origen; 8, la lectura que la época pone ahí (el reparto: «share»).
        if (d === 0) return [nodo.registro];
        if (d === 1) return [nodo.cantidad];
        if (d === 3) return [...nodo.titulares];
        if (d === 6) return [nodo.origen];
        return this.#lecturaEn('A.2.6.' + d, nodo);
      case 'criterioX':
        // El 2 de un registro, lo implícito: 2.4 los compromisos con él; lo demás, las lecturas de la época en X.2.d.
        if (d === 4) return this.#compromisos(nodo.e.id);
        return this.#lecturaEn('X.2.' + d, this.#sujetoDe(nodo.e));
      case 'grupo':
        // Un grupo de atención (A.3): 0 su nombre, 1 su zona, 2 su precio (el de la época y, detrás, lo que la identidad
        // ancla en el 3.k.2 de su alta: gana el último), 3 quiénes (lo que ancla en el 3.k.3).
        if (d === 0) return nodo.defecto ? this.#propio(nodo.defecto, 0, null, []) : [];
        if (d === 1) return [nodo.zona];
        if (d === 2) return [...(nodo.defecto ? this.#propio(nodo.defecto, 2, null, []) : []), ...this.#corregido(nodo, 2)];
        if (d === 3) return this.#corregido(nodo, 3);
        return [];
      case 'compromiso':
        // Un compromiso con una decisión (X.2.4): 0 la serie, 1 cuánto, 3 su titular, 5 la decisión; 8, la lectura que
        // la época pone ahí (el peso: «weight»).
        if (d === 0) return [{ k: 'serie', clave: nodo.serie }];
        if (d === 1) return [nodo.cantidad];
        if (d === 3) return [nodo.titular];
        if (d === 5) return [nodo.decision];
        return this.#lecturaEn('X.2.4.' + d, nodo);
      case 'ocho':
        // Encargo 3c-1: el 8 de un registro, lo implícito: 8.6 la medida bruta de su madurez (de dónde viene); lo
        // demás, las lecturas de la época en X.8.d (X.8.1, «maturity»: el nivel).
        if (d === 6) return [{ k: 'medida', e: nodo.e }];
        return this.#lectura('X', this.#sujetoDe(nodo.e), 8, d);
      case 'medida': {
        // La medida bruta de la madurez (encargo 3c-1): 1 cuánto, las posiciones escritas del registro y de todo lo
        // que cuelga de él; 4 qué se hace, las unidades que mueven sus transacciones; 5 dónde encaja, la profundidad
        // del subárbol en registros. Una vista, porque recorrerlo posición a posición en BQL mínimo reventaría el
        // presupuesto; la regla «maturity» solo convierte la medida en nivel.
        const m = this.#medidaDe(nodo.e);
        return d === 1 ? [m.posiciones] : d === 4 ? [m.cantidad] : d === 5 ? [m.profundidad] : [];
      }
      default:
        return [];
    }
  }

  /** La medida bruta de la madurez de un registro (o de la candidata): { posiciones, profundidad, cantidad } de su subárbol. */
  #medidaDe(e) {
    const llave = 'medida|' + (e.id ?? 'ev');
    const memo = this.#presupuesto.memo;
    if (memo.has(llave)) return memo.get(llave);
    const unidades = (ev) => (Array.isArray(ev.movimientos) ? ev.movimientos : []).reduce((s, m) => s + (m && Number.isFinite(m.cantidad) ? m.cantidad : 0), 0);
    const medida = { posiciones: contenido(e.payload), profundidad: 0, cantidad: unidades(e) };
    if (typeof e.id === 'string' && this.#eje?.obtener(e.id)) {
      const vistos = new Set([e.id]);
      const frente = [[e.id, 0]];
      while (frente.length) {
        const [id, nivel] = frente.shift();
        for (const h of this.#eje.sobre(id)) {
          if (vistos.has(h.id)) continue;
          vistos.add(h.id);
          this.#presupuesto.gastar(1);
          medida.posiciones += contenido(h.payload);
          medida.cantidad += unidades(h);
          medida.profundidad = Math.max(medida.profundidad, nivel + 1);
          frente.push([h.id, nivel + 1]);
        }
      }
    }
    memo.set(llave, medida);
    return medida;
  }

  /** D-MOV: el dígito d de un movimiento. */
  #movimiento(m, d) {
    switch (d) {
      case 0: return [{ k: 'serie', clave: claveToken(m) }];
      case 1: return [m.cantidad];
      case 2: return [m.estado, m.salida === undefined ? undefined : { k: 'salida', clave: m.salida }, m.caduca].filter((x) => x !== undefined);
      case 3: return [{ k: 'par', de: m.de, a: m.a }];
      case 4: return [SIMBOLOS[primitivaDe(m)]];
      case 5: {
        if (m.token !== 'E') return [];
        const registro = m.registro ?? this.#eje?.registroDe(claveToken(m)) ?? this.#eje?.alta(m.emisor)?.id;
        return registro ? [registro] : [];
      }
      // B3 (VG, 10-11): 7.0 la caducidad, 7.1 la fecha a la que se refiere; ya no comparten posición.
      case 7: return m.caduca !== undefined || m.refiere !== undefined ? [{ k: 'fechas', m }] : [];
      case 9: return m.nota === undefined ? [] : [m.nota];
      default: return [];
    }
  }
}
