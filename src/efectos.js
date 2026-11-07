// Catálogo de efectos: cada operación dice qué cambió, de qué clase y cómo se
// ve en su mundo. Sobrio y animado son dos renders de la misma operación
// (FUNDAMENTOS): los dos leen esta lista.
//
// Un efecto sale del evento y de lo que el núcleo ya sabe de él; no guarda
// estado aparte. Fuera del evento se mira lo justo (docs/EFECTOS.md, «De
// dónde sale»): el foco y lo escrito antes en la misma dirección, para saber
// si el registro colisiona (src/encaje.js), y, en los registros del motor, si
// el motor reconoce su fase (src/motor.js). Cuatro fuentes, en este orden:
// - el registro entero: ocupa la dirección `en` del foco como un ocupante más
//   (encaje.ocupantes). Si ya tenía ocupantes antes que él, colisiona:
//   sustituir; si es el primero donde el foco no llega, anclado. Su posición,
//   subposición y clase son los tres dígitos de `en` leídos desde la raíz del
//   foco (mapa §13 [D] con n = 0; el registro no guarda su camino: [X]);
// - lo que trae dentro, celda a celda, en la misma lectura: la celda de un
//   nodo es `en` seguido de su ruta, hasta la profundidad 3. Leer así un
//   registro cualquiera como la matriz 10×10×10 está decidido solo para el
//   registro de salida de la fábrica: [X];
// - cada movimiento de tokens, que no ocurre en una celda sino entre carteras;
// - la fase de un registro del motor (contexto.fase), si el motor la
//   reconoce; si no, ruido. Un registro del motor no se lee celda a celda: su
//   payload tiene el formato del motor.
// Cada efecto: { evento, tipo, mundo, celda, clase, … } con su nombre,
// metáfora y fuente del catálogo, y en `decisiones` las marcas «[X] decidir
// VG» que le tocan. Los nombres viven en datos/efectos.json (por mundo y por
// tipo); datos/efectos.js es su copia importable, generada.

import { ARIDAD, esReferencia, esDireccion, indicesDe, direccion } from './btml.js';
import { claveToken } from './tokens.js';
import { RAIZ } from './evento.js';
import { ocupantes } from './encaje.js';
import { FABRICA, FASES as FASES_MOTOR, autorizacionesValidas, consolidaciones, esConsolidacion } from './motor.js';
import { CATALOGO_EFECTOS } from '../datos/efectos.js';

function congelar(x) {
  if (x && typeof x === 'object' && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const v of Object.values(x)) congelar(v);
  }
  return x;
}

/** El catálogo entero (datos/efectos.json), congelado. */
export const CATALOGO = congelar(CATALOGO_EFECTOS);

/** Tipos de efecto: los seis primeros, del registro o de una celda suya; token, de un movimiento; fase y ruido, de un registro del motor. */
export const TIPOS_EFECTO = Object.freeze(['ver', 'sustituir', 'anclado', 'escrito', 'impulso', 'modificar', 'token', 'fase', 'ruido']);

/** Marcas «[X] decidir VG» que un efecto puede llevar (datos/efectos.json, `marcas`). */
export const MARCAS_EFECTO = CATALOGO.marcas;

/** Marca de lo que el catálogo no nombra en un mundo. */
export const SIN_NOMBRE = CATALOGO.marcas.sinNombre;

/** Profundidad de la matriz: posición, subposición y clase. */
const MATRIZ = 3;

/** Nombre corto del mundo de un PV: «lente», «ciudad», «hilos del pasado»… */
export function nombreMundo(pv) {
  const m = Number.isInteger(pv) ? CATALOGO.mundos[pv] : undefined;
  if (!m) throw new RangeError('mundo fuera de 0–9: ' + pv);
  return m.nombre;
}

function comoCamino(marco) {
  if (typeof marco === 'string') {
    if (!esDireccion(marco)) throw new TypeError('el marco es una dirección de diez dígitos o una lista de índices');
    return indicesDe(marco);
  }
  if (!Array.isArray(marco) || marco.length > ARIDAD || marco.some((x) => !Number.isInteger(x) || x < 0 || x > 9)) {
    throw new TypeError('el marco es una dirección de diez dígitos o una lista de índices');
  }
  return marco;
}

