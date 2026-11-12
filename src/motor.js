// Motor AGRAM, reducido (encargo 3b; VG, 8-11, mapa §15 [D] «Una sola operación: registrar»): «tú vas
// planteando cosas y registras y ejecutas»; cada registro es ya una ejecución (gasta T, mueve lo que mueve, queda
// anclado). Un ciclo es la cadena de registros anclados hasta que se cierra, y cuántos pasos, quién y en qué orden es
// de cada proceso. Se retira el guion fijo consolidar → autorizar → ejecutar («pensaste en predefinir el ciclo cuando
// eso es precisamente una de las libertades»): nadie autoriza lo ajeno, porque cada uno solo mueve lo suyo, y los
// estados dejan de ser del núcleo y pasan a LECTURAS que el dueño fija en su PV2 y BQL evalúa sobre la cadena.
//
// Lo que queda:
//   registrar      una transacción anclada (eje.escribir): la única operación
//   descubrir      lectura: lo que hay en 1–4 del foco, con sus candidatos (elegibles primero)
//   proponer       lectura: elecciones desde las fórmulas del foco
//   consolidar     la fábrica (PV4): compone las elecciones en un registro anclado en el 4 del foco; sin fases
//   cerrado        lectura: la plantilla de cerrado del dueño (X.2.7; por defecto la de la época, epoch.9.0.1)
//   siguiente      lectura: lo que a X le falta de mí y lo que espera de otros
//   recuento       lectura: el recuento del dueño sobre los compromisos con X (X.2.2, X.2.3; epoch.9.0.0)
//   propuestas     lectura: los registros de la fábrica de un foco, cerrados o no
// Las plantillas son de la época (src/epocas.js) y se evalúan con el BQL mínimo (src/bqlm.js): aquí no hay reglas.

import { direccion, esReferencia } from './btml.js';
import { ocupantes, vector, signo, caminosDe } from './encaje.js';
import { evaluar, consultar } from './bql.js';
import { evaluar as evaluarBqlm, leerRegla } from './bqlm.js';
import { ocupantesElegibles } from './elegibles.js';
import { escribirDesde } from './escritura.js';
import { partirClave, raizDeAmbito, esAnunciado, claveToken, movimientosReales } from './tokens.js';
import { ContextoEje } from './contexto-eje.js';
import { EPOCA_0_BTML } from './epocas.js';

/**
 * La fábrica de un registro sin camino: la celda 4.0.0 (docs/MOTOR.md §4). Ahí se proponen registros
 * (consolidar) y se anclan los que los siguen; no es una fase.
 */
export const FABRICA = '4000000000';

/** Dónde se anuncia lo que va a moverse en un proceso: 4.1 («fábrica, cuánto»), un registro por movimiento. */
export const ANUNCIO = '4100000000';

/** Camino de la etiqueta que se muestra de un ocupante: su posición 0 si es un array, si no él mismo. Solo para mostrar: no decide su estado. */
export function caminoVisible(o) {
  const base = o.camino ?? [];
  return Array.isArray(o.contenido) && o.contenido[0] !== undefined ? [...base, 0] : base;
}

/**
 * Operadores (C3-G): Q interroga (descubrir), B construye la propuesta (proponer), C consolida (consolidar: la
 * fábrica registra la elección). El orden importa; no son fases del ciclo.
 */
export const OPERADORES = Object.freeze({ Q: 'descubrir', B: 'proponer', C: 'consolidar' });

/**
 * Proponer (operador B): construye las elecciones de una consolidación a
 * partir de lo que dicen las posiciones del foco. Una posición con fórmula
 * BQL propone: si resuelve a una colección, su primer candidato (el mejor
 * encaje, salvo que la fórmula ORDENE otra cosa) es la elección; si
 * resuelve a un valor, ese valor es un terminal nuevo. Una posición con
 * contenido literal propone ese contenido por referencia al foco. Las
 * posiciones sin desarrollar no proponen. No escribe nada.
 */
export function proponer(eje, foco, { camino = [], posiciones = [1, 2, 3, 4] } = {}) {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  const elecciones = {};
  const origenes = [];
  const pendientes = [];
  for (const i of posiciones) {
    const indices = [...camino, i];
    const crudo = resolverCrudo(ev.payload, indices);
    if (crudo === undefined) continue; // sin desarrollar: no propone
    const r = evaluar(eje, foco, indices);
    if (r.estado !== 'RESUELTO') { pendientes.push({ posicion: i, motivo: r.texto }); continue; }
    const v = r.valor;
    const esFormula = typeof crudo === 'string' && crudo.startsWith('=') && !crudo.startsWith('==');
    if (v.tipo === 'coleccion') {
      const primero = v.items[0];
      if (!primero) { pendientes.push({ posicion: i, motivo: 'sin candidatos' }); continue; }
      const candidato = { evento: primero.evento, dir: direccion(primero.indices ?? []), tipo: primero.origen, origenDir: primero.origenDir, vector: primero.vector, signo: primero.signo };
      elecciones[i] = { candidato };
      origenes.push({ posicion: i, desde: 'formula', texto: r.texto });
    } else if (esFormula) {
      elecciones[i] = v.tipo === 'numero' ? v.valor : r.texto;
      origenes.push({ posicion: i, desde: 'formula', texto: r.texto });
    } else {
      elecciones[i] = { ref: foco, dir: direccion(indices) };
      origenes.push({ posicion: i, desde: 'foco', texto: r.texto });
    }
  }
  return { foco, elecciones, origenes, pendientes };
}

