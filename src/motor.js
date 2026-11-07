// Motor AGRAM, ciclo mínimo: descubrir → elegir/crear → consolidar en la
// fábrica (PV4) → autorizar → ejecutar con evidencia. Consolidar no es
// ejecutar. Todo son eventos: la consolidación, la autorización y la
// ejecución son registros anclados a la fábrica del foco, encadenados por
// referencia, de modo que la evidencia es el propio hilo.
//
// Estados de una consolidación: PENDIENTE DE AUTORIZACIÓN → AUTORIZADO → EJECUTADO.

import { direccion, esReferencia } from './btml.js';
import { ocupantes, vector, signo, caminosDe } from './encaje.js';
import { evaluar } from './bql.js';
import { escribirDesde, costeT } from './escritura.js';
import { contarPosiciones } from './modos.js';
import { AMBITO_GENESIS, SEGUNDOS, claveToken } from './tokens.js';
import { msUTC } from './instante.js';
import { FABRICA, esConsolidacion, lectorDelEje, recursoDe as recursoDel, clavesDeP, pesoDe, estadoPorPeso } from './autorizacion.js';

// Ningún registro del motor guarda clase: la de una dirección se lee con
// claseDe(dir, camino), relativa al camino desde el que se escribe (la
// matriz es relativa al camino: el dígito n + 2 bajo un camino de
// profundidad n). Autorizar y ejecutar se escriben en FABRICA, sin camino:
// la celda 4.0.0, de clase 0, aunque ejecutar sea una acción ([X] decidir VG
// en qué dirección se escriben para que su clase salga de ella, o si no la
// llevan).
export { FABRICA, esConsolidacion, leerUmbral, UMBRAL_POR_DEFECTO } from './autorizacion.js';

/** Camino de la etiqueta que se muestra de un ocupante: su posición 0 si es un array, si no él mismo. Solo para mostrar: no decide su estado. */
export function caminoVisible(o) {
  const base = o.camino ?? [];
  return Array.isArray(o.contenido) && o.contenido[0] !== undefined ? [...base, 0] : base;
}
export const FASES = Object.freeze(['consolidado', 'autorizado', 'ejecutado']);

/**
 * Operadores del ciclo (C3-G): Q interroga (descubrir), B construye la
 * propuesta (proponer), C consolida (consolidar). El orden importa.
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
 */
export function descubrir(eje, foco, { camino = [], posiciones = [1, 2, 3, 4], epoca, maximo = Infinity } = {}) {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  return posiciones.map((i) => {
    const indices = [...camino, i];
    const todos = ocupantes(eje, foco, indices, { epoca });
    const candidatos = todos.slice(0, maximo).map((o) => {
      // Lo que el encaje ya sabe pendiente (una referencia ausente) no se evalúa: no hay nada que leer.
      // El estado y el texto son los del camino exacto del ocupante (MAPA §12:
      // «todos son ocupantes con su camino exacto»); la etiqueta de su posición
      // 0, si es un array, va aparte y no decide el estado (auditoría de ajuste 2).
      if (o.estado) return { ...o, estado: o.estado, texto: o.estado + ': ' + o.motivo };
      const r = evaluar(eje, o.evento, o.camino ?? []);
      const visible = caminoVisible(o);
      const etiqueta = visible.length > (o.camino ?? []).length ? evaluar(eje, o.evento, visible).texto : r.texto;
      return { ...o, estado: r.estado, texto: r.texto, etiqueta };
    });
    return { posicion: i, dir: direccion(indices), candidatos, total: todos.length, limitada: candidatos.length < todos.length };
  });
}

/**
 * Consolidar: la fábrica finaliza UNA acción de registro. Las elecciones
 * (por posición: un candidato elegido como referencia, o un terminal nuevo;
 * o varias en un array, que se combinan en la misma posición) se funden en
 * un array consolidado con referencias a sus fuentes y se registran como
 * evento anclado a la fábrica del foco. No ejecuta nada.
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
    contexto: { motor: 'fabrica', fase: 'consolidado', fuentes: [...new Set(fuentes)], encaje, nuevos },
  }, privada);
}

/**
 * La regla de autorización (VG, 7-11 noche: «autorizar = bloquear P con el
 * umbral del dueño»; R5 de docs/notas/NEUTRALIDAD_IDENTIDAD.md). Sustituye la
 * regla provisional de la #62 («autoriza quien no es el autor y tiene P > 0
 * sobre un registro del hilo que el autor no escribió»).
 */