/**
 * Clase de una celda vista desde un camino (el marco): el dígito en la
 * profundidad n+2, con n la del marco (mapa §13 [D]). El marco es una lista
 * de índices (exacta: [1, 0] no es [1]) o una dirección; por defecto, la
 * raíz. La celda ha de estar bajo el marco.
 */
export function claseRelativa(celda, marco = []) {
  if (!esDireccion(celda)) throw new TypeError('la celda es una dirección de diez dígitos');
  const m = comoCamino(marco);
  const n = m.length;
  if (celda.slice(0, n) !== direccion(m).slice(0, n)) throw new RangeError('la celda ' + celda + ' no está bajo el marco ' + (m.join('.') || 'raíz'));
  return n + 2 < ARIDAD ? Number(celda[n + 2]) : 0;
}

/** Posición, subposición y clase de un camino exacto visto desde un marco, y su celda. */
function situar(camino, marco) {
  const n = marco.length;
  const i = camino[n] ?? 0;
  const j = camino[n + 1] ?? 0;
  const k = camino[n + 2] ?? 0;
  return { mundo: i, celda: direccion(camino), camino, marco, posicion: i, subposicion: j, clase: k, etiqueta: [i, j, k].join('.') };
}

const tipoPorClase = (k) => (k === 1 ? 'impulso' : k >= 2 ? 'modificar' : null);

// ---------- el registro entero ----------

/**
 * Ocupantes de la dirección `en` del foco que estaban antes que el registro:
 * los del propio foco (sus caminos y lo que alcanzan sus referencias) y lo
 * escrito allí antes que él (encaje.ocupantes). Lo escrito después no cuenta.
 */
function ocupantesPrevios(eje, ev, foco, en) {
  const hermanos = eje.sobre(foco.id, en);
  const k = hermanos.findIndex((h) => h.id === ev.id);
  const antes = new Set((k < 0 ? hermanos : hermanos.slice(0, k)).map((h) => h.id));
  return ocupantes(eje, foco.id, indicesDe(en), { orden: 'llegada' })
    .filter((o) => o.origen !== 'escrito' || antes.has(o.evento))
    .map((o) => ({ origen: o.origen, evento: o.evento, camino: o.camino }));
}

/**
 * El registro como ocupante de su dirección. Un escrito ocupa la dirección
 * entera (encaje: sus caminos con ceros finales colisionan en ella), así que
 * su camino es el de `en` sin ceros finales. Clase 0: ver si el registro es
 * una referencia a su foco; sustituir si colisiona; anclado si es el primero.
 */
function efectoDelRegistro(eje, ev, foco, en, marco = []) {
  const sitio = situar(indicesDe(en), marco);
  if (!foco) return { tipo: 'escrito', ...sitio, ruta: [], colisiona: 0, con: [] };
  const con = ocupantesPrevios(eje, ev, foco, en);
  const verFoco = esReferencia(ev.payload) && ev.payload.ref === ev.sobre;
  const tipo = tipoPorClase(sitio.clase) ?? (verFoco ? 'ver' : con.length ? 'sustituir' : 'anclado');
  return { tipo, ...sitio, ruta: [], colisiona: con.length, con };
}

// ---------- lo que trae dentro ----------

/** Etiqueta normalizada a tres dígitos: 2 → «2.0.0», «2.1» → «2.1.0». */
function normal(e) {
  const r = String(e).split('.');
  while (r.length < 3) r.push('0');
  return r.join('.');
}

function marcasDe(lista) {
  return Array.isArray(lista) ? new Set(lista.map(normal)) : null;
}

/**
 * Celdas de un array: cada nodo cuya dirección (`en` seguido de su ruta)
 * llega a la profundidad 3 tras el marco (3 desde la raíz), o un terminal
 * antes; lo que cuelga más hondo es contenido de esa celda. La posición 0, 0.0… es la representación del
 * registro: colisiona con él en su dirección (encaje.caminosDe) y no da un
 * efecto aparte.
 */
function celdasDe(ev, en, marco = []) {
  if (!Array.isArray(ev.payload)) return [];
  const hondo = marco.length + MATRIZ;
  const base = indicesDe(en);
  const celdas = [];
  const recorrer = (nodo, ruta) => {
    const camino = [...base, ...ruta];
    if (Array.isArray(nodo) && camino.length < hondo) {
      nodo.forEach((h, x) => recorrer(h, [...ruta, x]));
      return;
    }
    if (ruta.every((x) => x === 0)) return;
    celdas.push({ ruta, camino, nodo });
  };
  recorrer(ev.payload, []);
  return celdas;
}