function resolverCrudo(payload, indices) {
  let nodo = payload;
  for (const i of indices) {
    if (!Array.isArray(nodo)) return undefined;
    nodo = nodo[i];
  }
  return nodo;
}

/**
 * Descubrir: qué hay en las posiciones de interacción (1–4) del foco, con
 * sus candidatos (encaje: vector, empate y justificación) y las fórmulas
 * resueltas. No escribe. La época se elige al leer (`epoca`) y ordena los
 * candidatos. `maximo` limita cuántos se entregan por posición sin
 * esconder el resto: cada posición dice su `total` y si va `limitada`.
 * Una referencia a un evento ausente es un candidato PENDIENTE, no un ERROR.
 * Elegibilidad antes que límites (R8, src/elegibles.js): los candidatos son
 * los ocupantes elegibles según el criterio del dueño del foco, y `maximo` y
 * `total` cuentan solo esos; los escritos que no lo son van en `noElegibles`,
 * un recuento informativo que no puntúa.
 */
export function descubrir(eje, foco, { camino = [], posiciones = [1, 2, 3, 4], epoca, maximo = Infinity } = {}) {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  return posiciones.map((i) => {
    const indices = [...camino, i];
    const { lista: todos, noElegibles } = ocupantesElegibles(eje, foco, indices, { epoca });
    const candidatos = todos.slice(0, maximo).map((o) => {
      // Lo que el encaje ya sabe pendiente (una referencia ausente) no se evalúa: no hay nada que leer.
      // El estado y el texto son los del camino exacto del ocupante (MAPA §12:
      // «todos son ocupantes con su camino exacto»); la etiqueta de su posición
      // 0, si es un array, va aparte y no decide el estado (auditoría de ajuste 2).
      if (o.estado) return { ...o, estado: o.estado, texto: o.estado + ': ' + o.motivo };
      // Un elemento de lista es un ocupante aparte: muestra su propio valor (LOCAL por índice entra en la lista), no el de la lista entera.
      if (o.enLista) {
        const camino = o.camino ?? [];
        const e = consultar(eje, o.evento, camino, 'LOCAL(' + [camino[camino.length - 1], o.indice].join(', ') + ')');
        return { ...o, estado: e.estado, texto: e.texto, etiqueta: e.texto };
      }
      const r = evaluar(eje, o.evento, o.camino ?? []);
      const visible = caminoVisible(o);
      const etiqueta = visible.length > (o.camino ?? []).length ? evaluar(eje, o.evento, visible).texto : r.texto;
      return { ...o, estado: r.estado, texto: r.texto, etiqueta };
    });
    return { posicion: i, dir: direccion(indices), candidatos, total: todos.length, limitada: candidatos.length < todos.length, noElegibles };
  });
}

/**
 * Consolidar: la fábrica (PV4) compone UNA acción de registro y la registra: es registrar, con las elecciones como
 * payload (mapa §15 [D]: «la fábrica sigue siendo donde se proponen registros, sin fases fijas»). Las elecciones
 * (por posición: un candidato elegido como referencia, o un terminal nuevo;
 * o varias en un array, que se combinan en la misma posición) se funden en
 * un array consolidado con referencias a sus fuentes y se registran como
 * evento anclado a la fábrica del foco. Lo que mueve cada parte lo registra ella, anclado donde quiera.
 * `encaje` dice de dónde vino cada elección con fuente; los terminales
 * nuevos, que no vienen de ninguna, van aparte en `nuevos` ({ posicion,
 * destino }). Ninguno guarda clase: la de una elección se lee con
 * claseDe(destino, camino). Con la matriz relativa al camino, la elección i
 * es la celda i.0.0 bajo `camino`, de clase 0 con cualquier camino. [X]
 * decidir VG: si la clase de una elección es la de su destino o la 4 de la
 * fábrica (direccion([...camino, 4])) donde se ancla el registro; y si el
 * registro guarda su camino (hoy no: sin él no se sabe desde dónde leer).
 */
