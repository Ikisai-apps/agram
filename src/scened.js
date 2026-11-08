// Scened: unas mil piezas en un espacio panorámico (mapa §2.7 [A]). Una
// escena compone varios mapas de Mapped (mapped.mapa) y sus ejes temporales
// (tiempo.ejeTemporal) en un marco común: los focos se ordenan por el árbol
// del hilo en preorden (cada registro antes de lo que cuelga de él; los
// hijos de un mismo registro, por orden de llegada; una rama entera antes
// que la siguiente, así que dos hermanos no van seguidos si el primero
// tiene descendientes en la escena), las referencias cruzadas entre focos
// son aristas, y todo se cuenta. No es el render animado: aquí solo existe
// el sobrio. Cambiar de modo no muta el contenido: la escena solo lee.
//
// Capacidad: lo que la escena trae se cuenta por lo que hay (VG, 7-11
// noche, decisión 10.1): cada registro traído, una vez, por su contenido
// real (modos.contenido: un terminal, una posición; cada ocupante de una
// lista, uno), no diez por décupla. El máximo de Scened es duro y es el mismo para
// representar y para emitir: maximo('scened') = 10000 posiciones (VG, 7-11
// noche: «ese es el máximo de datos que se pueden representar»). La
// capacidad de una escena se puede bajar, nunca subir por encima del
// máximo ni quitar (Infinity es un error). Al pasarla, la escena se corta
// con un aviso explícito, nunca en silencio: dice cuántas posiciones trae
// de cuántas harían falta. La escena devuelve siempre los tres números en
// `cifras` ({ conseguido, minimo, maximo, alMinimo, necesario }; se llama
// así y no `alcance` porque escenaDe ya usa `alcance` para la cohorte): lo
// conseguido, el mínimo que intenta (1000) y el máximo (10000). No llegar
// al mínimo no es error: se dice.

import { esReferencia, esDireccion } from './btml.js';
import { EPOCA_0, epocaDe } from './epocas.js';
import { maximo as maximoDe, alcanceDe, contenido } from './modos.js';
import { mapa, MAXIMO_REGISTROS } from './mapped.js';
import { ejeTemporal, comparables } from './tiempo.js';
import { esFormula, analizar } from './bql.js';

/** Capacidad de Scened en posiciones con contenido: su máximo duro, maximo('scened') = 10000 (VG, 7-11 noche). La opción capacidad solo la baja. */
export const CAPACIDAD = maximoDe('scened');

/** Cómo elige focos escenaDe: las tres cohortes de §12 (tiempo.comparables) y el hilo hacia arriba. */
export const ALCANCES = Object.freeze(['hermanos', 'proyecto', 'general', 'hilo']);

/** Tipos de arista entre focos. */
export const ARISTAS = Object.freeze(['hilo', 'referencia', 'formula']);

const RAIZ = '0000000000';
const corto = (id) => id.slice(0, 8);

/**
 * Registros que un foco trae a la escena: él, su hilo ENTERO hasta el génesis
 * (el marco común y las aristas de hilo salen de él, aunque el mapa enseñe
 * solo `maximo`), sus hijos y lo que sale en su eje temporal (hasta `maximo`
 * cada uno, como los traen mapa y ejeTemporal). No cuenta los números que
 * esos módulos calculan sobre el eje entero sin traer décuplas (medidas del
 * 8, totales del eje temporal, hermanos en el eje).
 */
function traidosDe(m, te, cadena) {
  const ids = new Set(cadena);
  for (const e of m.hijos) ids.add(e.id);
  for (const x of te.pasado) ids.add(x.id);
  for (const x of te.futuro) ids.add(x.id);
  return ids;
}

/** Hojas de un payload con su camino de índices. */
function hojas(nodo, camino = [], fuera = []) {
  if (Array.isArray(nodo)) nodo.forEach((h, i) => hojas(h, [...camino, i], fuera));
  else fuera.push({ camino, contenido: nodo });
  return fuera;
}

/**
 * Referencias que declara una fórmula BQL: cada REF de su árbol cuyo
 * resultado ya se sabe sin evaluar, con las mismas reglas que REF en
 * src/bql.js: el primer argumento, un texto literal (id o prefijo, con o sin
 * @, sin distinguir mayúsculas); el segundo, si está, un texto literal de
 * diez dígitos. Un REF con un argumento que es una expresión depende de
 * evaluar y no se lee aquí; uno con un literal de otro tipo es ERROR en BQL
 * y tampoco. Una fórmula que no se puede analizar no declara nada.
 */