/**
 * Tipo de una celda de dentro, o null si es herencia. Una referencia al foco
 * es herencia salvo que el registro la marque como vista (contexto.vistas; o
 * fuera de contexto.heredadas si las lista, como la PR #40); las marcas
 * nombran la ruta en el payload («i.j»). Ver es clase 0. Lo demás, por su
 * clase: 0 escrito, 1 impulso, 2–9 modificar. Una celda de dentro no
 * colisiona: el núcleo solo cuenta como ocupante el registro entero.
 */
function tipoDeCelda(ev, c, clase, vistas, heredadas) {
  if (esReferencia(c.nodo) && c.nodo.ref === ev.sobre) {
    if (clase !== 0) return null;
    const e = normal(c.ruta.join('.'));
    if (vistas?.has(e)) return 'ver';
    if (heredadas && !heredadas.has(e)) return 'ver';
    return null;
  }
  return tipoPorClase(clase) ?? 'escrito';
}

// ---------- el motor ----------

/** Lo que el motor reconoce de un registro con fase: { cuenta, motivo }. Sigue a src/motor.js. */
function faseReconocida(eje, ev) {
  const fase = ev.contexto.fase;
  if (!eje.obtener(ev.id)) return { cuenta: false, motivo: 'no está en el eje' };
  const en = ev.en ?? RAIZ;
  if (fase === 'consolidado') {
    // consolidaciones() lista las ancladas en la posición 4 de su camino.
    const camino = indicesDe(en).slice(0, -1);
    const listada = consolidaciones(eje, ev.sobre, camino).some((c) => c.id === ev.id);
    return listada ? { cuenta: true } : { cuenta: false, motivo: 'fuera de la fábrica: el motor consolida en la posición 4 de su camino' };
  }
  const c = eje.obtener(ev.sobre);
  if (!esConsolidacion(c)) return { cuenta: false, motivo: 'no es sobre una consolidación' };
  if (en !== FABRICA) return { cuenta: false, motivo: 'fuera de la fábrica de la consolidación' };
  if (fase === 'autorizado') {
    const validas = autorizacionesValidas(eje, c.id);
    // Autorizar es bloquear P sobre el registro del recurso (VG, 7-11 noche): cuenta cada una que lo bloquea,
    // también la del autor; si la consolidación queda AUTORIZADA lo decide la suma contra el umbral.
    if (!validas.some((a) => a.id === ev.id)) return { cuenta: false, motivo: 'no bloquea P sobre el registro del recurso' };
    return { cuenta: true };
  }
  // ejecutado: la misma condición con la que estadoDe() da EJECUTADO.
  if (ev.autor !== c.autor) return { cuenta: false, motivo: 'ejecuta quien no es el autor de la consolidación' };
  const valida = (e) => e.contexto?.fase === 'ejecutado' && e.autor === c.autor && (e.contexto.evidencia ?? []).every((id) => eje.obtener(id));
  if (!valida(ev)) return { cuenta: false, motivo: 'evidencia rota' };
  const primera = eje.sobre(c.id, FABRICA).find(valida);
  return primera.id === ev.id ? { cuenta: true } : { cuenta: false, motivo: 'ya estaba ejecutada' };
}

/** Lo que consolidó cada posición: elegida (una referencia), nueva (un terminal) o heredada del foco (un hueco). */
function eleccionesDe(ev, camino) {
  if (!Array.isArray(ev.payload)) return [];
  const elegidas = new Set((ev.contexto.encaje ?? []).map((e) => e.posicion));
  return ev.payload.slice(1).map((x, k) => {
    const posicion = k + 1;
    const celda = camino.length < ARIDAD ? direccion([...camino, posicion]) : null;
    if (!esReferencia(x)) return { posicion, celda, desde: 'nueva' };
    const desde = x.ref === ev.sobre && !elegidas.has(posicion) ? 'heredada' : 'elegida';
    return { posicion, celda, desde, ref: x.ref, dir: x.dir ?? RAIZ };
  });
}

// ---------- nombres ----------

