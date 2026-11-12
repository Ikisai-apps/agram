// Eje: la secuencia de registros con anclaje. Hoy vive en memoria; mañana en
// una base de datos o anclado a una cadena, sin cambiar el modelo.
// Una identidad existe cuando tiene cuenta en el libro: la abre su ALTA, la
// primera transacción que la toca. Persona y cosa no se declaran (VG, 10-11,
// B1: desaparece el tipo): una PERSONA es la identidad cuya alta escribió ella
// misma (quien no tiene cuenta y escribe, escribe su propia alta, con su clave
// si la tiene); una COSA, la que recibió tokens en un alta escrita por otra
// identidad, su dueño (esPersona). El génesis
// emite por convención E, P y R, nunca T (VG, 8-11: no hay T acumulable);
// después solo emiten las personas (VG, 7-11 noche), con las reglas de
// src/ciclo.js: T no se emite, es la asignación diaria de cada persona
// (VG, 8-11), y R, P y E escalonados. Un movimiento puede bloquear o liberar
// E, P o R (T no) sin cambiar de titular: el saldo es lo disponible y lo
// bloqueado se lleva aparte.
//
// La capa cero (VG, 9-11: «la capa de abajo es la de transacciones»;
// «registrar es hacer una transacción»): por dentro, el eje es una envoltura
// del LIBRO (src/libro.js). Cada evento se traduce a una transacción
// (eje.transaccion): sus movimientos son primitivas (de = null es acuñar;
// a = null, quemar; estado 'bloqueo' o 'liberacion', bloquear o liberar; lo
// demás, transferir), `sobre` y `en` son el anclaje y el payload es el memo.
// Las reglas son CONDICIONES DE VALIDEZ de esa transacción
// (src/condiciones/), las de siempre envueltas tal cual y en el mismo orden;
// el libro las evalúa sobre la vista de antes del evento y aplica la
// transacción entera o nada. Saldos, bloqueos, lo emitido y lo consumido de
// cada serie, el T gastado del día y el T consumido sobre cada registro se
// leen del libro. Correspondencia completa: docs/notas/CAPA_CERO.md.
//
// Sin clave no se actúa (R9, docs/notas/NEUTRALIDAD_IDENTIDAD.md §4; regla
// madre aceptada por VG, 7-11 noche): una identidad sin clave registrada no
// escribe, así que no mueve tokens, no autoriza ni escribe bases (todo evento
// mueve T de su autor). El génesis declara la clave de su autor y va firmado
// con ella, y cada clave que declara un alta llega con su prueba de posesión
// (`posesion`: la clave nueva firma el id del alta). Un eje marcado como
// DEMOSTRACIÓN en su génesis (`contexto.demostracion: true`) conserva lo de
// antes: sin clave no se firma, y la prueba de posesión es opcional (si va,
// se comprueba). Los ejemplos de Ikisai y la interfaz son de demostración.
// No hay identidades de grupo (VG, 8-11): un grupo es un registro con P
// delegado. Solo el prefijo de la versión 2 (suelo de persistencia) conserva
// los tipos que declaraban sus altas.
//
// La E va atada al registro del recurso, con un tope compartido igual a su
// capacidad y emitida en proporción al P bloqueado (VG, 7-11 noche, R2 del
// estudio de neutralidad): reglasDelTope, en src/condiciones/tope.js.

import { claveToken, origenDe, cantidadBase, partirClave, validarMovimiento, capacidadDe, franjaDe, familiaDe, TODAS_LAS_FRANJAS, ESCALAS_T, ESCALAS_REALES, ESCALAS_INFORMATIVAS, asignacionT, AMBITO_GENESIS, ambitoDe } from './tokens.js';
import { acotarAltaV2, gastaAsignacion, esInformativoT, validosDe } from './ciclo.js';
import { evaluarEscritura, nombreDeRegla } from './bqlm.js';
import { EPOCA_0_BTML } from './epocas.js';
import { msUTC, msDeGuardado, segundosUTC, esInstante } from './instante.js';
import { crearEvento, validarForma, normalizarEvento, esConsumoT, esPresente } from './evento.js';
import { firmar, firmarPosesion } from './autoridad.js';
import { Libro, EMISION, acunar, transferir, bloquear, liberar, quemar, transaccion } from './libro.js';
import { CONDICIONES, CONDICIONES_GENESIS, CONDICIONES_GENESIS_GUARDADO, SIN_CAPACIDAD, contratoE } from './condiciones/index.js';
import { ContextoEje } from './contexto-eje.js';

export { reglasDelTope, SIN_CAPACIDAD } from './condiciones/tope.js';

/** Caracteres del id por los que conPrefijo agrupa los ids (16⁴ grupos: con 20.000 registros, casi uno por grupo). */
const PREFIJO = 4;

/** Clases de acuñación del libro que usa el eje (src/libro.js): la asignación diaria de T y el T informativo. */
const ASIGNACION = 'asignacion';
const INFORMATIVO = 'informativo';
/**
 * Clases del P nuevo (encargo 3b, mapa §15): la OBTENCIÓN, lo que acuñan las reglas que escriben de la época al
 * conseguir E, escribir un registro propio o recibir R (diez unidades posicionadas: N1, N2, N3), y la REPOSICIÓN,
 * lo que se acuña al mover P por el árbol (subir deja una décima, bajar añade una décima: N7).
 */
export const OBTENCION = 'obtencion';
export const REPOSICION_P = 'reposicion';

/** Diez por unidad: la constante de la obtención de la época (`epoch.1.1.4.1`), para el tope por serie. */
const DIEZ_POR_UNIDAD = Number((EPOCA_0_BTML.registro ?? EPOCA_0_BTML.payload)?.[1]?.[1]?.[4]?.[1]?.[0]) || 10;

/** Una llave de dos partes, sin JSON (como las del libro). */
const L2 = (a, b) => String(a) + '\u0000' + String(b);

export class Eje {
  #libro = new Libro(); // la capa cero: saldos, bloqueos y sumas (src/libro.js)
  #series = new Map(); // clave de serie → { emisor, contrato (E) }: qué series existen, en orden de aparición; las cantidades, del libro
  #obtenidoDeSerie = new Map(); // regla + serie de E o R → el P que esa regla ha acuñado, de todos los orígenes, por lo recibido de esa serie (el tope por serie)
  #tiposV2; // identidad → tipo que declaró su alta en el prefijo de la versión 2 (suelo de persistencia)
  #hijosEn;
  #prefijos;
  #porAutor = new Map(); // id → Map(en → Map(autor → los eventos anclados ahí por ese autor, en orden de entrada))
  #llegada = new Map(); // id → su número de entrada en el eje (0 el génesis)
  #prefijoV2 = new Set(); // ids de los eventos del principio guardados con la versión 2
  #tMax = -Infinity; // el mayor t aceptado en el eje, en milisegundos UTC
  #tPorAutor = new Map(); // autor → el mayor t aceptado de sus eventos, en milisegundos UTC (el reloj de los demás, SEG-05)
  #relojExterno = -Infinity; // la hora que dan los demás desde fuera del eje (el `recibido` del libro compartido, src/sincronia.js), en milisegundos UTC
  #sellos = new Map(); // id → el sello de tiempo que lo ancla (src/sello.js): { altura, hash, instante, verificado }; vista del libro, fuera del cuerpo y del id (X.6.8.2)

  /**
   * exigirFirmas: todo autor debe tener clave registrada y firmar. Si no, solo firman quienes tienen clave.
   * eventosV2: cuántos eventos del principio se guardaron con la versión 2 y se validan con sus reglas
   * (src/persistencia.js); los demás, con las de ahora.
   */
  constructor({ exigirFirmas = false, eventosV2 = 0 } = {}) {
    this.eventos = new Map(); // id → evento
    this.orden = []; // ids en orden de entrada
    this.claves = new Map(); // identidad → clave pública (hex x-only, BIP-340: src/autoridad.js)
    this.hijos = new Map(); // id → eventos escritos sobre él, en orden de entrada (índice)
    this.#hijosEn = new Map(); // id → Map(en → los mismos eventos, solo los anclados en esa dirección, en orden de entrada)
    this.#prefijos = new Map(); // primeros PREFIJO caracteres del id → ids, en orden de entrada (índice de conPrefijo)
    this.#tiposV2 = new Map();
    this.exigirFirmas = exigirFirmas;
    this.eventosV2 = eventosV2;
    // Lo marca el génesis (contexto.demostracion) al aplicarse; un eje que no lo dice no es de demostración.
    this.demostracion = false;
  }

  /**
   * El libro de transacciones del eje (src/libro.js): para leer (saldos,
   * bloqueos, vistas por identidad, sumas, el diario). Se escribe con
   * eje.escribir o eje.anadir, que traducen el evento y pasan sus condiciones.
   */
  get libro() {
    return this.#libro;
  }