function refsDeFormula(texto) {
  let arbol;
  try {
    arbol = analizar(texto.replace(/^=/, ''));
  } catch {
    return [];
  }
  const refs = [];
  const literal = (a) => (a && a.tipo === 'str' && typeof a.v === 'string' ? a.v : undefined);
  const visitar = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(visitar);
    if (n.tipo === 'fn' && n.nombre === 'REF' && Array.isArray(n.args)) {
      const id = literal(n.args[0]);
      const dir = n.args.length > 1 ? literal(n.args[1]) : RAIZ;
      if (id !== undefined && dir !== undefined && esDireccion(dir)) refs.push({ prefijo: id, dir });
    }
    for (const v of Object.values(n)) if (v && typeof v === 'object') visitar(v);
  };
  visitar(arbol);
  return refs;
}

/** Id de un prefijo como lo resuelve REF en BQL: sin @, en minúsculas, hexadecimal y único en el eje. Si no, undefined. */
function resolverPrefijo(eje, prefijo) {
  const p = prefijo.replace(/^@/, '').toLowerCase();
  if (!/^[0-9a-f]+$/.test(p)) return undefined; // BQL: ERROR, referencia mal formada
  const ids = typeof eje.conPrefijo === 'function' ? eje.conPrefijo(p) : eje.orden.filter((id) => id.startsWith(p)); // índice del eje, mismo resultado
  return ids.length === 1 ? ids[0] : undefined; // ninguno: PENDIENTE; varios: ERROR (ambigua)
}