function claves(ef) {
  if (ef.tipo === 'token') return ['token.' + ef.movimiento, '*'];
  if (ef.tipo === 'fase') return ['fase.' + ef.fase, '*'];
  if (ef.tipo === 'modificar') return ['modificar.' + ef.clase, 'modificar', '*'];
  return [ef.tipo, '*'];
}

function entrada(mundo, ef) {
  const efectos = CATALOGO.mundos[mundo]?.efectos ?? {};
  for (const k of claves(ef)) if (Object.hasOwn(efectos, k)) return efectos[k];
  return null;
}

function generico(ef) {
  if (ef.tipo === 'token') return CATALOGO.tipos.token.generico[ef.movimiento] + ' ' + ef.token;
  if (ef.tipo === 'fase') return CATALOGO.tipos.fase.generico[ef.fase];
  if (ef.tipo === 'modificar') {
    const n = CATALOGO.clases[ef.clase]?.nombre;
    return 'modificar (' + (n ?? 'clase ' + ef.clase) + ')';
  }
  return CATALOGO.tipos[ef.tipo].generico;
}

/** Nombre, metáfora y fuente en un mundo, con las marcas: la del nombre primero, después las del efecto. */
function nombrar(ef, marcas) {
  const e = entrada(ef.mundo, ef);
  const deClase = ef.tipo === 'modificar' && CATALOGO.clases[ef.clase]?.decision.startsWith('[X]') ? [CATALOGO.clases[ef.clase].decision] : [];
  const decisiones = [...new Set([e ? e.decision : SIN_NOMBRE, ...deClase, ...marcas])];
  return e ? { nombre: e.nombre, metafora: e.metafora, fuente: e.fuente, decisiones } : { nombre: generico(ef), metafora: null, fuente: null, decisiones };
}

/**
 * Cómo se ve un efecto desde otro mundo (los hilos ven entrar lo escrito por
 * la izquierda; el camino previsualiza una consolidación…); null si ese
 * mundo no lo declara. `decisiones` lleva la marca del nombre en ese mundo;
 * las del efecto siguen en el efecto.
 */
export function verEn(efecto, mundo) {
  const e = entrada(mundo, efecto);
  return e ? { mundo, nombre: e.nombre, metafora: e.metafora, fuente: e.fuente, decisiones: [e.decision] } : null;
}

// ---------- efectos ----------

/**
 * El marco desde el que se lee un registro: el que pide quien mira si `en`
 * está en él o bajo él (el marco es exacto: [1, 0] no es [1]) y deja sitio a
 * la clase; si no, la raíz del foco.
 */
function marcoDeLectura(en, marco) {
  if (marco === undefined) return [];
  const m = comoCamino(marco);
  if (!m.length || m.length + 2 >= ARIDAD) return [];
  const camino = indicesDe(en);
  return camino.length >= m.length && m.every((x, k) => camino[k] === x) ? [...m] : [];
}

/**
 * Efectos de un evento (o de su id): el registro entero, lo que trae dentro,
 * los movimientos de tokens y la fase del motor, en ese orden. No escribe ni
 * guarda nada.
 *
 * `marco` (opcional): el camino del foco desde el que mira quien lee, como
 * lista de índices o dirección. Si el registro está anclado en él o bajo él,
 * su registro y sus celdas se sitúan desde ese marco (mapa §13 [D]: la
 * clase es el dígito n+2) y lo que trae dentro se lee hasta la profundidad 3
 * tras el marco; si no, desde la raíz, como sin marco. Cada efecto dice en
 * `marco` desde dónde se leyó. Las fases del motor no cambian: se leen en la
 * fábrica de su camino.
 */