export const REGLA_AUTORIZAR = 'autorizar es bloquear P sobre el registro del recurso (la raíz del dominio, [X] confirmar VG) con la consolidación como salida; AUTORIZADO cuando el P bloqueado, de cualquiera y el autor incluido, alcanza el umbral del dueño (su posición 2, «umbral a/b»; si no dice nada, más de la mitad del P emitido sobre el recurso, o del P del eje si el recurso no tiene P propio); ejecuta el autor';

/**
 * Plazo por defecto de un bloqueo de autorización: un ciclo (28 días) desde
 * que se autoriza. Es un campo declarado (contexto.autoridad.caduca): nada
 * se ejecuta ni se libera solo al caducar (VG, 7-11 noche: «la caducidad
 * nunca es automática»). [X] confirmar VG el plazo y qué hace el motor con un
 * bloqueo caducado (hoy, nada: solo lo dice autorizacionCaducada).
 */
export const PLAZO_AUTORIZACION = 'ciclo';

/** X, el registro del recurso de una consolidación (la raíz de su dominio; src/autorizacion.js). */
export function recursoDe(eje, consolidacion) {
  return recursoDel(lectorDelEje(eje), consolidacion);
}

/**
 * El peso de la autorización de una consolidación (src/autorizacion.js,
 * pesoDe): el recurso X, qué P cuenta, cuánto se emitió, cuánto hay
 * bloqueado con salida = la consolidación, el umbral y si lo alcanza.
 */
export function pesoAutorizacion(eje, consolidacion) {
  return pesoDe(lectorDelEje(eje), consolidacion);
}

/**
 * El P que `identidad` tiene disponible y contaría al bloquearlo para
 * autorizar la consolidación: [{ clave, ambito, cantidad }]. Es el P:X del
 * registro del recurso o, si X no tiene P propio emitido, el P del eje.
 * `consolidacion` es un id del eje o un evento (un borrador que aún no está).
 */
export function poderParaBloquear(eje, identidad, consolidacion) {
  const lector = lectorDelEje(eje);
  const c = typeof consolidacion === 'string' ? eje.obtener(consolidacion) : consolidacion;
  if (!c) return [];
  const { claves } = clavesDeP(lector, recursoDel(lector, c));
  return claves.map((clave) => ({ clave, ambito: clave.slice(2), cantidad: eje.saldo(identidad, clave) })).filter((p) => p.cantidad > 0);
}

/**
 * Quién puede autorizar: quien tiene P disponible que cuente (poderParaBloquear),
 * el autor incluido (VG, 7-11 noche: desaparece «no ser el autor», que
 * premiaba la segunda identidad). Poder autorizar no es bastar: el estado lo
 * da la suma bloqueada contra el umbral. Quién ejecuta: el autor de la
 * consolidación.
 */
export function puedeAutorizar(eje, identidad, consolidacion) {
  const c = typeof consolidacion === 'string' ? eje.obtener(consolidacion) : consolidacion;
  return esConsolidacion(c) && poderParaBloquear(eje, identidad, c).length > 0;
}

/** El instante en que caduca lo que se autoriza en `t` con el plazo dado (una escala de T), o null sin plazo. */
function caducidad(t, plazo) {
  if (plazo === null) return null;
  if (!SEGUNDOS[plazo]) throw new Error('plazo de autorización inválido: ' + plazo + ' (una escala de T: ' + Object.keys(SEGUNDOS).join(', ') + ')');
  const ms = msUTC(t);
  if (Number.isNaN(ms)) throw new Error('autorizar: t debe ser un instante ISO-8601 con zona explícita');
  return new Date(ms + SEGUNDOS[plazo] * 1000).toISOString();
}

/**
 * Autorizar: un registro de quien autoriza, anclado en la fábrica de la
 * consolidación, cuyo movimiento es un BLOQUEO de su P sobre el registro del
 * recurso X con la consolidación como salida. Bloquea `cantidad` (por
 * defecto, todo lo que tiene disponible que cuente). Cualquiera con ese P
 * puede autorizar, el autor incluido; la consolidación queda AUTORIZADA
 * cuando la suma bloqueada alcanza el umbral del dueño de X (estadoDe). El
 * bloqueo caduca, como campo declarado, al cabo de `plazo` (por defecto un
 * ciclo; null, sin plazo). El registro lleva en contexto.autoridad la regla,
 * el recurso y lo que bloquea: es una declaración; el estado se recalcula
 * con el eje.
 */