  /** Saldos disponibles, identidad → Map(clave → cantidad): una copia leída del libro (compatibilidad). */
  get saldos() {
    return new Map(this.#libro.titulares().map((id) => [id, new Map(this.#libro.disponibles(id))]));
  }

  /** Bloqueos, identidad → Map(clave → Map(salida → cantidad)): una copia leída del libro (compatibilidad). */
  get bloqueados() {
    const r = new Map();
    for (const id of this.#libro.titulares()) {
      for (const { serie, salida, cantidad } of this.#libro.bloqueos(id)) {
        if (!r.has(id)) r.set(id, new Map());
        if (!r.get(id).has(serie)) r.get(id).set(serie, new Map());
        r.get(id).get(serie).set(salida, cantidad);
      }
    }
    return r;
  }

  /**
   * Génesis (encargo 3b; VG, 10-11, A2; mapa §16 [D] «El árbol mínimo es la invitación»): el registro de la época 0
   * en este eje, «sin movimientos», fuera del sistema: lleva la referencia a la época (contexto.epoca, su id) y no
   * pasa por las reglas de la época (no es una transacción), solo por el suelo (lo que declara, su firma). Es también
   * el alta de quien lo escribe: la única alta sin invitación, la de la primera identidad del eje (las demás entran
   * aceptando una invitación: invitar, aceptar). Su autor es una persona (VG, 10-11, B1) y obtiene P sobre él al
   * escribirlo, como sobre todo registro propio (la regla que escribe «writing a record gives ten P on it»).
   *
   * `emision` (opcional): lo que su autor emite al empezar (E y R; T no, y P tampoco: VG, 8-11, y mapa §15). Va en
   * una transacción suya sobre el génesis, la segunda del eje, que pasa por las reglas como cualquiera (quema un
   * minuto de su T; emitir E exige P sobre su registro, que es el génesis, y R propia emitida).
   * Sin clave no se actúa (R9): el génesis lleva `clave` y `privada` de su autor, salvo que se cree como
   * `demostracion: true` (queda en su contexto y se ve en la interfaz).
   */
  static async genesis({ identidad, emision = [], foco, t = new Date().toISOString(), contexto = {}, clave, privada, exigirFirmas = false, demostracion = false, ...resto }) {
    if (Object.hasOwn(resto, 'tipo')) throw new Error('génesis: no hay tipo (VG, 10-11, B1): persona o cosa se lee de quién escribe el alta; el autor del génesis escribe la suya, es una persona');
    if (emision.some((m) => m?.token === 'P')) throw new Error('génesis: nadie acuña P a mano (mapa §15, «P como peso de criterio»: se retira «P del génesis sobre todo el eje»); el P se obtiene al escribir, al conseguir E y al recibir R');
    const eje = new Eje({ exigirFirmas });
    let ev = await crearEvento({
      autor: identidad,
      sobre: null,
      t,
      movimientos: [],
      payload: foco,
      contexto: { ...contexto, genesis: true, epoca: EPOCA_0_BTML.id, ...(demostracion ? { demostracion: true } : {}), ...(clave ? { claves: { [identidad]: clave } } : {}) },
    });
    if (privada) ev = await firmar(ev, privada);
    // La misma regla que al restaurar: si el génesis declara clave, va firmado con ella (GN-1, GN-2).
    const motivos = await eje.#libro.evaluar(eje.transaccion(ev), CONDICIONES_GENESIS, { evento: ev, reglas: 3, contextoBqlm: (epoch) => new ContextoEje(eje, { ev, epoch }) });
    if (motivos.length) throw new Error('génesis rechazado: ' + motivos.map((m) => m.texto).join('; '));
    if (exigirFirmas && !clave) throw new Error('el génesis debe ir firmado');
    eje.#aplicar(ev);
    if (emision.length) {
      // Sus series de E y de R quedan a su nombre. R primero: emitir E exige R propia emitida (VG, 9-11, D2).
      const deEmisor = (m) => m.token === 'E' || m.token === 'R';
      const orden = [...emision.filter((m) => m.token === 'R'), ...emision.filter((m) => m.token !== 'R')];
      const movimientos = orden.map((m) => ({ ...m, ...(deEmisor(m) ? { emisor: m.emisor ?? identidad } : {}), de: null, a: identidad }));
      await eje.escribir({
        autor: identidad,
        sobre: eje.genesisId,
        t,
        movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: identidad, a: null }, ...movimientos],
        payload: ['Emisión inicial de ' + identidad],
      }, privada);
    }
    return eje;
  }

  /** Clave pública registrada de una identidad, si la tiene. */
  clave(identidad) {
    return this.claves.get(identidad);
  }

  /**
   * ¿Es una persona? (VG, 10-11, B1: desaparece el tipo.) true si su alta (la
   * transacción que abrió su cuenta) la escribió ella misma; false si la
   * escribió otra identidad, su dueño: es una cosa; null si no tiene alta. En
   * el prefijo de la versión 2 (suelo de persistencia), lo que declaró su alta
   * entonces: persona, o no (grupo, cosa).
   */
  esPersona(identidad) {
    const tx = this.#libro.alta(identidad);
    if (!tx) return null;
    if (this.#prefijoV2.has(tx.id)) return this.#tiposV2.get(identidad) === 'persona';
    return tx.autor === identidad;
  }

  /**
   * ¿Escribe `ev` como persona? Sí si su autor lo es o si aún no tiene cuenta:
   * entonces este registro es su propia alta (B1). Rige fuera del prefijo de la
   * versión 2.
   */
  #escribePersona(ev) {
    const p = this.esPersona(ev.autor);
    return p === null ? typeof ev.autor === 'string' && ev.autor.length > 0 : p;
  }

  /** El tipo que declaró en el prefijo de la versión 2 el alta de una identidad, o null (suelo de persistencia: las reglas de entonces). */
  tipoV2(identidad) {
    return this.#tiposV2.get(identidad) ?? null;
  }

  /**
   * Alta de una identidad: { id, t } del evento en que recibió tokens por
   * primera vez (el génesis es el alta de su autor), o null. Es la primera
   * transacción que abrió su cuenta en el libro.
   */
  alta(identidad) {
    const tx = this.#libro.alta(identidad);
    return tx ? { id: tx.id, t: tx.t } : null;
  }

  /** ¿Es el evento uno de los guardados con la versión 2 (el prefijo que se valida con sus reglas)? */
  esDeV2(id) {
    return this.#prefijoV2.has(id);
  }

  /**
   * El mayor t aceptado en el eje, en milisegundos UTC (-Infinity si está
   * vacío). Con `excluidos` (identidades), solo entre los eventos de las
   * demás: el reloj que marcan los otros (SEG-05), -Infinity si no hay ninguno.
   */
  tMaximo(excluidos) {
    if (excluidos === undefined) return this.#tMax;
    const fuera = new Set(excluidos);
    let max = this.#relojExterno;
    for (const [autor, ms] of this.#tPorAutor) if (ms > max && !fuera.has(autor)) max = ms;
    return max;
  }

  /**
   * El reloj de los demás que llega de fuera (etapa 3, el libro compartido: el
   * `recibido` del servidor, la hora a la que los demás vieron cada evento).
   * Entra SOLO en el reloj de los demás (`tMaximo(excluidos)`, lo que las
   * reglas leen como `before.6.3`), nunca en el mayor t del libro
   * (`tMaximo()`, `before.6.0`: eso son los eventos) ni en ningún evento (no
   * cambia ningún id). Se queda con el mayor; un instante que no se lee se
   * ignora. Devuelve el reloj externo en milisegundos (-Infinity si no hay).
   */
  marcarReloj(instante) {
    const ms = typeof instante === 'number' ? instante : Date.parse(instante);
    if (Number.isFinite(ms) && ms > this.#relojExterno) this.#relojExterno = ms;
    return this.#relojExterno;
  }

  /** El reloj externo marcado (milisegundos UTC; -Infinity si ninguno). */
  get relojExterno() {
    return this.#relojExterno;
  }

  /**
   * El sello de tiempo que ancla un registro (el tercer reloj, `X.6.8.2`: el bloque de Bitcoin que lo sella,
   * src/sello.js). Como el reloj externo, es una vista del libro que llega de fuera: NO es parte del cuerpo firmado, no
   * cambia ningún id ni ninguna firma, y no entra en ninguna regla de escritura. `sello` = { altura, hash, instante }
   * (la forma que da `prueba(id)` de src/sello.js; `verificado`, opcional, si `verificar` la dio por buena: el gancho
   * de la estación «verificado»). Se queda con el sello más antiguo (el de menor instante). Devuelve si lo anotó;
   * un registro que el eje no tiene, o un sello mal formado, se ignoran.
   */
  marcarSello(id, sello) {
    if (!this.eventos.has(id) || !sello || typeof sello !== 'object') return false;
    const { altura, hash, instante, verificado } = sello;
    if (!Number.isSafeInteger(altura) || altura < 0 || typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash) || !esInstante(instante)) return false;
    const antes = this.#sellos.get(id);
    if (antes && msUTC(antes.instante) <= msUTC(instante)) {
      if (verificado !== undefined && antes.altura === altura && antes.hash === hash) this.#sellos.set(id, Object.freeze({ ...antes, verificado: verificado === true }));
      return false;
    }
    this.#sellos.set(id, Object.freeze({ altura, hash, instante, verificado: verificado === true }));
    return true;
  }

  /** El sello de tiempo de un registro { altura, hash, instante, verificado } o null si aún no lo tiene (X.6.8.2). */
  sello(id) {
    return this.#sellos.get(id) ?? null;
  }

  /**
   * T de la asignación de una persona gastado en una escala un día (`periodo`,
   * el día civil: tokens.asignacionT): en el libro, lo acuñado a esa persona
   * con la clase «asignación» y la etiqueta de ese día.
   */
  gastadoT(identidad, escala, periodo) {
    return this.#libro.sumas({ primitiva: 'acunar', serie: 'T:' + escala, titular: identidad, clase: ASIGNACION, etiqueta: periodo ?? null });
  }

  /**
   * T consumido SOBRE un registro, por escala (VG, 7-11 noche: «escribir
   * consume T y el consumo queda registrado en el registro que soporta»): la
   * suma de los consumos de T (de = autor, a = null) de los eventos escritos
   * sobre `id` (sus hijos directos, sus bases del 8 incluidas). Es lo que ese
   * registro acumula y enseña: { segundo: n, minuto: m, … }, solo las escalas
   * con algo, en el orden de las escalas. Se ve desde fuera, pero ninguna
   * regla lo usa para conceder nada a terceros (ni autorizar, ni topes de E,
   * ni elegibilidad, ni orden de candidatos). En el libro: lo quemado de cada
   * serie de T en las transacciones ancladas sobre `id` (sin recorrer).
   */
  tiempoSobre(id) {
    const r = {};
    for (const e of ESCALAS_REALES) {
      const n = this.#quemadoSobre(id, e);
      if (n) r[e] = n;
    }
    return r;
  }

  #quemadoSobre(id, escala) {
    return this.#libro.sumas({ primitiva: 'quemar', serie: 'T:' + escala, registro: id });
  }

  /**
   * ¿Es el registro `id` presente? (evento.esPresente). No lo es el que se pagó
   * solo con T informativo (pasado, futuro, inventado): válido y gratis en T
   * real, pero sin la marca de registro presente (VG, 8-11: «el pago es la
   * ausencia de un registro presente, que puede ser un criterio en PV2 cuando
   * el tiempo importe (p. ej. caducidad alimentaria)»). undefined si no está.
   */
  presente(id) {
    const ev = this.eventos.get(id);
    return ev ? esPresente(ev) : undefined;
  }

  /**
   * El T informativo (pasado, futuro, inventado; VG, 8-11) consumido SOBRE un
   * registro, aparte de las siete escalas reales: lo que quedó registrado como
   * tal, con sus dos fechas, el t real del evento y la fecha a la que se
   * refiere: [{ escala, cantidad, autor, t, refiere, nota, id }], en orden de
   * entrada. Nada lo convierte a segundos ni lo suma a tiempoSobre. En el
   * libro: los asientos de quema de clase «informativo» anclados sobre `id`.
   */
  tiempoInformativo(id) {
    return this.#libro.asientos({ registro: id, primitiva: 'quemar', clase: INFORMATIVO })
      .map((a) => ({ escala: a.origen.escala, cantidad: a.cantidad, autor: a.tx.autor, t: a.tx.t, refiere: a.origen.refiere ?? null, nota: a.origen.nota ?? null, id: a.tx.id }));
  }

  /**
   * T consumido sobre un registro y sobre todo lo que cuelga de él, por
   * escala: tiempoSobre de `id` y de cada descendiente, sumado. Recorre el
   * subárbol; el 8 lo da sin recorrer (bases.medir lo funde por escala en la
   * estadística del subárbol, con las claves «tiempo:<escala>»).
   */
  tiempoBajo(id) {
    const r = {};
    const pendientes = [id];
    while (pendientes.length) {
      const x = pendientes.pop();
      for (const e of ESCALAS_REALES) {
        const n = this.#quemadoSobre(x, e);
        if (n) r[e] = (r[e] ?? 0) + n;
      }
      for (const h of this.hijos.get(x) ?? []) pendientes.push(h.id);
    }
    return Object.fromEntries(ESCALAS_REALES.filter((e) => r[e]).map((e) => [e, r[e]]));
  }

  /**
   * Reconstruye un eje desde su lista de eventos (el primero es el génesis),
   * validando cada uno: ids, firmas, saldos. Nada se da por bueno.
   */
  static async desde(eventos, { exigirFirmas = false, eventosV2 = 0 } = {}) {
    const [crudo, ...resto] = eventos;
    if (!crudo || crudo.contexto?.genesis !== true || crudo.sobre !== null) throw new Error('el primer evento debe ser el génesis');
    if (!Number.isSafeInteger(eventosV2) || eventosV2 < 0 || eventosV2 > eventos.length) throw new Error('eventosV2 debe ser un entero entre 0 y el número de eventos');
    const g = copiaGuardable(crudo);
    const eje = new Eje({ exigirFirmas, eventosV2 });
    const motivos = await eje.#libro.evaluar(eje.transaccion(g), CONDICIONES_GENESIS_GUARDADO, { evento: g, tLaxo: eventosV2 > 0, reglas: eventosV2 > 0 ? 2 : 3, contextoBqlm: (epoch) => new ContextoEje(eje, { ev: g, epoch }) });
    if (motivos.length) throw new Error('génesis rechazado: ' + motivos.map((m) => m.texto).join('; '));
    if (exigirFirmas && !g.contexto.claves?.[g.autor]) throw new Error('el génesis debe ir firmado');
    eje.#aplicar(g);
    for (const ev of resto) await eje.anadir(ev);
    return eje;
  }

  /**
   * El eje de justo antes del registro número `hasta` (en orden de entrada):
   * un eje nuevo con los `hasta` primeros eventos, reaplicados sin volver a
   * validarlos (ya lo están). Lo que leen las capas de validez de un registro
   * (src/validez.js): el libro, las series, las claves y los tipos de ese
   * momento, con las mismas condiciones que el eje.
   */
  antes(hasta) {
    const eje = new Eje({ exigirFirmas: this.exigirFirmas, eventosV2: this.eventosV2 });
    const n = Math.max(0, Math.min(hasta, this.orden.length));
    for (let k = 0; k < n; k++) eje.#aplicar(this.eventos.get(this.orden[k]));
    return eje;
  }

  /**
   * Reordena el eje (etapa 3, el libro compartido: el orden que vale es el de
   * llegada al servidor, y el local puede diferir). `lista` son eventos (o ids
   * de eventos que el eje ya tiene), el génesis el primero y el mismo de
   * siempre; lo que el eje tenía y no está en la lista va detrás, en su orden
   * de entrada (lo que aún no se ha subido). Se reconstruye un eje nuevo
   * volviendo a validar cada evento en el orden nuevo, como al restaurar
   * (nada se da por bueno): lo que no pasa no entra y se devuelve en
   * `rechazados` [{ id, motivo }] sin lanzar; `anadidos` son los ids de los
   * eventos que no estaban. El eje adopta el resultado en sitio (los índices,
   * el libro, las claves, el reloj externo), así que quien lo tenía sigue
   * teniéndolo. No se reordena el prefijo de la versión 2 (sus reglas eran
   * otras): si lo hay, la lista ha de empezar por él tal cual.
   */
  async reordenar(lista) {
    const tenia = new Set(this.orden);
    const eventosDe = (x) => (typeof x === 'string' ? this.eventos.get(x) : x);
    const dados = lista.map(eventosDe);
    if (dados.some((e) => !e || typeof e !== 'object')) throw new Error('reordenar: la lista lleva ids que el eje no tiene');
    const ids = new Set(dados.map((e) => e.id));
    const todos = [...dados, ...this.orden.filter((id) => !ids.has(id)).map((id) => this.eventos.get(id))];
    if (!todos.length || todos[0].id !== this.genesisId) throw new Error('reordenar: el génesis va primero y es el de siempre');
    for (let k = 0; k < this.eventosV2; k++) if (todos[k]?.id !== this.orden[k]) throw new Error('reordenar: el prefijo de la versión 2 no se reordena');
    const [g, ...resto] = todos;
    const nuevo = new Eje({ exigirFirmas: this.exigirFirmas, eventosV2: this.eventosV2 });
    nuevo.#relojExterno = this.#relojExterno;
    nuevo.#sellos = this.#sellos;
    const motivos = await nuevo.#libro.evaluar(nuevo.transaccion(g), CONDICIONES_GENESIS_GUARDADO, { evento: g, tLaxo: this.eventosV2 > 0, reglas: this.eventosV2 > 0 ? 2 : 3, contextoBqlm: (epoch) => new ContextoEje(nuevo, { ev: g, epoch }) });
    if (motivos.length) throw new Error('génesis rechazado: ' + motivos.map((m) => m.texto).join('; '));
    nuevo.#aplicar(g);
    const rechazados = [];
    const anadidos = [];
    for (const ev of resto) {
      try {
        const guardado = await nuevo.anadir(ev);
        if (!tenia.has(guardado.id)) anadidos.push(guardado.id);
      } catch (e) {
        rechazados.push({ id: ev?.id, motivo: e.message });
      }
    }
    this.#adoptar(nuevo);
    return { anadidos, rechazados };
  }

  /** Toma todo el estado de `otro` (un eje recién construido): lo público y lo privado. */
  #adoptar(otro) {
    this.eventos = otro.eventos;
    this.orden = otro.orden;
    this.claves = otro.claves;
    this.hijos = otro.hijos;
    this.demostracion = otro.demostracion;
    this.#libro = otro.#libro;
    this.#series = otro.#series;
    this.#obtenidoDeSerie = otro.#obtenidoDeSerie;
    this.#tiposV2 = otro.#tiposV2;
    this.#hijosEn = otro.#hijosEn;
    this.#prefijos = otro.#prefijos;
    this.#porAutor = otro.#porAutor;
    this.#llegada = otro.#llegada;
    this.#prefijoV2 = otro.#prefijoV2;
    this.#tMax = otro.#tMax;
    this.#tPorAutor = otro.#tPorAutor;
    this.#relojExterno = otro.#relojExterno;
    this.#sellos = otro.#sellos;
  }

  get genesisId() {
    return this.orden[0];
  }

  /**
   * Ids que empiezan por `prefijo`, en orden de entrada: lo mismo que
   * `eje.orden.filter((id) => id.startsWith(prefijo))`, sin recorrer el eje
   * entero cuando el prefijo tiene al menos PREFIJO caracteres (un índice por
   * los primeros; docs/notas/RENDIMIENTO.md). Lo usan las referencias por
   * prefijo («@25ddaa89», REF("25ddaa89")).
   */
  conPrefijo(prefijo) {
    if (typeof prefijo !== 'string' || prefijo.length < PREFIJO) return this.orden.filter((id) => id.startsWith(prefijo));
    return (this.#prefijos.get(prefijo.slice(0, PREFIJO)) ?? []).filter((id) => id.startsWith(prefijo));
  }

  obtener(id) {
    return this.eventos.get(id);
  }

  /** Identidades con cuenta en el libro, en el orden en que nacieron. */
  identidades() {
    return this.#libro.titulares();
  }

  /** Saldo disponible: lo que se puede consumir o transferir. Lo bloqueado no cuenta. */
  saldo(identidad, clave) {
    return this.#libro.saldo(identidad, clave);
  }

  /** Cantidad bloqueada de una serie en una identidad, sumando todas sus salidas (o solo la de `salida`, si se da). */
  bloqueado(identidad, clave, salida) {
    return this.#libro.bloqueado(identidad, clave, salida);
  }

  /**
   * Lo bloqueado de una serie con una salida, sumando todos los titulares:
   * comprometer P con una decisión es bloquearlo con ella como salida (mapa §15).
   */
  bloqueadoCon(clave, salida) {
    return this.#libro.bloqueadoPorSalida(salida, clave);
  }

  /** Bloqueos con una salida, de cualquier titular y serie: [{ identidad, clave, cantidad }] con cantidad > 0. */
  bloqueosCon(salida) {
    return this.#libro.bloqueosCon(salida).map(({ titular, serie, cantidad }) => ({ identidad: titular, clave: serie, cantidad }));
  }

  /** Bloqueos de una identidad: [{ clave, token, serie, ...campos, salida, cantidad }] con cantidad > 0. */
  bloqueos(identidad) {
    return this.#libro.bloqueos(identidad).map(({ serie: clave, salida, cantidad }) => ({ clave, ...partirClave(clave), salida, cantidad }));
  }

  /**
   * Obligación de un emisor por su R (doble entrada, V10): la cantidad de su R
   * que está en manos ajenas, disponible o bloqueada. Se deriva de los saldos;
   * no es un token. Mientras la R está en su cartera no obliga a nada.
   */
  obligaciones(emisor) {
    const clave = 'R:' + emisor;
    let total = 0;
    for (const id of this.#libro.titulares()) if (id !== emisor) total += this.saldo(id, clave) + this.bloqueado(id, clave);
    return total;
  }

  /**
   * T disponible en una escala el día de `t` (VG, 8-11: asignación diaria):
   * cada escala es su propio token (T:<escala>), sin conversión. Para una
   * persona dada de alta, lo que queda de su asignación de ese día
   * (tokens.asignacionT menos gastadoT): ningún T se acumula (VG, 8-11: no hay
   * T acumulable; el génesis no emite T). Solo quien viene del prefijo de la
   * versión 2 suma el T explícito que arrastre de entonces. Para una cosa, que
   * no tiene asignación, su T explícito: el que le dio su persona, que conserva
   * hasta gastarlo. Sin `t`, el día del último evento de esa identidad
   * (su propio reloj) o el de su alta. Las tres informativas son ilimitadas:
   * siempre queda 1. Semana, ciclo y año, en sus partes (tokens.PARTES_T).
   */
  saldoT(identidad, escala, t) {
    if (!ESCALAS_T.includes(escala)) throw new Error('escala T inválida: ' + escala);
    if (ESCALAS_INFORMATIVAS.includes(escala)) return 1;
    return this.saldo(identidad, 'T:' + escala) + this.#quedaAsignacion(identidad, escala, t);
  }

  /** Lo que queda de la asignación diaria de T de `identidad` en `escala` el día de `t` (0 si no es una persona con alta). */
  #quedaAsignacion(identidad, escala, t) {
    const alta = this.alta(identidad);
    if (!alta || this.esPersona(identidad) !== true) return 0;
    const a = asignacionT(t ?? this.#tPorAutor.get(identidad) ?? alta.t, escala);
    return Math.max(0, a.cantidad - this.gastadoT(identidad, escala, a.periodo));
  }

  /**
   * Lo que una identidad ha recibido de su emisor, por serie de E y de R (la vista `A.8.6`; VG, tras 3b-bis: la
   * obtención de P es un tope acumulado, diez por unidad neta recibida del emisor): [{ serie, emisor, recibido,
   * devuelto, neto }] por cada serie que le ha llegado alguna vez directamente de su emisor (también la que ya no tiene),
   * en el orden en que tocó cada serie. `recibido` es lo transferido del emisor a ella; `devuelto`, lo que ella ha
   * transferido al emisor; `neto` = recibido − devuelto (puede ser negativo si devuelve lo que compró a un tenedor).
   * Lo que pasa entre tenedores no cuenta. Un emisor no se recibe a sí mismo.
   */
  recibidoDelEmisor(identidad) {
    const claves = this.#libro.disponibles(identidad).map(([k]) => k);
    for (const b of this.#libro.bloqueos(identidad)) if (!claves.includes(b.serie)) claves.push(b.serie);
    const fuera = [];
    for (const k of claves) {
      const familia = k.slice(0, 2);
      if (familia !== 'E:' && familia !== 'R:') continue;
      const { emisor } = partirClave(k);
      if (!emisor || emisor === identidad) continue;
      const recibido = this.#libro.sumas({ primitiva: 'transferir', serie: k, de: emisor, a: identidad });
      if (!(recibido > 0)) continue;
      const devuelto = this.#libro.sumas({ primitiva: 'transferir', serie: k, de: identidad, a: emisor });
      fuera.push({ serie: k, emisor, recibido, devuelto, neto: recibido - devuelto });
    }
    return fuera;
  }

  /**
   * El P que la regla `regla` (su nombre) ha acuñado, de todos los orígenes, por lo recibido de la serie de E o R
   * `serie` (el tope por serie, VG tras 3b-bis: nunca pasa de diez por unidad acuñada de esa serie; la misma unidad no
   * da P dos veces aunque vuelva a su emisor por un tercero y salga otra vez).
   */
  obtenidoDeSerie(serie, regla) {
    return this.#obtenidoDeSerie.get(L2(regla, serie)) ?? 0;
  }

  /** Saldos de una familia por serie: [{ token, serie, ...campos de la serie, cantidad }] con saldo > 0. */
  #porSerie(identidad, token) {
    return this.#libro.disponibles(identidad)
      .filter(([k, v]) => k.startsWith(token + ':') && v > 0)
      .map(([k, v]) => ({ ...partirClave(k), cantidad: v }));
  }

  /** Tiempo de una identidad: [{ escala, cantidad }] en el orden de las escalas. */
  tiempos(identidad) {
    return this.#porSerie(identidad, 'T')
      .map(({ escala, cantidad }) => ({ escala, cantidad }))
      .sort((a, b) => ESCALAS_T.indexOf(a.escala) - ESCALAS_T.indexOf(b.escala));
  }

  /** Recursos de una identidad: [{ emisor, denominacion, registro (si la serie lo nombra), cantidad }]; cada serie de E es de su emisor. */
  recursos(identidad) {
    return this.#porSerie(identidad, 'E').map(({ emisor, denominacion, registro, cantidad }) => ({ emisor, denominacion, ...(registro ? { registro } : {}), cantidad }));
  }

  /**
   * Una serie tal como la leen las reglas, o null si no existe: su emisor y
   * su contrato (E: caduca, registro, divisible, emisores), con lo emitido
   * (lo acuñado como emisión), lo consumido (lo quemado, en E y T) y, en T,
   * lo que salió de asignaciones: todo del libro.
   */
  #serieCruda(clave) {
    const s = this.#series.get(clave);
    if (!s) return null;
    const emitido = this.#libro.sumas({ primitiva: 'acunar', serie: clave, clase: 'emision' });
    const token = clave.slice(0, clave.indexOf(':'));
    if (token === 'E') return { emisor: s.emisor, emitido, ...s.contrato, consumido: this.#libro.sumas({ primitiva: 'quemar', serie: clave }) };
    if (token === 'T') {
      return { emisor: s.emisor, emitido, consumido: this.#libro.sumas({ primitiva: 'quemar', serie: clave }), deAsignacion: this.#libro.sumas({ primitiva: 'acunar', serie: clave, clase: ASIGNACION }) };
    }
    // P (encargo 3b): lo acuñado es la obtención y la reposición, no una emisión.
    if (token === 'P') return { emisor: s.emisor, emitido: this.#libro.sumas({ primitiva: 'acunar', serie: clave }) };
    return { emisor: s.emisor, emitido };
  }

  /**
   * Una serie por su clave de saldo ('E:casa/EUR', 'R:casa', 'T:hora', 'P:<registro>/<origen>'): quién la emite (en P, su origen) y cuánto ha emitido,
   * y `caduca` si es una serie de E que la lleva. En T, `emisor` es quien la emitió o la consumió primero; lo de cada persona, saldoT.
   * Del contrato de una serie de E, también `divisible` (si admite fracciones) y `emisores` (si la emisión es conjunta).
   */
  serie(clave) {
    const s = this.#serieCruda(clave);
    return {
      emisor: s?.emisor ?? null,
      emitido: s?.emitido ?? 0,
      ...(s?.caduca ? { caduca: s.caduca } : {}),
      ...(s?.divisible ? { divisible: true } : {}),
      ...(s?.emisores ? { emisores: [...s.emisores] } : {}),
      // El precio de la serie (VG, tras 3b-bis: la orientación de una E es el token que la paga), si lo declaró su emisión.
      ...(s?.precio ? { precio: [...s.precio] } : {}),
      ...(s?.precios ? { precios: s.precios.map((p) => [...p]) } : {}),
    };
  }

  /**
   * E vivo de una serie (R2, VG 7-11 noche): lo emitido menos lo consumido, y
   * nada si ha caducado en `t` (caducada). Sin `t` no mira la caducidad.
   * Lo que no es una serie de E emitida da 0. Con la clave de una familia
   * (la franja «*», tokens.familiaDe), la suma de todas sus franjas.
   */
  vivo(clave, t) {
    if (!clave.startsWith('E:')) return 0;
    if (franjaDe(partirClave(clave).denominacion) === TODAS_LAS_FRANJAS) {
      let total = 0;
      for (const k of this.#series.keys()) if (k.startsWith('E:') && k !== clave && familiaDe(k) === clave) total += this.vivo(k, t);
      return total;
    }
    const s = this.#serieCruda(clave);
    if (!s) return 0;
    if (t !== undefined && caducada(this, clave, t)) return 0;
    return s.emitido - s.consumido;
  }

  /**
   * Registro al que está atada una serie de E: el que nombra su clave o, si no
   * nombra ninguno, el del propio emisor (su alta; el génesis para quien lo
   * escribió). null si la serie no existe.
   */
  registroDe(clave) {
    return this.#series.get(clave)?.contrato?.registro ?? null;
  }

  /**
   * Los topes de E que alcanzan a un registro (R2): cada registro de su hilo
   * (él mismo incluido, hasta el génesis) que declara capacidad
   * (tokens.capacidadDe sobre su payload raíz), del más cercano al génesis,
   * con el E vivo en `t` de ese registro y de todos sus descendientes POR
   * FRANJA (tokens.franjaDe), sumando todas las denominaciones y todos los
   * emisores de esa franja: [{ registro, capacidad, franja, vivo, libre }].
   * Con `franja`, una fila por registro para esa franja; sin ella, una por
   * cada franja que tenga alguna serie debajo (o la franja '' si no hay
   * ninguna), en orden de texto. Vacío si nadie en el hilo declara capacidad:
   * entonces no hay tope.
   */
  topes(registro, t, franja) {
    const declarados = this.#topesDe(registro);
    if (!declarados.length) return [];
    return declarados.flatMap(({ id, capacidad }) => {
      const porFranja = new Map();
      for (const [clave, s] of this.#series) {
        const reg = s.contrato?.registro;
        if (!clave.startsWith('E:') || !reg || !this.hilo(reg).some((e) => e.id === id)) continue;
        const f = franjaDe(partirClave(clave).denominacion);
        porFranja.set(f, (porFranja.get(f) ?? 0) + this.vivo(clave, t));
      }
      const franjas = franja !== undefined ? [franja] : porFranja.size ? [...porFranja.keys()].sort() : [''];
      return franjas.map((f) => {
        const vivo = porFranja.get(f) ?? 0;
        return { registro: id, capacidad, franja: f, vivo, libre: capacidad - vivo };
      });
    });
  }

  /** Registros del hilo de `registro` que declaran capacidad, del más cercano al génesis: [{ id, capacidad }]. */
  #topesDe(registro) {
    if (!registro || !this.eventos.has(registro)) return [];
    return this.hilo(registro).map((e) => ({ id: e.id, capacidad: capacidadDe(e.payload) })).filter((x) => x.capacidad !== undefined);
  }

  /**
   * Todas las series emitidas, de las cuatro familias, por orden de emisión:
   * [{ clave, token, serie, ...campos, emisor, emitido, bloqueado, caduca (solo en E: ISO o null) }].
   * `bloqueado` es lo que de esa serie está bloqueado, sumando todos los titulares.
   * En E, además (R2): `registro` (el que nombra la clave o el del emisor),
   * `consumido`, `divisible`, `emisores` (quienes la respaldan con su P
   * bloqueado) y `tope`: la capacidad del registro más cercano de su hilo que
   * la declara, o null, y entonces `nota` lo dice («sin capacidad declarada:
   * deuda del emisor»).
   */
  series() {
    const bloqueado = this.#libro.bloqueadoPorSerie();
    return [...this.#series.keys()].map((clave) => {
      const s = this.#serieCruda(clave);
      const partes = partirClave(clave);
      const base = { clave, ...partes, emisor: s.emisor, emitido: s.emitido, bloqueado: bloqueado.get(clave) ?? 0 };
      // T (VG, 8-11): lo consumido al escribir y lo que salió de la asignación diaria; lo de cada registro, tiempoSobre.
      // Las tres informativas, marcadas aparte (informativa: true; lo registrado, tiempoInformativo).
      if (partes.token === 'T') {
        if (ESCALAS_INFORMATIVAS.includes(partes.escala)) return { ...base, consumido: s.consumido ?? 0, informativa: true };
        return { ...base, consumido: s.consumido ?? 0, deAsignacion: s.deAsignacion ?? 0 };
      }
      if (partes.token !== 'E') return base;
      const tope = this.#topesDe(s.registro)[0]?.capacidad ?? null;
      return {
        ...base,
        caduca: s.caduca ?? null,
        registro: s.registro ?? null,
        consumido: s.consumido,
        divisible: s.divisible === true,
        emisores: s.emisores ? [...s.emisores] : [s.emisor],
        tope,
        ...(tope === null ? { nota: SIN_CAPACIDAD } : {}),
      };
    });
  }

  /** Poderes de una identidad: [{ ambito, origen, cantidad }], uno por serie (registro y origen). No hay P total. */
  poderes(identidad) {
    return this.#porSerie(identidad, 'P').map(({ ambito, origen, cantidad }) => ({ ambito, origen, cantidad }));
  }

  /**
   * El P de una identidad posicionado en un registro (mapa §15: «P son unidades acuñadas y posicionadas en
   * registros»), disponible y bloqueado. Ya no hay P sobre todo el eje ni P que cubra lo de debajo: el P de un
   * registro es criterio sobre él, y llevarlo a otro es reposicionarlo (subir deja una décima, bajar añade una).
   * Suma todos los orígenes (encargo 3b-bis): el que obtuvo ella y el que le delegaron; con `origen`, solo el de ese.
   * P por mirada (VG, tras 3b-bis): sin `mirada`, todo el P posicionado en el registro, el del registro entero y el de
   * cada una de sus miradas («r.d»); con `mirada` = d, lo que pesa en una decisión sobre la mirada d: el P sobre r
   * entero y el P sobre r.d (el de otras miradas no).
   */
  poderSobre(identidad, registro, origen, mirada) {
    let total = 0;
    for (const [k, v] of Object.entries(this.#libro.vista(identidad))) {
      const p = k.startsWith('P:') ? partirClave(k) : null;
      if (!p || p.raiz !== registro || (origen !== undefined && p.origen !== origen)) continue;
      if (mirada !== undefined && p.mirada !== undefined && p.mirada !== mirada) continue;
      total += v.disponible + Object.values(v.bloqueado).reduce((s, x) => s + x, 0);
    }
    return total;
  }

  /**
   * El P de un origen (encargo 3b-bis: «el P guarda su origen»): lo que obtuvo `origen`, esté en la mano que esté,
   * por ámbito (el registro entero, o una mirada suya «r.d»: VG, tras 3b-bis), disponible y bloqueado:
   * [{ registro, mirada, ambito, cantidad, titulares }] en el orden en que aparece cada ámbito.
   */
  obtenidoPor(origen) {
    const porAmbito = new Map();
    for (const id of this.#libro.titulares()) {
      for (const [k, v] of Object.entries(this.#libro.vista(id))) {
        if (!k.startsWith('P:')) continue;
        const p = partirClave(k);
        if (p.origen !== origen) continue;
        const c = v.disponible + Object.values(v.bloqueado).reduce((s, x) => s + x, 0);
        if (!(c > 0)) continue;
        if (!porAmbito.has(p.ambito)) porAmbito.set(p.ambito, { registro: p.raiz, ...(p.mirada === undefined ? {} : { mirada: p.mirada }), ambito: p.ambito, cantidad: 0, titulares: [] });
        const x = porAmbito.get(p.ambito);
        x.cantidad += c;
        if (!x.titulares.includes(id)) x.titulares.push(id);
      }
    }
    return [...porAmbito.values()];
  }

  /** Reputación de una identidad: [{ emisor, cantidad }], no fungible. */
  reputaciones(identidad) {
    return this.#porSerie(identidad, 'R').map(({ emisor, cantidad }) => ({ emisor, cantidad }));
  }

  /**
   * La transacción de la capa cero que asienta `ev` con el eje de ahora
   * (VG, 9-11; src/libro.js): un paso por movimiento, en su orden.
   *   de = null                       acuñar (clase «emision»)
   *   estado 'bloqueo' / 'liberacion' bloquear / liberar, con su salida
   *   salida en una transferencia     transferir de lo bloqueado con esa salida (delegar; recoger lo que guarda una invitación)
   *   P (de ≠ null)                   transferir (o quemar, si a = null) el P de ese mismo registro (mapa §15: sin ámbitos que lo cubran)
   *   T informativo                   acuñar (clase «informativo»: si lo gastas te vuelve a salir uno) y quemar
   *   T de la asignación del día      acuñar (clase «asignacion», etiqueta = el día civil, tope = la asignación del día)
   *                                   y transferir o quemar: lo que falte sale del T explícito
   *   lo demás                        transferir, o quemar si a = null
   * Detrás, la obtención de P: lo que colocan las reglas que escriben de la época (acuñar P, clase «obtencion»).
   * Un movimiento mal formado es un paso vacío (lo cuenta la forma). `sobre` y
   * `en` son el anclaje; el payload, el memo.
   */
  transaccion(ev) {
    const reglas3 = this.orden.length >= this.eventosV2;
    // La asignación del día es de las personas (B1): de quien escribió su alta, o de quien la escribe ahora.
    const conAsignacion = reglas3 && this.#escribePersona(ev);
    const paso = (m) => {
      if (!m || typeof m !== 'object' || validarMovimiento(m).length) return [];
      const k = claveToken(m);
      const c = cantidadBase(m);
      // El P que se acuña a mano es una reposición (la regla «P is repositioned one step at a time» lo exige).
      if (m.de === null) return [acunar(k, m.a, c, m.token === 'P' ? { clase: REPOSICION_P } : {})];
      if (m.estado === 'bloqueo') return [bloquear(k, m.de, c, m.salida)];
      if (m.estado === 'liberacion') return [liberar(k, m.de, c, m.salida)];
      // La transferencia con salida (mapa §15, delegar; §16, la invitación): de lo bloqueado con esa salida.
      if (m.salida !== undefined) return [transferir(k, m.de, m.a, c, { salida: m.salida })];
      const sale = (opciones = {}) => (m.a === null ? quemar(k, m.de, c, opciones) : transferir(k, m.de, m.a, c, opciones));
      if (reglas3 && esInformativoT(m)) {
        return [acunar(k, m.de, c, { clase: INFORMATIVO }), quemar(k, m.de, c, { clase: INFORMATIVO, escala: m.escala, refiere: m.refiere, nota: m.nota })];
      }
      if (conAsignacion && gastaAsignacion(m, ev.autor, true)) {
        const a = asignacionT(ev.t, m.escala);
        return [acunar(k, m.de, c, { clase: ASIGNACION, etiqueta: a.periodo, tope: a.cantidad }), sale()];
      }
      return [sale()];
    };
    return transaccion({
      id: ev.id,
      autor: ev.autor,
      t: ev.t,
      ancla: { sobre: ev.sobre ?? null, en: ev.en ?? null },
      memo: ev.payload,
      firma: ev.firma ?? null,
      firmante: ev.firmante ?? null,
      abre: ev.contexto?.genesis === true && typeof ev.autor === 'string' ? [ev.autor] : [],
      movimientos: [...(Array.isArray(ev.movimientos) ? ev.movimientos : []).map(paso), ...(reglas3 ? this.#obtencion(ev) : [])],
    });
  }

  /**
   * La obtención de P (encargo 3b; mapa §15, N1, N2 y N3): lo que colocan las reglas que escriben de la época
   * («put» en su 4) sobre la candidata, como acuñaciones de P de la misma transacción, después de sus movimientos.
   * Cada colocación `put v at A.2.1.(r)` es un NIVEL (un estado BTML, no un incremento): «el P obtenido por A sobre r
   * por esta regla llega al menos a v». Es P posicionado en el registro r para la identidad A, de origen A (encargo
   * 3b-bis: el P guarda quién lo obtuvo): se acuña P:r/A a A con la clase «obtencion», la etiqueta = el nombre de la
   * regla y `tope: v` (la acuñación programada del libro): solo lo que falte para que lo acuñado por esa regla a A
   * sobre r llegue a v. Si ya llegó, no se acuña nada (y no se quema nada por bajar el nivel). Varias colocaciones
   * de la misma regla para el mismo A y r en una transacción: se queda el máximo nivel, no la suma. Es el tope
   * acumulado que decidió VG tras el 3b-bis (en vez de una sola obtención por regla, titular y registro): dos plazas
   * en dos transacciones dan lo mismo que en una, y una emisión de polvo solo da el P del polvo. Lo que coloca una
   * regla que no se resuelve no se acuña (la transacción mal formada ya la rechaza el suelo). No es código de negocio:
   * cuánto, a quién y dónde lo dicen las reglas.
   *
   * Un segundo tope, POR SERIE (revisión de la PR del tope acumulado): lo que una regla acuña por lo que llega de una
   * serie de E o R (la colocación lleva en `desde` el movimiento en que se hizo, src/bqlm.js) nunca pasa, sumando
   * todos los orígenes, de diez por unidad acuñada de esa serie (lo emitido antes más lo que la transacción acuña).
   * Así la misma unidad no da P dos veces aunque vuelva al emisor por un tercero y salga otra vez: lo que falte para
   * el nivel se acuña solo hasta donde llegue el cupo de sus series, y el paso apunta cuánto viene de cada una
   * (`series`), que el eje suma al asentar (obtenidoDeSerie).
   */
  #obtencion(ev) {
    const reglas = EPOCA_0_BTML.escrituras;
    if (!reglas.length || !ev || typeof ev !== 'object' || typeof ev.id !== 'string') return [];
    let ctx;
    try {
      ctx = new ContextoEje(this, { ev, epoch: EPOCA_0_BTML });
    } catch {
      return [];
    }
    // El nivel por regla, titular y registro: el máximo de lo que la regla coloca en la transacción.
    const niveles = new Map();
    for (const regla of reglas) {
      let r;
      try {
        r = evaluarEscritura(regla, ctx);
      } catch {
        continue;
      }
      if (r.estado !== 'RESUELTO') continue;
      for (const w of r.escrituras) {
        if (w.camino.length !== 2 || w.camino[0] !== 2 || w.camino[1] !== 1) continue; // solo A.2.1: el P posicionado
        if (typeof w.sujeto !== 'string' || !w.sujeto || typeof w.clave !== 'string' || !w.clave || !(w.valor > 0) || !Number.isFinite(w.valor)) continue;
        if (/[|:/]/.test(w.sujeto) || /[|:/]/.test(w.clave)) continue; // separadores de la clave de serie
        // P por mirada (VG, tras 3b-bis): `put v at A.2.1.(r).d` coloca sobre la mirada d de r («r.d»); sin dígito, sobre r entero.
        if (w.posicion !== undefined && (w.posicion.length !== 1 || !Number.isInteger(w.posicion[0]) || w.posicion[0] < 0 || w.posicion[0] > 9)) continue;
        const ambito = ambitoDe(w.clave, w.posicion?.[0]);
        const etiqueta = nombreDeRegla(regla);
        const vez = JSON.stringify([etiqueta, w.sujeto, ambito]);
        if (!niveles.has(vez)) niveles.set(vez, { etiqueta, sujeto: w.sujeto, registro: ambito, valor: w.valor, desde: [] });
        const nivel = niveles.get(vez);
        if (w.valor > nivel.valor) nivel.valor = w.valor;
        // La serie de la que viene la colocación (el movimiento del where en que se hizo), para el tope por serie.
        const m = w.desde?.k === 'mov' ? w.desde.m : null;
        const fuente = m && typeof m === 'object' && !validarMovimiento(m).length && m.token !== 'P' && m.token !== 'T' ? claveToken(m) : null;
        if (fuente && !nivel.desde.includes(fuente)) nivel.desde.push(fuente);
      }
    }
    // El cupo de cada serie en esta transacción: diez por unidad acuñada (antes, y lo que acuña la candidata) menos lo
    // que la regla ya acuñó por ella, de todos los orígenes; lo que se reparte aquí también se descuenta.
    const acunadaAqui = (fuente) => (Array.isArray(ev.movimientos) ? ev.movimientos : []).reduce((s, m) => s + (m && typeof m === 'object' && m.de === null && !validarMovimiento(m).length && claveToken(m) === fuente ? cantidadBase(m) : 0), 0);
    const usado = new Map();
    const cupo = (etiqueta, fuente) => DIEZ_POR_UNIDAD * (this.#libro.sumas({ primitiva: 'acunar', serie: fuente, clase: EMISION }) + acunadaAqui(fuente)) - this.obtenidoDeSerie(fuente, etiqueta) - (usado.get(L2(etiqueta, fuente)) ?? 0);
    const pasos = [];
    for (const { etiqueta, sujeto, registro, valor, desde } of niveles.values()) {
      const serie = claveToken({ token: 'P', ambito: registro, origen: sujeto });
      // Lo ya acuñado por esa regla a ese titular sobre ese registro: si llega al nivel, no hay paso (ni vacío).
      const ya = this.libro.sumas({ primitiva: 'acunar', serie, titular: sujeto, clase: OBTENCION, etiqueta });
      if (!(valor > ya)) continue;
      let falta = valor - ya;
      const opciones = { clase: OBTENCION, etiqueta, regla: etiqueta };
      if (desde.length) {
        // El tope por serie: lo que falta se cubre con el cupo de las series de donde viene, en su orden.
        const series = [];
        for (const fuente of desde) {
          const parte = Math.min(falta, Math.max(0, cupo(etiqueta, fuente)));
          if (!(parte > 0)) continue;
          series.push([fuente, parte]);
          usado.set(L2(etiqueta, fuente), (usado.get(L2(etiqueta, fuente)) ?? 0) + parte);
          falta -= parte;
          if (!(falta > 0)) break;
        }
        const cubierto = series.reduce((s, [, c]) => s + c, 0);
        if (!(cubierto > 0)) continue;
        opciones.series = series;
        falta = cubierto;
      }
      const tope = ya + falta;
      pasos.push([acunar(serie, sujeto, tope, { ...opciones, tope })]);
    }
    return pasos;
  }

  /**
   * Lo que leen las condiciones (src/condiciones/) de la transacción de `ev`:
   * el eje de antes del evento. `evento` es el registro; `ciclo`, `tope` y `r`,
   * los contextos de las reglas del ciclo, de la E atada y de R.
   */
  contexto(ev) {
    const eje = this;
    const reglas = this.orden.length < this.eventosV2 ? 2 : 3;
    let ciclo;
    let tope;
    let validos;
    return {
      evento: ev,
      reglas,
      tLaxo: reglas === 2,
      exigirFirmas: this.exigirFirmas,
      exigeClave: this.#exigeClave(),
      registrado: (id) => this.eventos.has(id),
      registro: (id) => this.eventos.get(id),
      clave: (id) => this.claves.get(id),
      tieneClave: (id) => this.claves.has(id),
      // B1: persona o cosa por autoría del alta (esPersona); en el prefijo de la versión 2, el tipo que se declaraba.
      persona: (id) => this.esPersona(id),
      tipoV2: (id) => this.tipoV2(id),
      tipoV2Declarado: (id) => this.#tiposV2.has(id),
      // Los movimientos bien formados del evento, con su índice: los leen varias condiciones.
      get validos() { return (validos ??= validosDe(ev)); },
      // Las reglas de la época (src/condiciones/reglas.js) leen el eje de antes con el BQL mínimo.
      contextoBqlm: (epoch) => new ContextoEje(eje, { ev, epoch }),
      get ciclo() { return (ciclo ??= eje.#contextoCiclo(ev)); },
      get tope() { return (tope ??= eje.#contextoTope()); },
    };
  }

  /**
   * Errores que impedirían añadir el evento; vacío si es admisible. Se valida
   * la copia que se guardaría (normalizarEvento), nunca lanza por la forma.
   * El evento se traduce a su transacción y el libro la prueba con las
   * condiciones (src/condiciones/index.js, CONDICIONES) y su aritmética.
   */
  async validar(crudo) {
    let ev;
    try {
      ev = normalizarEvento(crudo);
    } catch (e) {
      return ['no cabe en JSON: ' + e.message];
    }
    if (!ev || typeof ev !== 'object') return validarForma(ev, { tLaxo: this.orden.length < this.eventosV2 });
    const { motivos } = await this.#libro.probar(this.transaccion(ev), CONDICIONES, this.contexto(ev));
    return textos(ev, motivos);
  }

  /**
   * Lo que leen las reglas del ciclo (src/ciclo.js): el eje de antes del evento
   * `ev`. El alta de quien entró en el prefijo de la versión 2 cuenta, para el
   * reloj y el tope de T, desde el primer evento de la versión 3 (acotarAltaV2).
   */
  #contextoCiclo(ev) {
    const primeroV3 = () => (this.orden.length > this.eventosV2 ? this.obtener(this.orden[this.eventosV2]).t : ev.t);
    return {
      // B1: true, false (una cosa) o null (sin alta: si escribe, escribe su propia alta).
      persona: (id) => this.esPersona(id),
      // Las reglas de la versión 2 (suelo de persistencia) leen el tipo que se declaraba entonces.
      tipo: (id) => this.tipoV2(id),
      alta: (id) => {
        const a = this.alta(id);
        return a && this.#prefijoV2.has(a.id) ? acotarAltaV2(a, primeroV3()) : a;
      },
      tMaximo: () => this.#tMax,
      gastadoT: (id, escala, periodo) => this.gastadoT(id, escala, periodo),
      serie: (k) => this.#serieCruda(k),
      registro: (id) => this.eventos.get(id),
      saldo: (id, k) => this.saldo(id, k),
      reglas: this.orden.length < this.eventosV2 ? 2 : 3,
      genesisId: this.genesisId,
    };
  }

  /** Lo que leen las reglas del tope (reglasDelTope): el eje de antes del evento. */
  #contextoTope() {
    const hilos = new Map();
    const hiloDe = (id) => {
      if (!hilos.has(id)) hilos.set(id, new Set(this.hilo(id).map((e) => e.id)));
      return hilos.get(id);
    };
    return {
      reglas: this.orden.length < this.eventosV2 ? 2 : 3,
      tMaximo: (excluidos) => this.tMaximo(excluidos ?? []),
      registro: (id) => this.eventos.get(id),
      alta: (id) => this.alta(id),
      serie: (k) => this.#serieCruda(k),
      seriesE: () => [...this.#series.keys()].filter((k) => k.startsWith('E:')).map((k) => [k, this.#serieCruda(k)]),
      topes: (registro) => this.#topesDe(registro),
      dentro: (registro, ancestro) => Boolean(registro) && this.eventos.has(registro) && hiloDe(registro).has(ancestro),
      bloqueado: (id, k, salida) => this.bloqueado(id, k, salida),
      bloqueadoP: (id, salida) => this.bloqueos(id).filter((b) => b.token === 'P' && b.salida === salida).reduce((s, b) => s + b.cantidad, 0),
      bloqueosP: () => this.identidades().flatMap((id) => this.bloqueos(id).filter((b) => b.token === 'P').map((b) => ({ titular: id, clave: b.clave, salida: b.salida, cantidad: b.cantidad }))),
    };
  }

  /**
   * Añade un evento válido y aplica sus movimientos. Lanza si no es admisible.
   * Guarda y devuelve su copia normalizada y congelada, no el objeto recibido.
   * Es una transacción del libro con las condiciones de siempre: entera o nada.
   */
  async anadir(crudo) {
    const ev = copiaGuardable(crudo);
    const tx = this.transaccion(ev);
    const { motivos, simulacion } = await this.#libro.probar(tx, CONDICIONES, this.contexto(ev));
    if (motivos.length) {
      const errores = textos(ev, motivos);
      throw new Error('evento rechazado: ' + (errores.length ? errores : motivos.map((m) => m.texto)).join('; '));
    }
    this.#aplicar(ev, tx, simulacion); // la copia de copiaGuardable ya está congelada entera: lo guardado no se modifica en sitio
    return ev;
  }

  /**
   * ¿Rige aquí «sin clave no se actúa» (R9)? Sí, salvo en un eje de
   * demostración y en los eventos del prefijo de la versión 2, que se validan
   * con las reglas de entonces.
   */
  #exigeClave() {
    return !this.demostracion && this.orden.length >= this.eventosV2;
  }

  /**
   * Crea, valida y añade en un paso. Con `privada`, firma antes de añadir.
   * `posesion` ({ identidad: privada }) añade la prueba de posesión de cada
   * clave que el evento declara en su contexto (R9): la clave nueva firma el id.
   */
  async escribir(datos, privada, posesion = {}) {
    let ev = await crearEvento(datos);
    for (const [id, priv] of Object.entries(posesion)) ev = await firmarPosesion(ev, id, priv);
    if (privada) ev = await firmar(ev, privada);
    return this.anadir(ev);
  }

  /**
   * Invitar (VG, 9-11, mapa §16 [D] «El árbol mínimo es la invitación»; encargo 3b): `autor` escribe la invitación
   * de `invitado`, una transacción suya anclada en el 3 de su alta, cuyo payload es la décupla de la invitación:
   *   0 «invitation»; 1 lo que te doy (mínimo mi R: te permite escribirme); 2 las reglas, la referencia a la época 0;
   *   3 yo (3.0), tú (3.1), el grupo común si lo hay (3.2) y tu clave (3.5); 4 aceptar: tu primera transacción
   *   firmada, tu alta; 5 el dominio al que te invito; 6 mi hilo (mi alta); 7 hasta cuándo vale; 8 el grupo de mi
   *   atención que te asigno (su zona); 9 el tema y el tutorial.
   * Lo que da (`da`: movimientos sin de ni a, por omisión una unidad de su R) lo bloquea con la salida = `invitado`:
   * quien acepta lo recoge en su alta (la salida nombra a quien lo recibe). Su R, si no la tiene, la acuña antes en la
   * misma transacción (emitir R exige T real: quema un minuto). `clave` es la clave pública del invitado (hex): si
   * va, solo vale una aceptación declarada y firmada con ella. Devuelve la invitación.
   */
  async invitar({ autor, invitado, clave, da = [{ token: 'R', cantidad: 1 }], grupo = 0, dominio, comun, hasta, tema, t, privada } = {}) {
    const alta = this.alta(autor);
    if (!alta) throw new Error('invitar: ' + autor + ' no tiene alta');
    if (typeof invitado !== 'string' || !invitado || this.alta(invitado)) throw new Error('invitar: el invitado es una identidad nueva, sin alta: ' + invitado);
    const movimientos = [{ token: 'T', escala: 'minuto', cantidad: 1, de: autor, a: null }];
    const acunada = new Map();
    for (const d of da) {
      const m = { ...d, ...(d.token === 'E' || d.token === 'R' ? { emisor: d.emisor ?? autor } : {}) };
      if (m.token === 'R' && m.emisor === autor) {
        const falta = m.cantidad - Math.max(0, this.saldo(autor, 'R:' + autor) - (acunada.get('usada') ?? 0));
        if (falta > 0) movimientos.push({ token: 'R', emisor: autor, cantidad: falta, de: null, a: autor });
        acunada.set('usada', (acunada.get('usada') ?? 0) + m.cantidad);
      }
      movimientos.push({ ...m, de: autor, a: autor, estado: 'bloqueo', salida: invitado });
    }
    const x = typeof clave === 'string' && clave ? clave : null;
    const tres = [[autor], [invitado], ...(comun || x ? [comun ? [{ ref: comun }] : ['sin grupo común']] : []), ...(x ? [['yo y tú'], ['te invito'], [x]] : [])];
    const payload = [
      ['invitation'],
      da.length ? da.map((d) => d.cantidad + ' ' + (d.token === 'R' || d.token === 'E' ? d.token + ':' + (d.emisor ?? autor) + (d.denominacion ? '/' + d.denominacion : '') : d.token === 'P' ? claveToken({ ...d, de: autor }) : d.token + ':' + d.ambito)) : ['nada'],
      [{ ref: EPOCA_0_BTML.id }],
      tres,
      ['tu primera transacción firmada, anclada sobre esta invitación: tu alta'],
      [{ ref: dominio ?? alta.id }],
      [{ ref: alta.id }],
      [hasta ?? 'sin plazo'],
      [grupo],
      [tema ?? 'invitación de ' + autor],
    ];
    return this.escribir({ autor, sobre: alta.id, en: '3000000000', t, movimientos, payload }, privada);
  }

  /**
   * Aceptar una invitación (mapa §16 [D]: «4 aceptar = tu primera transacción firmada = tu alta»; encargo 3b): la
   * primera transacción de la persona nueva, anclada sobre la invitación y firmada con su clave (`clave`: { publica,
   * privada }, o nada en un eje de demostración). Recoge lo que la invitación le guarda (lo que quien invita bloqueó
   * con la salida = ella) y quema un minuto de su día. Es su alta: la escribe ella, así que es una persona (B1).
   * Sustituye a `entrar` (el alta propia abierta): sin invitación solo entra la primera identidad, la del génesis.
   */
  async aceptar(invitacion, clave = {}, { t, payload } = {}) {
    const inv = this.obtener(typeof invitacion === 'string' ? invitacion : invitacion?.id);
    if (!inv) throw new Error('aceptar: la invitación no está en el eje');
    const hoja = (x) => (Array.isArray(x) ? x[0] : x);
    const quien = hoja(inv.payload?.[3]?.[1]);
    if (typeof quien !== 'string') throw new Error('aceptar: la invitación no nombra a quién invita (su 3.1)');
    const regalos = this.bloqueos(inv.autor).filter((b) => b.salida === quien);
    const movimientos = [
      { token: 'T', escala: 'minuto', cantidad: 1, de: quien, a: null },
      ...regalos.map((b) => {
        const { token, emisor, denominacion, registro, ambito, origen } = b;
        return { token, ...(emisor ? { emisor } : {}), ...(denominacion ? { denominacion } : {}), ...(registro ? { registro } : {}), ...(ambito ? { ambito } : {}), ...(origen ? { origen } : {}), cantidad: b.cantidad, de: inv.autor, a: quien, salida: quien };
      }),
    ];
    return this.escribir({
      autor: quien,
      sobre: inv.id,
      t: t ?? inv.t,
      movimientos,
      payload: payload ?? ['Alta de ' + quien],
      contexto: clave?.publica ? { claves: { [quien]: clave.publica } } : {},
    }, clave?.privada);
  }

  /** Hilo: desde el evento hasta el génesis siguiendo la referencia sobre. */
  hilo(id) {
    const cadena = [];
    let ev = this.eventos.get(id);
    while (ev) {
      cadena.push(ev);
      ev = ev.sobre === null ? undefined : this.eventos.get(ev.sobre);
    }
    return cadena;
  }

  /** Eventos escritos sobre un registro (sus hijos directos), opcionalmente solo en una posición. */
  sobre(id, en) {
    if (en === undefined) return this.hijos.get(id)?.slice() ?? [];
    // Lo mismo que filtrar los hijos por `e.en === en`, sin recorrerlos (docs/notas/RENDIMIENTO.md).
    return this.#hijosEn.get(id)?.get(en)?.slice() ?? [];
  }

  /**
   * Escritos anclados en (`id`, `en`) cuyos autores están en `autores` (un
   * Set), en orden de entrada: lo mismo que filtrar `sobre(id, en)` por autor,
   * sin recorrer lo de los demás (R8: el ruido ajeno no cuesta al dueño).
   */
  sobreDe(id, en, autores) {
    const porAutor = this.#porAutor.get(id)?.get(en);
    if (!porAutor) return [];
    const listas = [...autores].map((a) => porAutor.get(a)).filter(Boolean);
    if (listas.length === 1) return listas[0].slice();
    return listas.flat().sort((a, b) => this.#llegada.get(a.id) - this.#llegada.get(b.id));
  }

  /** Cuántos escritos hay anclados en (`id`, `en`), sin copiarlos. */
  cuantosSobre(id, en) {
    return this.#hijosEn.get(id)?.get(en)?.length ?? 0;
  }

  /**
   * Aplica un evento ya validado: asienta su transacción en el libro (la de
   * probar, `simulacion`, si es la de este momento) y lleva los índices del
   * eje (lo escrito sobre cada registro, por autor, por prefijo; el reloj; las
   * claves y los tipos; qué series existen y su contrato).
   */
  #aplicar(ev, tx = this.transaccion(ev), simulacion = undefined) {
    // Demostración: solo la bandera firmada del génesis (SEG-02, revisión de main 7-11 noche). Un eje que viene
    // de la versión 2 no es de demostración por serlo: la exención de clave vale solo dentro de su prefijo
    // (#exigeClave), no para lo que se le añade después.
    if (ev.contexto?.genesis === true) this.demostracion = ev.contexto.demostracion === true;
    // La asignación diaria de T (VG, 8-11) rige fuera del prefijo de la versión 2, para una persona (B1): quien
    // escribió su alta, o quien la escribe ahora. Se mira antes de asentar: después ya tiene cuenta.
    const reglas3 = this.orden.length >= this.eventosV2;
    const conAsignacion = reglas3 && this.#escribePersona(ev);
    const asientos = this.#libro.asentar(tx, simulacion);
    this.#llegada.set(ev.id, this.orden.length);
    this.eventos.set(ev.id, ev);
    this.orden.push(ev.id);
    if (this.orden.length <= this.eventosV2) this.#prefijoV2.add(ev.id);
    const ms = msDeGuardado(ev.t);
    if (ms > this.#tMax) this.#tMax = ms;
    if (ms > (this.#tPorAutor.get(ev.autor) ?? -Infinity)) this.#tPorAutor.set(ev.autor, ms);
    const cabeza = ev.id.slice(0, PREFIJO);
    if (!this.#prefijos.has(cabeza)) this.#prefijos.set(cabeza, []);
    this.#prefijos.get(cabeza).push(ev.id);
    if (ev.sobre !== null) {
      if (!this.hijos.has(ev.sobre)) this.hijos.set(ev.sobre, []);
      this.hijos.get(ev.sobre).push(ev);
      if (!this.#hijosEn.has(ev.sobre)) this.#hijosEn.set(ev.sobre, new Map());
      const porEn = this.#hijosEn.get(ev.sobre);
      if (!porEn.has(ev.en)) porEn.set(ev.en, []);
      porEn.get(ev.en).push(ev);
      // El índice por autor (R8, sobreDe): id → en → autor → eventos.
      if (!this.#porAutor.has(ev.sobre)) this.#porAutor.set(ev.sobre, new Map());
      const enDe = this.#porAutor.get(ev.sobre);
      if (!enDe.has(ev.en)) enDe.set(ev.en, new Map());
      const deAutor = enDe.get(ev.en);
      if (!deAutor.has(ev.autor)) deAutor.set(ev.autor, []);
      deAutor.get(ev.autor).push(ev);
    }
    for (const [id, clave] of Object.entries(ev.contexto?.claves ?? {})) this.claves.set(id, clave);
    // Los tipos solo se leen en el prefijo de la versión 2 (suelo de persistencia); fuera no hay tipo (B1).
    if (!reglas3) for (const [id, tipo] of Object.entries(ev.contexto?.tipos ?? {})) this.#tiposV2.set(id, tipo);
    // Qué series existen, en orden de aparición, con su emisor y su contrato (las cantidades son del libro). Una
    // serie aparece con su primera emisión; una de T, también con su primer consumo o con la primera asignación que
    // sale de las manos de su persona.
    const deAsignacion = (i) => asientos.some((a) => a.paso === i && a.primitiva === 'acunar' && a.clase === ASIGNACION && a.cantidad > 0);
    const registrar = (k, emisor, contrato) => {
      if (!this.#series.has(k)) this.#series.set(k, { emisor, ...(contrato ? { contrato } : {}) });
    };
    ev.movimientos.forEach((m, i) => {
      if (m.estado === 'bloqueo' || m.estado === 'liberacion') return;
      const k = claveToken(m);
      if (m.de === null) {
        const emisor = m.token === 'E' || m.token === 'R' ? m.emisor : ev.autor;
        if (m.token !== 'E') return registrar(k, emisor);
        const { consumido: _consumido, ...contrato } = contratoE(m, this.alta(m.emisor)?.id);
        return registrar(k, emisor, contrato);
      }
      if (m.token !== 'T') return undefined;
      if (reglas3 && esInformativoT(m)) return registrar(k, ev.autor);
      if ((conAsignacion && gastaAsignacion(m, ev.autor, true)) || esConsumoT(m, ev.autor)) {
        if (m.a === null || deAsignacion(i)) registrar(k, ev.autor);
      }
      return undefined;
    });
    // El P obtenido (encargo 3b: lo que acuñan las reglas que escriben) también abre su serie, a nombre de su origen; y
    // lo que viene de cada serie de E o R se apunta para el tope por serie (VG, tras 3b-bis).
    for (const a of asientos) {
      if (a.clase !== OBTENCION || a.primitiva !== 'acunar') continue;
      registrar(a.serie, a.a);
      for (const [serie, cantidad] of a.origen?.series ?? []) {
        const k = L2(a.etiqueta, serie);
        this.#obtenidoDeSerie.set(k, (this.#obtenidoDeSerie.get(k) ?? 0) + cantidad);
      }
    }
  }

}

/**
 * Los textos de los motivos de una transacción del eje, en orden: los de las
 * condiciones tal cual y los fallos de la aritmética del libro con el texto
 * de siempre (el del movimiento que falla). El gasto de la asignación del día
 * que no alcanza no tiene texto aquí: lo dice TT-4 («T del día agotado»).
 */
function textos(ev, motivos) {
  return motivos.map((motivo) => (motivo.fallo ? textoDeFallo(ev, motivo.fallo) : motivo.texto)).filter((x) => x !== null);
}

function textoDeFallo(ev, fallo) {
  const m = ev.movimientos[fallo.paso];
  const k = claveToken(m);
  if (fallo.falta === 'finito') return 'la serie ' + k + ' no admite tanto';
  if (m.estado === 'bloqueo') return 'saldo disponible insuficiente para bloquear ' + k + ' en ' + m.de;
  if (m.estado === 'liberacion' || (m.salida !== undefined && m.estado === undefined)) return 'no hay ' + m.cantidad + ' de ' + k + ' bloqueado en ' + m.de + ' con la salida «' + m.salida + '»';
  if (m.token === 'P') return 'saldo insuficiente de P sobre ' + (m.ambito === AMBITO_GENESIS ? 'el eje' : m.ambito.slice(0, 8)) + (origenDe(m) === m.de ? '' : ' de origen ' + origenDe(m)) + ' en ' + m.de;
  if (fallo.grupo.some((x) => x.primitiva === 'acunar' && x.clase === ASIGNACION)) return null; // lo dice TT-4
  return 'saldo insuficiente de ' + k + ' en ' + m.de;
}

/**
 * ¿Ha caducado la serie `clave` en el instante `t`? Solo las series de E
 * pueden llevar caducidad, y la fija su primera emisión. Es un campo del
 * contrato de la serie: nada se ejecuta solo al caducar; BQL o el motor
 * pueden leerlo (VG, 7-11 noche).
 */
export function caducada(eje, clave, t) {
  const caduca = eje.serie(clave).caduca;
  if (!caduca) return false;
  const ahora = segundosUTC(t);
  if (Number.isNaN(ahora)) throw new Error('caducada: t debe ser instante ISO-8601 con zona explícita');
  return ahora >= segundosUTC(caduca); // en segundos (VG, 10-11, C2)
}

/** La copia que guarda el eje (normalizarEvento); lo que no cabe en JSON se rechaza. */
function copiaGuardable(ev) {
  try {
    return normalizarEvento(ev);
  } catch (e) {
    throw new Error('evento rechazado: no cabe en JSON (' + e.message + ')');
  }
}