/** Compara dos claves de orden: lexicográfico, el prefijo (el antecesor) primero. */
function compararClaves(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

/**
 * Escena de varios focos en un marco común.
 *
 * focos: ids de registros, en orden de prioridad (si la escena se corta por
 * la capacidad, entran los primeros). Los repetidos cuentan una vez, con
 * aviso. Opciones: camino y epoca (los de cada mapa: todos los focos se miran
 * desde el mismo camino y la misma época; la época, por objeto o por
 * nombre), ahora (el presente de los ejes temporales), maximo (registros de
 * hilo, de hijos y de eje temporal que trae cada foco, como en mapa; un
 * entero de 0 a mapped.MAXIMO_REGISTROS), capacidad (posiciones con
 * contenido; por defecto CAPACIDAD, el máximo de
 * Scened; un entero de 1 a CAPACIDAD: por encima, o Infinity, es un error)
 * y centro (un foco que se marca).
 *
 * Marco común: el antecesor común de todos los focos en el hilo; cada foco
 * tiene su nivel (saltos desde él) y su posición, que sale de recorrer en
 * preorden el árbol del hilo desde el común, con los hijos de cada registro
 * por orden de llegada: cada foco va antes que sus descendientes, y una
 * rama entera va antes que la siguiente (dos hermanos no van seguidos si
 * entre ellos caen los descendientes del primero).
 * [X] decidir VG: preorden (hoy: cada rama seguida) o por niveles (los
 * hermanos seguidos, los descendientes después).
 * Aristas: 'hilo' (al foco antecesor más cercano en la escena, con los
 * saltos y, si es directo, la posición `en` donde está anclado), 'referencia'
 * (una referencia BTML del payload a otro foco, con su camino y su
 * dirección) y 'formula' (un REF de una fórmula BQL a otro foco). Las
 * referencias no reordenan: solo apuntan hacia atrás en el eje (un id es el
 * hash de un registro que ya existe).
 *
 * Cifras (VG, 7-11 noche): { conseguido, minimo, maximo, alMinimo,
 * necesario }. conseguido = posiciones con contenido en escena; minimo y maximo, los de
 * Scened (1000 y 10000); alMinimo, si llega al mínimo; necesario, las
 * posiciones que traería la escena entera sin corte (igual que conseguido
 * si no se corta). Con corte, el aviso dice «trae X de Y posiciones».
 */
export function escena(eje, focos, { camino = [], epoca = EPOCA_0, ahora = new Date().toISOString(), maximo, capacidad = CAPACIDAD, centro } = {}) {
  if (!Array.isArray(focos) || focos.length === 0) throw new Error('una escena necesita al menos un foco');
  if (!(Number.isInteger(capacidad) && capacidad > 0 && capacidad <= CAPACIDAD)) {
    throw new Error('capacidad inválida: ' + capacidad + ' (un entero de 1 a ' + CAPACIDAD + ': el máximo de Scened es duro; se puede pedir menos, nunca más)');
  }
  if (maximo !== undefined && !(Number.isInteger(maximo) && maximo >= 0 && maximo <= MAXIMO_REGISTROS)) {
    throw new Error('maximo inválido: ' + maximo + ' (un entero de 0 a ' + MAXIMO_REGISTROS + ', como en Mapped: se puede pedir menos, nunca más)');
  }
  const e = epocaDe(epoca);
  const avisos = [];
  const pedidos = [];
  const vistos = new Set();
  for (const id of focos) {
    if (!eje.obtener(id)) throw new Error('foco desconocido: ' + id);
    if (vistos.has(id)) { avisos.push('foco repetido: ' + corto(id) + ' (cuenta una vez)'); continue; }
    vistos.add(id);
    pedidos.push(id);
  }
  if (centro !== undefined && !vistos.has(centro)) throw new Error('el centro no está entre los focos: ' + centro);

  // Admisión por prioridad hasta la capacidad: cada registro traído cuenta su contenido real, una sola vez.
  const cuanto = new Map();
  const sumaContenido = (ids) => {
    let n = 0;
    for (const x of ids) {
      if (!cuanto.has(x)) cuanto.set(x, contenido(eje.obtener(x).payload));
      n += cuanto.get(x);
    }
    return n;
  };
  let enEscena = 0; // posiciones con contenido de lo traído
  const opcionesMapa = { camino, epoca: e, ...(maximo !== undefined ? { maximo } : {}) };
  const opcionesTiempo = { camino, ahora, ...(maximo !== undefined ? { maximo } : {}) };
  const traidos = new Set();
  const todos = new Set(); // lo que traería la escena entera, sin corte: para decir «trae X de Y»
  const admitidos = [];
  let corte = null;
  let enCorte = -1; // índice del foco donde se corta
  for (let k = 0; k < pedidos.length; k++) {
    const id = pedidos[k];
    const m = mapa(eje, id, opcionesMapa);
    const te = ejeTemporal(eje, id, opcionesTiempo);
    const cadena = eje.hilo(id).map((x) => x.id).reverse(); // del génesis al foco
    const suyos = traidosDe(m, te, cadena);
    for (const x of suyos) todos.add(x);
    if (corte) continue; // ya cortada: solo se cuenta lo que faltaría
    const nuevos = [...suyos].filter((x) => !traidos.has(x));
    const necesita = enEscena + sumaContenido(nuevos);
    if (necesita > capacidad) {
      corte = { capacidad, posicionesEnEscena: enEscena, necesitaba: necesita, foco: id, fuera: pedidos.slice(k) };
      enCorte = k;
      continue;
    }
    for (const x of nuevos) traidos.add(x);
    enEscena = necesita;
    admitidos.push({ id, mapa: m, tiempo: te, cadena });
  }
  const cifras = { ...alcanceDe(enEscena, 'scened'), necesario: sumaContenido(todos) };
  if (corte) {
    const { fuera } = corte;
    avisos.unshift(
      'capacidad de la escena: ' + capacidad + ' posiciones. El foco ' + corto(corte.foco) + ' (' + (enCorte + 1) + 'º de ' + pedidos.length + ') la llevaría a ' + corte.necesitaba +
      '; la escena se corta ahí y quedan fuera ' + fuera.length + (fuera.length === 1 ? ' foco: ' : ' focos: ') +
      fuera.slice(0, 10).map(corto).join(' ') + (fuera.length > 10 ? ' …' : '') +
      '. Trae ' + cifras.conseguido + ' de ' + cifras.necesario + ' posiciones.',
    );
  }

  // Marco común: el antecesor común en el hilo y el orden por el árbol del hilo, en preorden.
  const llegada = new Map(eje.orden.map((id, i) => [id, i]));
  const cadenas = new Map(admitidos.map((a) => [a.id, a.cadena]));
  let comun = null;
  let compartidos = 0; // registros del hilo que comparten todos los focos, desde el génesis
  if (admitidos.length) {
    const lista = [...cadenas.values()];
    const n = Math.min(...lista.map((c) => c.length));
    while (compartidos < n && lista.every((c) => c[compartidos] === lista[0][compartidos])) compartidos++;
    comun = lista[0][compartidos - 1];
  }
  const claveDe = (id) => cadenas.get(id).slice(compartidos).map((x) => llegada.get(x));
  const claves = new Map(admitidos.map((a) => [a.id, claveDe(a.id)]));
  admitidos.sort((a, b) => compararClaves(claves.get(a.id), claves.get(b.id)));
  const posicion = new Map(admitidos.map((a, i) => [a.id, i]));

  // Grupos de hermanos: los focos escritos sobre el mismo registro.
  const grupos = new Map();
  for (const a of admitidos) {
    const g = eje.obtener(a.id).sobre;
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g).push(a.id);
  }

  // Aristas.
  const aristas = [];
  let referenciasFuera = 0;
  for (const a of admitidos) {
    const ev = eje.obtener(a.id);
    const de = posicion.get(a.id);
    const cadena = cadenas.get(a.id);
    for (let i = cadena.length - 2; i >= 0; i--) {
      if (posicion.has(cadena[i])) {
        const saltos = cadena.length - 1 - i;
        aristas.push({ tipo: 'hilo', de, a: posicion.get(cadena[i]), deId: a.id, aId: cadena[i], saltos, ...(saltos === 1 ? { en: ev.en ?? RAIZ } : {}) });
        break;
      }
    }
    for (const h of hojas(ev.payload)) {
      if (esReferencia(h.contenido)) {
        const destino = h.contenido.ref;
        if (posicion.has(destino)) aristas.push({ tipo: 'referencia', de, a: posicion.get(destino), deId: a.id, aId: destino, camino: h.camino, dir: h.contenido.dir ?? RAIZ });
        else referenciasFuera++;
      } else if (esFormula(h.contenido)) {
        for (const r of refsDeFormula(h.contenido)) {
          const destino = resolverPrefijo(eje, r.prefijo);
          if (destino === undefined) continue; // REF sin resolver: BQL da PENDIENTE o ERROR al evaluar
          if (posicion.has(destino)) aristas.push({ tipo: 'formula', de, a: posicion.get(destino), deId: a.id, aId: destino, camino: h.camino, dir: r.dir });
          else referenciasFuera++;
        }
      }
    }
  }

  const salen = admitidos.map(() => []);
  const entran = admitidos.map(() => 0);
  for (const x of aristas) {
    salen[x.de].push(x);
    entran[x.a]++;
  }
  const indiceEnGrupo = new Map();
  for (const ids of grupos.values()) ids.forEach((id, i) => indiceEnGrupo.set(id, i + 1));
  const piezas = admitidos.map((a, i) => {
    const ev = eje.obtener(a.id);
    return {
      posicion: i,
      id: a.id,
      autor: ev.autor,
      t: ev.t,
      sobre: ev.sobre,
      en: ev.en ?? RAIZ,
      nivel: a.cadena.length - compartidos,
      centro: a.id === centro,
      hermano: { indice: indiceEnGrupo.get(a.id), de: grupos.get(ev.sobre).length },
      hermanosEnEje: ev.sobre === null ? 1 : eje.sobre(ev.sobre).length, // un número del índice del eje: no trae décuplas
      salen: salen[i],
      entran: entran[i],
      mapa: a.mapa,
      tiempo: a.tiempo,
    };
  });

  const suma = (f) => admitidos.reduce((s, a) => s + f(a), 0);
  const porTipo = Object.fromEntries(ARISTAS.map((t) => [t, aristas.filter((x) => x.tipo === t).length]));
  const recuentos = {
    pedidos: pedidos.length,
    enEscena: admitidos.length,
    fuera: corte ? corte.fuera.length : 0,
    decuplasEnEscena: traidos.size,
    posicionesEnEscena: enEscena,
    capacidad,
    grupos: grupos.size,
    aristas: porTipo,
    referenciasFuera,
    escritos: suma((a) => a.mapa.medidas.escritos),
    movimientos: suma((a) => a.mapa.medidas.movimientos),
    posicionesDesarrolladas: suma((a) => a.mapa.medidas.posicionesDesarrolladas),
    pasado: suma((a) => a.tiempo.totalPasado),
    futuro: suma((a) => a.tiempo.totalFuturo),
  };
  return { modo: 'scened', comun, camino: [...camino], epoca: e.nombre, ahora, focos: piezas, aristas, recuentos, cifras, corte, avisos };
}