export async function autorizar(eje, { autorizante, consolidacion, cantidad, t, nota = 'autorizo', plazo = PLAZO_AUTORIZACION }, privada) {
  const c = eje.obtener(consolidacion);
  if (!esConsolidacion(c)) throw new Error('no es una consolidación: ' + String(consolidacion).slice(0, 8));
  const estado = estadoDe(eje, consolidacion);
  if (estado !== 'PENDIENTE DE AUTORIZACIÓN') throw new Error('ya está ' + estado.toLowerCase());
  const peso = pesoAutorizacion(eje, c);
  const poder = poderParaBloquear(eje, autorizante, c);
  const disponible = poder.reduce((s, p) => s + p.cantidad, 0);
  if (!(disponible > 0)) {
    throw new Error(autorizante + ' no tiene P que cuente para autorizar: cuenta el P sobre el registro del recurso ' + String(peso.recurso).slice(0, 8)
      + (peso.delEje ? ', que no tiene P propio emitido: el P sobre todo el eje («' + AMBITO_GENESIS + '»)' : ' (P:' + String(peso.recurso).slice(0, 8) + ')'));
  }
  const quiere = cantidad ?? disponible;
  if (!(quiere > 0) || quiere > disponible) throw new Error('la cantidad a bloquear va de 0 (excluido) a ' + disponible + ': ' + quiere);
  const bloqueos = [];
  let resta = quiere;
  for (const p of poder) {
    const usa = Math.min(p.cantidad, resta);
    if (usa > 0) bloqueos.push({ token: 'P', ambito: p.ambito, cantidad: usa, de: autorizante, a: autorizante, estado: 'bloqueo', salida: c.id });
    resta -= usa;
    if (resta <= 0) break;
  }
  const instante = t ?? new Date().toISOString();
  const payload = '==' + nota;
  return eje.escribir({
    autor: autorizante,
    sobre: consolidacion,
    en: FABRICA,
    t: instante,
    // Cartón piedra, como todo registro: un minuto de T por posición escrita; y el bloqueo, que es la autorización.
    movimientos: [{ token: 'T', escala: 'minuto', cantidad: costeT(payload), de: autorizante, a: null }, ...bloqueos],
    payload,
    contexto: {
      modo: 'pointed',
      motor: 'fabrica',
      fase: 'autorizado',
      autoridad: {
        regla: REGLA_AUTORIZAR,
        recurso: peso.recurso,
        bloquea: bloqueos.map((b) => ({ clave: 'P:' + b.ambito, cantidad: b.cantidad })),
        umbral: peso.umbral.texto,
        caduca: caducidad(instante, plazo),
      },
    },
  }, privada);
}

/** ¿Ha caducado en `t` el bloqueo que declara una autorización? Solo lee el campo: nada caduca solo. */
export function autorizacionCaducada(eje, autorizacion, t) {
  const a = typeof autorizacion === 'string' ? eje.obtener(autorizacion) : autorizacion;
  const caduca = a?.contexto?.autoridad?.caduca;
  if (!caduca) return false;
  const ahora = msUTC(t);
  if (Number.isNaN(ahora)) throw new Error('autorizacionCaducada: t debe ser instante ISO-8601 con zona explícita');
  return ahora >= msUTC(caduca);
}

/** Bloqueos de P de una identidad con salida = la consolidación: [{ clave, ambito, cantidad }]. */
export function bloqueosDeP(eje, identidad, consolidacion) {
  return eje.bloqueosCon(consolidacion)
    .filter((b) => b.identidad === identidad && b.clave.startsWith('P:'))
    .map((b) => ({ clave: b.clave, ambito: b.clave.slice(2), cantidad: b.cantidad }));
}

const liberacion = (titular, salida) => (b) => ({ token: 'P', ambito: b.ambito, cantidad: b.cantidad, de: titular, a: titular, estado: 'liberacion', salida });