export function efectosDe(eje, evento, { marco } = {}) {
  const ev = typeof evento === 'string' ? eje?.obtener(evento) : evento;
  if (!ev || typeof ev !== 'object') throw new Error('evento desconocido: ' + String(evento).slice(0, 8));
  const en = ev.en ?? RAIZ;
  if (!esDireccion(en)) throw new Error('anclaje inválido: ' + en);
  let foco = null;
  if (ev.sobre !== null && ev.sobre !== undefined) {
    foco = eje?.obtener(ev.sobre);
    if (!foco) throw new Error('foco desconocido: ' + String(ev.sobre).slice(0, 8));
  }
  const efectos = [];
  const anadir = (ef, marcas = []) => efectos.push({ evento: ev.id, ...ef, ...nombrar(ef, marcas) });
  // Fuera de la raíz, el registro no dice desde qué camino se escribió.
  const sinCamino = en === RAIZ ? [] : [MARCAS_EFECTO.marco];
  const fase = FASES_MOTOR.includes(ev.contexto?.fase) && foco ? ev.contexto.fase : null;
  const lectura = marcoDeLectura(en, marco);
  // Leído desde el camino de quien mira: tampoco es seguro que se escribiera desde él.
  const sinCaminoLeido = lectura.length ? [MARCAS_EFECTO.marcoLectura] : sinCamino;

  if (!fase) {
    anadir(efectoDelRegistro(eje, ev, foco, en, lectura), sinCaminoLeido);
    const vistas = marcasDe(ev.contexto?.vistas);
    const heredadas = marcasDe(ev.contexto?.heredadas);
    for (const c of celdasDe(ev, en, lectura)) {
      const sitio = situar(c.camino, lectura);
      const tipo = tipoDeCelda(ev, c, sitio.clase, vistas, heredadas);
      if (tipo) anadir({ tipo, ...sitio, ruta: c.ruta }, [MARCAS_EFECTO.matriz, ...sinCaminoLeido]);
    }
  }

  for (const m of ev.movimientos ?? []) {
    const familia = CATALOGO.familias[m.token];
    if (!familia) throw new Error('familia de token sin mundo: ' + m.token);
    const movimiento = m.de === null ? 'emitir' : m.a === null ? 'consumir' : 'mover';
    anadir({ tipo: 'token', mundo: familia.mundo, celda: null, clase: familia.clase, movimiento, token: m.token, serie: claveToken(m), cantidad: m.cantidad, de: m.de, a: m.a }, [MARCAS_EFECTO.familia]);
  }

  if (fase) {
    const { cuenta, motivo } = faseReconocida(eje, ev);
    if (cuenta) {
      // El motor ancla sus registros en la fábrica de su camino: `en` es ese camino seguido de 4.
      const camino = indicesDe(en);
      const sitio = situar(camino, camino.slice(0, -1));
      const detalle = fase === 'consolidado' ? { elecciones: eleccionesDe(ev, sitio.marco) } : fase === 'ejecutado' ? { evidencia: [...(ev.contexto.evidencia ?? [])] } : {};
      anadir({ tipo: 'fase', fase, ...sitio, ruta: [], ...detalle }, [MARCAS_EFECTO.claseFase]);
    } else {
      const sitio = situar(indicesDe(en), []);
      anadir({ tipo: 'ruido', fase, motivo, ...sitio, ruta: [] }, sinCamino);
    }
  }
  return efectos;
}

/** Efectos de todo el eje, evento a evento en orden de entrada. */
export function efectosDelEje(eje, opciones) {
  return eje.orden.flatMap((id) => efectosDe(eje, id, opciones));
}

// ---------- renders ----------

function lugarDe(e) {
  return e.celda ?? e.serie;
}

function detalleDe(e) {
  if (e.tipo === 'token') return e.cantidad + ' ' + (e.de ?? '∅') + '→' + (e.a ?? '∅');
  if (e.tipo === 'fase') return e.fase;
  if (e.tipo === 'ruido') return e.fase + ': ' + e.motivo;
  return (e.ruta.length ? '' : 'registro ') + e.etiqueta + ' ' + e.tipo;
}

/**
 * Render sobrio: una línea por efecto, «mundo · efecto · lugar». El lugar es
 * la celda; en un movimiento de tokens, la serie. Con `detalle`, añade qué
 * fue: la celda relativa y su tipo, la cantidad y su sentido, o la fase.
 */
export function sobrio(efectos, { detalle = false } = {}) {
  return efectos.map((e) => [nombreMundo(e.mundo), e.nombre, lugarDe(e), ...(detalle ? [detalleDe(e)] : [])].join(' · ')).join('\n');
}

/** El animado llega con los mundos (big picture §6, tandas 4 a 6): leerá esta misma lista. */
export const RENDERS = Object.freeze({ sobrio });

export function render(efectos, nombre = 'sobrio', opciones) {
  const r = Object.hasOwn(RENDERS, nombre) ? RENDERS[nombre] : undefined;
  if (!r) throw new Error('render no disponible: ' + nombre);
  return r(efectos, opciones);
}