/**
 * Escena elegida desde un foco. Alcances:
 * - 'hermanos', 'proyecto', 'general': las cohortes de §12 tal como las da
 *   tiempo.comparables (hermanos = escritos sobre el mismo padre; proyecto =
 *   el proyecto del foco y lo que cuelga de él; general = todo el eje), en
 *   orden de llegada. Lo que esas cohortes dejan abierto es el [X] de
 *   src/tiempo.js (entre otras cosas, si los hermanos exigen además la misma
 *   posición `en`): si cambia allí, cambia aquí.
 * - 'hilo': el foco y sus antecesores hasta el génesis, el más cercano primero.
 * El foco va primero (si hay corte, entra) y queda marcado como centro. El
 * resto de opciones, las de escena.
 */
export function escenaDe(eje, foco, { alcance = 'hermanos', ...opciones } = {}) {
  if (!eje.obtener(foco)) throw new Error('foco desconocido: ' + foco);
  if (!ALCANCES.includes(alcance)) throw new Error('alcance desconocido: ' + alcance + ' (' + ALCANCES.join(', ') + ')');
  const ids = alcance === 'hilo' ? eje.hilo(foco).map((e) => e.id) : comparables(eje, foco, alcance).map((e) => e.id);
  const focos = [foco, ...ids.filter((id) => id !== foco)];
  return { ...escena(eje, focos, { ...opciones, centro: foco }), alcance };
}