export async function consolidar(eje, { autor, foco, elecciones, titulo = 'Consolidación', t, camino = [] }, privada) {
  if (!elecciones || !Object.keys(elecciones).length) throw new Error('nada que consolidar');
  const payload = [titulo];
  const fuentes = [];
  const encaje = []; // de dónde vino cada elección, cuánto se desplazó y en qué sentido
  const nuevos = []; // dónde va cada terminal nuevo: no viene de ninguna fuente, así que no tiene encaje
  const indicesElegidos = Object.keys(elecciones).map(Number).sort((a, b) => a - b);
  const ultimo = indicesElegidos[indicesElegidos.length - 1];
  if (indicesElegidos.some((i) => !Number.isInteger(i) || i < 1 || i > 9)) throw new Error('las elecciones van en posiciones 1–9');
  /** Una elección hecha contenido: una referencia a su fuente, un terminal nuevo o, si es un array, la combinación de varias. */
  const contenido = (e, i) => {
    const destino = direccion([...camino, i]);
    if (Array.isArray(e)) return e.map((x) => contenido(x, i)); // combinar: varias elecciones en la misma posición
    if (esReferencia(e)) {
      if (!eje.obtener(e.ref)) throw new Error('fuente desconocida en ' + i);
      fuentes.push(e.ref);
      encaje.push({ posicion: i, evento: e.ref, origen: e.dir ?? '0000000000', destino, vector: vector(e.dir ?? '0000000000', destino) });
      return e;
    }
    if (e && typeof e === 'object' && e.candidato) {
      const c = e.candidato;
      fuentes.push(c.evento);
      const origen = c.origenDir ?? c.dir ?? '0000000000';
      const v = c.vector ?? vector(origen, destino);
      encaje.push({ posicion: i, evento: c.evento, tipo: c.tipo ?? c.origen, origen, destino, vector: v, signo: c.signo ?? signo(v) });
      return { ref: c.evento, dir: c.dir ?? '0000000000' };
    }
    // Terminal nuevo: no viene de ninguna fuente. Una entrada por posición, también si se combinan varios.
    if (!nuevos.some((n) => n.posicion === i)) nuevos.push({ posicion: i, destino });
    return e;
  };
  for (let i = 1; i <= ultimo; i++) {
    const e = elecciones[i];
    if (e === undefined) {
      // Hueco: se hereda del foco por referencia si tiene ocupantes en esa
      // dirección; si no, se rechaza. [X] decidir VG: si consolidar usa la
      // matriz como desdeMapped (heredar solo lo que el foco tiene en el
      // camino exacto y anclar lo lejano en su posición en vez de rechazarlo).
      const hay = ocupantes(eje, foco, [...camino, i]).length > 0;
      if (!hay) throw new Error('hueco en ' + i + ': elige algo o quita las posiciones siguientes');
      payload.push({ ref: foco, dir: direccion([...camino, i]) });
      continue;
    }
    payload.push(contenido(e, i));
  }
  return escribirDesde(eje, {
    modo: 'mapped',
    autor,
    sobre: foco,
    en: direccion([...camino, 4]),
    payload,
    t,
    contexto: { motor: 'fabrica', fuentes: [...new Set(fuentes)], encaje, nuevos },
  }, privada);
}

// ---------- registrar y las lecturas del ciclo ----------

/**
 * Registrar: la única operación del ciclo (mapa §15 [D]). Es eje.escribir: una transacción anclada (`sobre`, `en`)
 * con los movimientos de quien escribe y su payload. Cada parte escribe su propio movimiento.
 */
export async function registrar(eje, datos, privada) {
  return eje.escribir(datos, privada);
}

/** El contexto del BQL mínimo para leer el eje de ahora (sin candidata). */
const contexto = (eje) => new ContextoEje(eje, { epoch: EPOCA_0_BTML });

/** Lo que dice la época en epoch.9.0.k (las plantillas): { nombre → fórmula } y el nombre por defecto. */
function plantillas(k) {
  const decupla = EPOCA_0_BTML.registro[9][0][k];
  const lista = Array.isArray(decupla?.[1]) ? decupla[1] : [];
  const porNombre = new Map(lista.map((p) => [p[0][0], p[1][p[1].length - 1]]));
  const defecto = Array.isArray(decupla?.[2]) && typeof decupla[2][0] === 'string' ? decupla[2][0] : lista[0]?.[0]?.[0];
  return { porNombre, defecto, decupla };
}

/** Evalúa en el eje de ahora una fórmula de la época con it = `sujeto` (un registro): { estado, valor, texto, motivo }. */
function leer(eje, formula, sujeto) {
  return evaluarBqlm(formula, contexto(eje), { sujeto });
}

/** El último valor que da una expresión del BQL mínimo sobre X, o undefined. */
function ultimoDe(eje, expr, X) {
  const r = leer(eje, expr, X);
  return r.estado === 'RESUELTO' && r.valor.length ? r.valor[r.valor.length - 1] : undefined;
}

/**
 * Lo que el dueño de X dice en su PV2 (el 2 de X) sobre algo: las hojas de su 2.`d` (si su 2 es una décupla) y las
 * de su 2 (si es una lista), por llegada: lo que la época nombra en sus plantillas (encargo 3b: «el dueño escribe en
 * su PV2 el criterio de qué cuenta como cerrado», mapa §15 [D]). Solo lo del payload: es el criterio del dueño.
 */
function delCriterio(eje, X, d) {
  const textos = (expr) => {
    const r = leer(eje, expr, X);
    return r.estado === 'RESUELTO' ? r.valor.filter((v) => typeof v === 'string' || typeof v === 'number') : [];
  };
  return [...textos('it.2 where count it2.5 = 0 and count it2.0 = 0'), ...textos('it.2.' + d + ' where count it2.5 = 0')];
}