/**
 * Ejecutar: con la consolidación autorizada, el evento final mueve los
 * tokens reales (además del T del autor) y deja la evidencia: referencia a
 * la consolidación y a las autorizaciones que bloquean P por ella. En el
 * mismo evento libera el P que el autor tenía bloqueado por ella; el de los
 * demás queda LIBERABLE: solo su titular lo libera (nadie mueve tokens
 * ajenos), con liberar(). La capacidad de una posición no se cuenta aquí: la
 * limita una serie de tokens que la ejecución mueve (si quien ejecuta ya no
 * los tiene, el eje la rechaza por saldo insuficiente); el contador de
 * ocupacion() es solo informativo.
 */
export async function ejecutar(eje, { autor, consolidacion, movimientos = [], t, titulo = 'Ejecutado' }, privada) {
  const c = eje.obtener(consolidacion);
  if (!esConsolidacion(c)) throw new Error('no es una consolidación: ' + String(consolidacion).slice(0, 8));
  if (autor !== c.autor) throw new Error('ejecuta el autor de la consolidación: ' + c.autor);
  const estado = estadoDe(eje, consolidacion);
  if (estado === 'PENDIENTE DE AUTORIZACIÓN') throw new Error('PENDIENTE DE AUTORIZACIÓN');
  if (estado === 'EJECUTADO') throw new Error('ya ejecutado');
  const autorizaciones = autorizacionesValidas(eje, consolidacion).map((a) => a.id);
  const payload = [titulo, { ref: consolidacion }, ...autorizaciones.slice(0, 1).map((id) => ({ ref: id }))];
  // Cartón piedra, como todo registro de salida: un minuto de T por posición escrita.
  const mov = [
    { token: 'T', escala: 'minuto', cantidad: contarPosiciones(payload), de: autor, a: null },
    ...movimientos,
    ...bloqueosDeP(eje, autor, consolidacion).map(liberacion(autor, consolidacion)),
  ];
  return eje.escribir({
    autor,
    sobre: consolidacion,
    en: FABRICA,
    t: t ?? new Date().toISOString(),
    movimientos: mov,
    payload,
    contexto: { motor: 'fabrica', fase: 'ejecutado', evidencia: [consolidacion, ...autorizaciones] },
  }, privada);
}

/**
 * Liberar: quien bloqueó P con salida = la consolidación lo devuelve a su
 * disponible, en un registro suyo anclado en la fábrica de la consolidación.
 * Sirve para lo que queda liberable tras ejecutar, para retirar una
 * autorización antes de que se ejecute (R5: «quien bloqueó puede retirarlo
 * antes de ejecutar»; si la suma baja del umbral, vuelve a PENDIENTE) y para
 * un bloqueo caducado. El eje solo deja liberar al titular.
 */
export async function liberar(eje, { titular, consolidacion, t, nota = 'libero' }, privada) {
  const c = eje.obtener(consolidacion);
  if (!esConsolidacion(c)) throw new Error('no es una consolidación: ' + String(consolidacion).slice(0, 8));
  const bloqueos = bloqueosDeP(eje, titular, consolidacion);
  if (!bloqueos.length) throw new Error(titular + ' no tiene P bloqueado por ' + String(consolidacion).slice(0, 8));
  const payload = '==' + nota;
  return eje.escribir({
    autor: titular,
    sobre: consolidacion,
    en: FABRICA,
    t: t ?? new Date().toISOString(),
    movimientos: [{ token: 'T', escala: 'minuto', cantidad: costeT(payload), de: titular, a: null }, ...bloqueos.map(liberacion(titular, consolidacion))],
    payload,
    contexto: { modo: 'pointed', motor: 'fabrica', libera: consolidacion },
  }, privada);
}

/**
 * Autorizaciones que cuentan: los registros «autorizado» en la fábrica de la
 * consolidación que bloquean, de su autor, P de una clave que cuenta (la del
 * registro del recurso) con la consolidación como salida. Lo demás es ruido.
 * Cuántas haya no decide nada: decide la suma bloqueada (estadoDe).
 */
export function autorizacionesValidas(eje, consolidacion) {
  const c = eje.obtener(consolidacion);
  if (!esConsolidacion(c)) return [];
  const lector = lectorDelEje(eje);
  const claves = new Set(clavesDeP(lector, recursoDel(lector, c)).claves);
  return eje.sobre(consolidacion, FABRICA).filter((e) => e.contexto?.fase === 'autorizado' && e.movimientos.some((m) =>
    m.token === 'P' && m.estado === 'bloqueo' && m.salida === c.id && m.de === e.autor && claves.has(claveToken(m))));
}