function breve(c) {
  // Forma canónica (VG, 8-11): la lista de un ocupante se muestra como su ocupante ([1] = 1).
  if (Array.isArray(c) && c.length === 1 && !Array.isArray(c[0])) return breve(c[0]);
  if (Array.isArray(c)) return '[' + c.length + ']';
  if (esReferencia(c)) return '→' + corto(c.ref);
  const s = String(c);
  return s.length > 32 ? s.slice(0, 31) + '…' : s;
}

/** Contenido del foco en el camino, como en Sequenced: el terminal, o las posiciones desarrolladas con su índice. */
function contenidoDe(m) {
  if (m.terminal !== undefined) return [breve(m.terminal)]; // un terminal no tiene posiciones
  const desarrolladas = m.celdas.filter((c) => c.contenido !== undefined).map((c) => c.indice + ' ' + breve(c.contenido));
  return desarrolladas.length ? desarrolladas : ['—'];
}

function textoArista(x) {
  if (x.tipo === 'hilo') return 'hilo→' + x.a + (x.saltos > 1 ? ' (' + x.saltos + ' saltos)' : '') + (x.en && x.en !== RAIZ ? ' en ' + x.en : '');
  const donde = x.camino.length ? x.camino.join('.') : 'raíz';
  return (x.tipo === 'formula' ? 'fórmula ' : 'ref ') + donde + '→' + x.a + ':' + x.dir;
}

/**
 * Render sobrio: cabecera con el marco común y las cifras (lo conseguido de
 * la capacidad, el mínimo y el máximo de Scened), una línea por foco (posición,
 * nivel, id, autor, contenido en el camino, hermanos, tiempo y aristas que
 * salen), las aristas y los recuentos, y los avisos. El corte se dice siempre.
 */
export function sobrio(e) {
  const r = e.recuentos;
  const cab =
    'escena · ' + r.enEscena + ' de ' + r.pedidos + ' focos · común ' + (e.comun ? corto(e.comun) : '—') + ' · ' + e.epoca +
    ' · camino ' + (e.camino.length ? e.camino.join('.') : 'raíz') + ' · ' + r.posicionesEnEscena + ' de ' + r.capacidad + ' posiciones' +
    ' · mín ' + e.cifras.minimo + (e.cifras.alMinimo ? '' : ' (no llega)') + ' · máx ' + e.cifras.maximo;
  const ancho = String(Math.max(0, e.focos.length - 1)).length;
  const lineas = e.focos.map((f) => {
    const partes = [
      String(f.posicion).padStart(ancho) + (f.centro ? '*' : ' ') + 'n' + f.nivel + ' ' + corto(f.id) + ' ' + f.autor,
      ...contenidoDe(f.mapa),
      'hermano ' + f.hermano.indice + ' de ' + f.hermano.de + (f.hermanosEnEje > f.hermano.de ? ' (' + f.hermanosEnEje + ' en el eje)' : ''),
      'pasado ' + f.tiempo.totalPasado + ' futuro ' + f.tiempo.totalFuturo,
      ...f.salen.map(textoArista),
      ...(f.entran ? ['← ' + f.entran] : []),
    ];
    return partes.join(' · ');
  });
  const aristas = 'aristas: hilo ' + r.aristas.hilo + ' · referencia ' + r.aristas.referencia + ' · fórmula ' + r.aristas.formula + ' · fuera de escena ' + r.referenciasFuera;
  const recuentos = 'recuentos: grupos ' + r.grupos + ' · escritos ' + r.escritos + ' · movimientos ' + r.movimientos + ' · posiciones desarrolladas ' + r.posicionesDesarrolladas + ' · pasado ' + r.pasado + ' · futuro ' + r.futuro;
  return [cab, ...lineas, aristas, recuentos, ...e.avisos.map((a) => 'aviso: ' + a)].join('\n');
}

export const RENDERS = Object.freeze({ sobrio });

/** Render por nombre. El animado no existe: se dice, no se simula. */
export function render(e, nombre = 'sobrio') {
  const r = RENDERS[nombre];
  if (!r) throw new Error('render no disponible: ' + nombre);
  return r(e);
}