/**
 * ¿Está cerrado X? (mapa §15 [D] N5: «"cerrado" se establece por proceso; hay procesos que se cierran y otros no»):
 * la plantilla de cerrado que su dueño nombra en su criterio (su 2.7, o su 2 si es una lista; la última que nombre; sin
 * nombrar ninguna, la de la época: «all announced movements happened»), evaluada con BQL sobre la cadena. Devuelve { cerrado, plantilla, estado,
 * motivo }: `cerrado` es true o false si la plantilla se resuelve; si no, null y el motivo.
 */
/**
 * El registro que cerró X, para la interfaz (hilos, camino, fábrica, jardín): si X está cerrado, el último registro
 * escrito sobre X que mueve algo de una parte a otra (lo anunciado: no un comentario, que solo quema T); null si X
 * está abierto o se cerró al escribirse (no anunciaba nada).
 */
export function cierre(eje, X) {
  if (cerrado(eje, X).cerrado !== true) return null;
  // Lo escrito sobre X y, desde que el anuncio lo cumple lo que se ancla sobre él (VG 12-11, decisión 8), lo escrito
  // sobre sus anuncios (su 4.1), por llegada.
  const anuncios = eje.sobre(X, ANUNCIO).map((a) => a.id);
  const orden = new Map(eje.orden.map((id, i) => [id, i]));
  const escritos = [...eje.sobre(X), ...anuncios.flatMap((a) => eje.sobre(a))].sort((a, b) => orden.get(a.id) - orden.get(b.id));
  const mueven = escritos.filter((r) => (r.movimientos ?? []).some((m) => m && m.token !== 'T' && m.de !== null && m.a !== null && m.estado === undefined));
  return mueven[mueven.length - 1] ?? null;
}

export function cerrado(eje, X) {
  const id = typeof X === 'string' ? X : X?.id;
  if (!eje.obtener(id)) throw new Error('registro desconocido: ' + String(id).slice(0, 8));
  const { porNombre, defecto } = plantillas(1);
  const nombre = delCriterio(eje, id, 7).filter((x) => porNombre.has(x)).pop();
  const plantilla = nombre ?? defecto;
  const r = leer(eje, porNombre.get(plantilla), id);
  if (r.estado !== 'RESUELTO') return { cerrado: null, plantilla, estado: r.estado, motivo: r.motivo };
  const v = r.valor[0];
  return { cerrado: v === true, plantilla, estado: 'RESUELTO', motivo: null };
}

/**
 * Lo que anuncia un registro anclado en ANUNCIO de X por su dueño, como el movimiento que lo cumple: { token, …,
 * cantidad, de, a }, o null. El anuncio es un movimiento anunciado del libro (VG 12-11, decisión 8: estado «anunciado»,
 * sin tocar saldos); mientras los ejemplos lo escriban como antes, también un payload que imita un movimiento,
 * [[serie], [cuánto], [para qué], [[de], [a]]]. Lo cumple el registro que se ancla sobre él moviéndolo (#48).
 */
export function movimientoAnunciado(registro) {
  return movimientosAnunciados(registro)[0] ?? null;
}

/**
 * Todo lo que anuncia un registro del 4.1, como los movimientos que lo cumplen (sin su estado ni su fecha): los
 * movimientos anunciados del registro (uno o varios: un anuncio puede ser un conjunto, como las noches de una reserva,
 * y se cumple cuando lo que se ancla sobre él los mueve todos) o, en la forma de antes, el que imita su payload.
 */
export function movimientosAnunciados(registro) {
  const anunciados = (Array.isArray(registro?.movimientos) ? registro.movimientos : []).filter(esAnunciado);
  if (anunciados.length) return anunciados.map(({ estado: _estado, refiere: _refiere, ...m }) => m);
  const legado = movimientoDelPayload(registro);
  return legado ? [legado] : [];
}

/** El movimiento que imita el payload de un anuncio de antes, [[serie], [cuánto], [para qué], [[de], [a]]], o null. */
function movimientoDelPayload(registro) {
  const p = registro?.payload;
  const hoja = (x) => (Array.isArray(x) ? x[x.length - 1] : x);
  const clave = hoja(p?.[0]);
  const cantidad = hoja(p?.[1]);
  const de = hoja(p?.[3]?.[0]);
  const a = hoja(p?.[3]?.[1]);
  const serie = typeof clave === 'string' ? partirClave(clave) : null;
  if (!serie || typeof cantidad !== 'number' || typeof de !== 'string' || typeof a !== 'string') return null;
  const { token, emisor, denominacion, registro: r, ambito, origen, escala } = serie;
  return { token, ...(emisor ? { emisor } : {}), ...(denominacion ? { denominacion } : {}), ...(r ? { registro: r } : {}), ...(ambito ? { ambito } : {}), ...(origen ? { origen } : {}), ...(escala ? { escala } : {}), cantidad, de, a };
}