/**
 * Estado de una consolidación: EJECUTADO si su autor la ejecutó (con la
 * evidencia en el eje); si no, AUTORIZADO si el P bloqueado por ella alcanza
 * el umbral (src/autorizacion.js); si no, PENDIENTE DE AUTORIZACIÓN. Solo las
 * consolidaciones tienen este ciclo: cualquier otro registro no tiene estado
 * (undefined), tampoco el génesis.
 */
export function estadoDe(eje, consolidacion) {
  return estadoPorPeso(lectorDelEje(eje), consolidacion);
}

/** Consolidaciones de un foco con su estado. */
export function consolidaciones(eje, foco, camino = []) {
  return eje.sobre(foco, direccion([...camino, 4]))
    .filter(esConsolidacion)
    .map((e) => ({ id: e.id, autor: e.autor, t: e.t, titulo: e.payload[0], estado: estadoDe(eje, e.id), fuentes: e.contexto.fuentes ?? [] }));
}

// ---------- capacidad: un contador informativo; el límite es una serie de tokens ----------

/**
 * Capacidad de una posición (VG, 7-11). Una posición admite muchos
 * ocupantes (colisiones: se escriben y se ven todos), y puede declarar
 * cuántos de ellos pueden ser VÁLIDOS a la vez en un mismo tramo. Lo que lo
 * hace cumplir no es este contador sino una SERIE LIMITADA de tokens E que
 * emite quien respalda la posición (en Booking, la casa: un token por plaza
 * y noche, tantos como capacidad): ejecutar mueve esos tokens y, sin saldo,
 * el eje no ejecuta. El contador (ocupacion) queda INFORMATIVO: para la
 * interfaz y para saber cuántos tokens emitir; no bloquea nada.
 * [X] decidir VG: cómo declara una posición su capacidad. V0: la décupla de
 * la posición lleva en su criterio (subposición 2: «cuántos caben a la vez»)
 * un entero positivo, como una plaza [nombre, precio, capacidad] bajo la
 * época 0 (0 representación, 1 recursos, 2 criterios). Alternativa: en sus
 * recursos (1), junto al precio. Sin ese entero, la posición no declara nada.
 */
export const CRITERIO_CAPACIDAD = 2;

/** Capacidad que declara el contenido de una posición, o undefined si no declara ninguna. */
export function capacidadDe(nodo) {
  if (!Array.isArray(nodo)) return undefined;
  const c = nodo[CRITERIO_CAPACIDAD];
  return Number.isSafeInteger(c) && c > 0 ? c : undefined;
}

const SIETE = direccion([7]);

/**
 * Tramo de un registro: su futuro (posición 7) como [inicio, fin), dos
 * fechas o instantes ISO; el fin no cuenta (la noche de la salida no se
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
  if (!primero) throw new Error('sin tramo en el 7 de ' + id.slice(0, 8) + ': hace falta [inicio, fin] en ISO, propio o anclado en ' + SIETE + ' por su autor');
  const [a, b] = Array.isArray(primero.contenido) ? primero.contenido : [];
  const inicio = typeof a === 'string' ? Date.parse(a) : NaN;
  const fin = typeof b === 'string' ? Date.parse(b) : NaN;
  if (!(inicio < fin)) throw new Error('tramo ilegible en el 7 de ' + id.slice(0, 8) + ': hacen falta [inicio, fin] en ISO, con inicio antes que fin');
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
 * válidos (con consolidación EJECUTADA; anclados en ella o que la
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
    .filter((o) => o.id !== id && consolidaciones(eje, o.id).some((c) => c.estado === 'EJECUTADO'))
    .map((o) => ({ id: o.id, autor: o.autor, anclado: o.sobre === ev.sobre && o.en === ev.en, tramo: tramoOTodo(eje, o.id) }))
    .filter((o) => o.tramo.inicio < tramo.fin && tramo.inicio < o.tramo.fin);
  const aLaVez = maximoALaVez(validos.map((o) => o.tramo), tramo);
  return conCapacidad.map((c) => {
    const capacidad = capacidadDe(c.contenido);
    return { sobre: ev.sobre, dir: ev.en, camino: c.indices, capacidad, tramo, validos, aLaVez, cabe: aLaVez < capacidad };
  });
}