/**
 * Lo que a X le falta (mapa §15 [D]; encargo 3b): de `yo` y de los demás. Lee con la plantilla «what is missing» de
 * la época (epoch.9.0.3) los movimientos anunciados en X que aún no han pasado y, si el dueño de X declara recuento en
 * su criterio, si el recuento no pasa. Devuelve { cerrado, faltaDeMi: [{ que, plantilla, transaccion }], espera:
 * [{ que, de }], tutorial? }: lo mío, con la plantilla de transacción que lo cumpliría y que yo puedo lanzar (la
 * transacción misma, lista para eje.escribir); lo de otros, marcado como espera. Si X es el alta de `yo` aceptando
 * una invitación (mapa §16 [D]: «el tutorial de cero al mínimo = aceptar una invitación»), además lo que la
 * invitación anuncia de mí y `tutorial`: las posiciones de la identidad en el orden del tutorial de la época
 * (epoch.9.1), cada una con lo que dice la plantilla de identidad (epoch.3.0).
 */
export function siguiente(eje, X, yo) {
  const id = typeof X === 'string' ? X : X?.id;
  const reg = eje.obtener(id);
  if (!reg) throw new Error('registro desconocido: ' + String(id).slice(0, 8));
  const { porNombre } = plantillas(3);
  const faltaDeMi = [];
  const espera = [];
  const r = leer(eje, porNombre.get('what is missing'), id);
  const pendientes = r.estado === 'RESUELTO' ? r.valor.map((o) => (o && typeof o === 'object' && o.k === 'reg' ? eje.obtener(o.id) : null)).filter(Boolean) : [];
  for (const anuncio of pendientes) {
    const todos = movimientosAnunciados(anuncio);
    const texto = (m) => 'mover ' + m.cantidad + ' ' + claveToken(m) + ' de ' + m.de + ' a ' + m.a;
    // Lo mío, en un registro anclado sobre el anuncio (VG 12-11, decisión 8; #48): así cumple ese y solo ese; lo que
    // ya movió un registro anclado sobre él no vuelve a faltar.
    const hecho = eje.sobre(anuncio.id).flatMap((r) => movimientosReales(r));
    const falta = todos.filter((m) => !hecho.some((h) => claveToken(h) === claveToken(m) && h.de === m.de && h.a === m.a && h.cantidad >= m.cantidad));
    const mios = falta.filter((m) => m.de === yo);
    if (mios.length) {
      const que = mios.map(texto).join('; ');
      faltaDeMi.push({ que, anuncio: anuncio.id, plantilla: 'move what was announced', transaccion: { autor: yo, sobre: anuncio.id, en: FABRICA, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: yo, a: null }, ...mios], payload: [que] } });
    }
    for (const m of falta.filter((x) => x.de !== yo)) espera.push({ que: texto(m), anuncio: anuncio.id, de: m.de });
  }
  // El recuento del dueño, si lo declara en su criterio.
  if (delCriterio(eje, id, 2).some((x) => plantillas(0).porNombre.has(x))) {
    const c = recuento(eje, id);
    if (c.pasa === false) {
      const que = 'el recuento de ' + reg.autor + ' (' + c.plantilla + ') da ' + c.valor + ' y pide ' + c.umbral;
      // Comprometer P con X (mapa §15 [D] (5)): bloquear con la salida = X el P que tengo disponible en su dominio y
      // cuyo origen cuenta (encargo 3b-bis: cuenta el P por quien lo obtuvo; el delegado compromete el de su origen).
      const raiz = [...eje.hilo(id)].reverse().find((e) => e.autor === reg.autor)?.id;
      const enDominio = (r) => Boolean(raiz) && Boolean(eje.obtener(r)) && eje.hilo(r).some((e) => e.id === raiz);
      const presiones = new Map();
      const cuenta = (origen) => {
        if (!presiones.has(origen)) presiones.set(origen, presionDe(eje, id, origen) > 0);
        return presiones.get(origen);
      };
      const mio = Object.entries(eje.libro.vista(yo))
        .filter(([k]) => k.startsWith('P:'))
        .map(([k, v]) => ({ ...partirClave(k), disponible: v.disponible }))
        .filter((p) => p.disponible > 0 && enDominio(raizDeAmbito(p.ambito)) && cuenta(p.origen))
        .sort((a, b) => b.disponible - a.disponible)[0];
      if (mio) {
        faltaDeMi.push({ que, plantilla: 'commit P', transaccion: { autor: yo, sobre: id, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: yo, a: null }, { token: 'P', ambito: mio.ambito, ...(mio.origen === yo ? {} : { origen: mio.origen }), cantidad: mio.disponible, de: yo, a: yo, estado: 'bloqueo', salida: id }], payload: ['comprometo P con ' + id.slice(0, 8)] } });
      } else espera.push({ que, de: reg.autor });
    }
  }
  const fuera = { cerrado: cerrado(eje, id).cerrado, faltaDeMi, espera };
  // El alta de yo, aceptando una invitación: lo que la invitación anuncia de mí y el tutorial.
  const inv = reg.sobre ? eje.obtener(reg.sobre) : null;
  const esInvitacion = Array.isArray(inv?.payload) && [inv.payload[0]].flat().includes('invitation');
  if (yo && reg.autor === yo && eje.alta(yo)?.id === id && esInvitacion) {
    const deLaInvitacion = siguiente(eje, inv.id, yo);
    fuera.faltaDeMi.push(...deLaInvitacion.faltaDeMi);
    fuera.espera.push(...deLaInvitacion.espera);
    const plantilla = EPOCA_0_BTML.registro[3][0];
    fuera.tutorial = EPOCA_0_BTML.registro[9][1].map((p) => (typeof p === 'number' ? { posicion: p, que: [plantilla[p]].flat()[0] } : { posicion: null, que: p }));
  }
  return fuera;
}

/** La presión de `quien` (el origen de un P) en la lista del dueño de X (X.2.3): la misma lectura que «weight», sin compromiso. */
function presionDe(eje, X, quien) {
  // La misma forma que la lectura «weight» y las plantillas de recuento (2.3: «nombre» cuenta 9, «nombre 5» cuenta 5,
  // «cualquiera» abre a todos; sin lista, solo el dueño).
  const L = (n) => '(it.2.3 where count it' + n + '.5 = 0)';
  const max = '(first epoch.9.0.0.4)'; // la presión máxima, la de la época
  const conPresion = (n) => 'count it' + n + '.2 > 0 and count it' + n + '.6 = 0';
  const q = JSON.stringify(quien);
  const expr = max + ' * count (' + L(2) + ' where not (' + conPresion(2) + ') and ' + q + ' in it2) + sum ((' + L(2) + ' where ' + conPresion(2) + ' and ' + q + ' in it2.2) each 1)'
    + ' + count (epoch where count (' + L(3) + ' where ' + q + ' in it3 or ' + q + ' in it3.2) = 0) * (' + max + ' * count (' + L(2) + ' where not (' + conPresion(2) + ') and "cualquiera" in it2) + sum ((' + L(2) + ' where ' + conPresion(2) + ' and "cualquiera" in it2.2) each 1))'
    + ' + ' + max + ' * count (epoch where count ' + L(3) + ' = 0 and ' + q + ' = first it.3)';
  const v = ultimoDe(eje, expr, X);
  return typeof v === 'number' ? v : 0;
}

/**
 * El recuento de X según el PV2 de su dueño (mapa §15 [D] (4) y N4): la plantilla que nombra en su criterio (su 2.2,
 * o su 2 si es una lista: «weighted sum», «weighted mean» o «threshold»; por defecto la primera de la época), con las
 * personas y presiones de X.2.3 (por defecto solo el dueño) y el umbral que dice ahí mismo («above 0.5»; por defecto
 * el de la época, epoch.9.0.0.2). Lo comprometido es el P bloqueado con la salida = X (X.2.4), y cada compromiso pesa
 * con la lectura «weight»: por su origen (encargo 3b-bis: quien obtuvo el P, lo comprometa quien lo comprometa); con
 * nombres, por reparto (el 100 % de su origen por dominio) × presión; con «cualquiera», por cantidad. Pasa si el valor
 * supera el umbral. Devuelve { plantilla, valor, umbral, pasa, estado, motivo }.
 */
export function recuento(eje, X) {
  const id = typeof X === 'string' ? X : X?.id;
  if (!eje.obtener(id)) throw new Error('registro desconocido: ' + String(id).slice(0, 8));
  const { porNombre, decupla } = plantillas(0);
  const dice = delCriterio(eje, id, 2);
  // Lo que no es una plantilla de la época y lo dice (su 5, encargo 3b-bis): «one per person» exige identidad de fuera.
  const noEncaja = new Map((Array.isArray(decupla?.[5]) ? decupla[5] : []).map((x) => [x[0][0], x[1][x[1].length - 1]]));
  const pedida = dice.filter((x) => porNombre.has(x) || noEncaja.has(x)).pop();
  if (noEncaja.has(pedida)) return { plantilla: pedida, valor: null, umbral: decupla[2][0], pasa: null, estado: 'ERROR', motivo: noEncaja.get(pedida) };
  const plantilla = pedida ?? decupla[1][0][0][0];
  // El umbral: una magnitud «above 0.5» (D-VALOR) en el mismo criterio; sin ella, el de la época (epoch.9.0.0.2).
  const sobre = dice.map((x) => /^above\s+(\d+(?:\.\d+)?)$/.exec(String(x))).filter(Boolean).pop();
  const umbral = sobre ? Number(sobre[1]) : decupla[2][0];
  const r = leer(eje, porNombre.get(plantilla), id);
  if (r.estado !== 'RESUELTO') return { plantilla, valor: null, umbral, pasa: null, estado: r.estado, motivo: r.motivo };
  const valor = Math.round(r.valor[0] * 1e9) / 1e9;
  return { plantilla, valor, umbral, pasa: valor > umbral, estado: 'RESUELTO', motivo: null };
}

/**
 * Las miradas sobre las que decide X (encargo 3c-2a, P por mirada): las «view d» (una magnitud, D-VALOR) que su dueño
 * dice en su criterio, en su 2.2 o en su 2 si es una lista, con la misma lectura que la regla «weight»; [] si no dice
 * ninguna (la decisión es sobre el registro entero). Para la interfaz (el jardín: el umbral de cada mirada).
 */
export function miradasDe(eje, X) {
  const id = typeof X === 'string' ? X : X?.id;
  if (!eje.obtener(id)) return [];
  const de = (donde) => {
    const r = leer(eje, '((' + donde + ' where count it2.5 = 0 and count it2.0 = 0) where it2.2 = "view") each 1', id);
    return r.estado === 'RESUELTO' ? r.valor.filter((v) => typeof v === 'number') : [];
  };
  return [...new Set([...de('it.2.2'), ...de('it.2')])];
}

/**
 * El peso de `A` sobre X, como su 100 % por dominio (mapa §15 [D] (3)) y por origen (encargo 3b-bis: «el P guarda su
 * origen»): el P que obtuvo A sobre X entre el P que obtuvo A en el dominio de X, esté en la mano que esté, con la
 * lectura «share» de la época (A.2.6.8). 0 si A no obtuvo P sobre X. Delegar o pasar P a otra identidad no lo cambia.
 */
export function peso(eje, A, X, mirada) {
  const ctx = contexto(eje);
  // P por mirada (VG, tras 3b-bis): sin mirada, todo el P que obtuvo A posicionado en X (el registro entero y cada una
  // de sus miradas); con la mirada d, lo que pesa en una decisión sobre esa mirada: el de X entero y el de X.d.
  const deMirada = mirada === undefined ? '' : ' and (count it.5 = 0 or first it.5 = ' + Number(mirada) + ')';
  const r = evaluarBqlm('(("' + A.replace(/"/g, '\\"') + '").2.6 where it.0 = "' + X + '"' + deMirada + ') each 8', ctx);
  return r.estado === 'RESUELTO' && r.valor.length ? r.valor.reduce((s, x) => s + x, 0) : 0;
}

/** Las propuestas de la fábrica de un foco (los registros que consolidar ancló en su 4), con su lectura de cerrado. */
export function propuestas(eje, foco, camino = []) {
  return eje.sobre(foco, direccion([...camino, 4]))
    .filter((e) => e.contexto?.motor === 'fabrica')
    .map((e) => ({ id: e.id, autor: e.autor, t: e.t, titulo: Array.isArray(e.payload) ? e.payload[0] : e.payload, cerrado: cerrado(eje, e.id).cerrado, fuentes: e.contexto.fuentes ?? [] }));
}

// ---------- capacidad: un contador informativo; el límite es una serie de tokens ----------

/**
 * Capacidad de una posición (VG, 7-11). Una posición admite muchos
 * ocupantes (colisiones: se escriben y se ven todos), y puede declarar
 * cuántos de ellos pueden ser VÁLIDOS a la vez en un mismo tramo. Lo que lo
 * hace cumplir no es este contador sino una SERIE LIMITADA de tokens E que
 * emite quien respalda la posición (en Booking, la casa: un token por plaza
 * y noche, tantos como capacidad): la casa entrega esos tokens en su propio
 * registro y, sin saldo, el eje no lo acepta. El contador (ocupacion) queda INFORMATIVO: para la
 * interfaz y para saber cuántos tokens emitir; no bloquea nada.
 * [X] decidir VG: cómo declara una posición su capacidad. V0: la décupla de
 * la posición lleva en su criterio (subposición 2: «cuántos caben a la vez»)
 * un entero positivo, como una plaza [nombre, precio, capacidad] bajo la
 * época 0 (0 representación, 1 recursos, 2 criterios). Alternativa: en sus
 * recursos (1), junto al precio. Sin ese entero, la posición no declara nada.
 * La misma forma, en el payload raíz de un REGISTRO, es la capacidad que hace
 * cumplir el eje como tope de E vivo (src/eje.js, reglasDelTope): por eso
 * capacidadDe vive en src/tokens.js y aquí se reexporta.
 */
export { CRITERIO_CAPACIDAD, capacidadDe } from './tokens.js';
import { capacidadDe } from './tokens.js';

const SIETE = direccion([7]);

/**
 * Tramo de un registro: su futuro (posición 7) como [inicio, fin), dos
 * fechas o instantes ISO escritos como décupla [[inicio], [fin]] (cada posición entre corchetes,
 * como en el resto: por hojas, [inicio, fin] sería una lista de dos ocupantes
 * y no se lee como tramo); el fin no cuenta (la noche de la salida no se
 * ocupa). El 7 es una colisión: vale lo propio (payload[7], o lo que alcance
 * si es una referencia) y lo que el AUTOR del registro ancle en su 7 («lo
 * lejano = anclaje»: se llega al 7 sin rellenar 5 y 6); manda el primero en
 * el orden de encaje (exactos, luego la llegada). Un tramo es acotado: sin
 * 7 o ilegible, error.
 * [X] decidir VG: la forma del tramo en el 7 (dos fechas, fin excluido) y
 * que solo el autor del registro ancle su tramo.
 */
export function tramoDe(eje, id) {
  const ev = eje.obtener(id);
  if (!ev) throw new Error('registro desconocido: ' + id);
  const [primero] = ocupantes(eje, id, [7])
    .filter((o) => (o.origen === 'escrito' ? o.autor === ev.autor : !esReferencia(o.contenido)));
  if (!primero) throw new Error('sin tramo en el 7 de ' + id.slice(0, 8) + ': hace falta [[inicio], [fin]] en ISO, propio o anclado en ' + SIETE + ' por su autor');
  const c = primero.contenido;
  const id8 = id.slice(0, 8);
  // Por hojas (#69): un array solo de hojas es una LISTA de ocupantes, no un par; un tramo es una décupla.
  if (primero.enLista || (Array.isArray(c) && !c.some(Array.isArray))) throw new Error('tramo ilegible en el 7 de ' + id8 + ': ' + (primero.enLista ? 'el 7 es una lista de ocupantes (cada elemento es uno, no un tramo)' : 'una lista de hojas es una lista de ocupantes, no un tramo') + '; un tramo se escribe como décupla [[inicio], [fin]] en ISO');
  // Forma canónica (VG, 8-11): [[inicio], [fin]]; la hoja suelta ([[inicio], fin]) sigue valiendo (lista de uno).
  const unico = (x) => (Array.isArray(x) && x.length === 1 ? x[0] : x);
  const [a, b] = Array.isArray(c) && Array.isArray(c[0]) ? [c[0][0], unico(c[1])] : [];
  const inicio = typeof a === 'string' ? Date.parse(a) : NaN;
  const fin = typeof b === 'string' ? Date.parse(b) : NaN;
  if (!(inicio < fin)) throw new Error('tramo ilegible en el 7 de ' + id8 + ': hace falta la décupla [[inicio], [fin]] en ISO, con inicio antes que fin');
  return { inicio, fin, extremos: [a, b], texto: a + ' – ' + b, desde: primero.evento };
}

/** Un ocupante ya válido sin tramo legible no se descarta: para contar, ocupa todo el tiempo. */
function tramoOTodo(eje, id) {
  try { return tramoDe(eje, id); } catch { return { inicio: -Infinity, fin: Infinity, texto: 'todo el tiempo' }; }
}

/** Si un payload lleva, a cualquier profundidad, una referencia a la dirección `dir` de `id`. */
function referencia(payload, id, dir) {
  if (esReferencia(payload)) return payload.ref === id && (payload.dir ?? '0000000000') === dir;
  return Array.isArray(payload) && payload.some((h) => referencia(h, id, dir));
}

/**
 * Registros que ocupan una posición: los anclados en ella (`sobre` + `en`) y
 * los que la REFERENCIAN desde donde estén anclados, sin repetir, por orden
 * de llegada. Así ningún ocupante escapa al contador por elegir otro `en`.
 */
export function registrosEn(eje, sobre, dir) {
  const anclados = new Set(eje.sobre(sobre, dir).map((e) => e.id));
  return eje.orden
    .map((id) => eje.obtener(id))
    .filter((e) => anclados.has(e.id) || (e.id !== sobre && referencia(e.payload, sobre, dir)));
}

/** Cuántos tramos coinciden a la vez, como mucho, dentro de otro (barrido por los inicios). */
function maximoALaVez(tramos, dentro) {
  const puntos = [dentro.inicio, ...tramos.map((x) => x.inicio).filter((p) => p > dentro.inicio && p < dentro.fin)];
  let maximo = 0;
  for (const p of puntos) maximo = Math.max(maximo, tramos.filter((x) => x.inicio <= p && p < x.fin).length);
  return maximo;
}

/**
 * Ocupación de las posiciones con capacidad donde está anclado un registro.
 * Solo INFORMA: la fábrica no la consulta. La dirección `en` nombra la
 * colisión entera (§12: «1» y «1.0» son el mismo lugar), así que mira cada
 * camino que la dirección nombra y que declara capacidad. Si hay alguno, el
 * registro ha de tener un tramo acotado (tramoDe; si no, error). Por cada
 * uno: la capacidad, el tramo, los OTROS registros de esa posición ya
 * válidos (cerrados según la plantilla de su dueño: cerrado; anclados en ella o que la
 * referencian desde otro sitio) que se solapan con el tramo, cuántos
 * coinciden a la vez como mucho (con capacidad 2 caben dos estancias
 * encadenadas y una tercera que las cruza) y si cabría uno más. Consulta sin
 * efectos.
 */
export function ocupacion(eje, id) {
  const ev = eje.obtener(id);
  if (!ev) throw new Error('registro desconocido: ' + id);
  if (ev.sobre === null) return [];
  const padre = eje.obtener(ev.sobre);
  const conCapacidad = caminosDe(padre.payload, ev.en).filter((c) => capacidadDe(c.contenido) !== undefined);
  if (!conCapacidad.length) return [];
  const tramo = tramoDe(eje, id);
  const validos = registrosEn(eje, ev.sobre, ev.en)
    .filter((o) => o.id !== id && cerrado(eje, o.id).cerrado === true)
    .map((o) => ({ id: o.id, autor: o.autor, anclado: o.sobre === ev.sobre && o.en === ev.en, tramo: tramoOTodo(eje, o.id) }))
    .filter((o) => o.tramo.inicio < tramo.fin && tramo.inicio < o.tramo.fin);
  const aLaVez = maximoALaVez(validos.map((o) => o.tramo), tramo);
  return conCapacidad.map((c) => {
    const capacidad = capacidadDe(c.contenido);
    return { sobre: ev.sobre, dir: ev.en, camino: c.indices, capacidad, tramo, validos, aLaVez, cabe: aLaVez < capacidad };
  });
}
