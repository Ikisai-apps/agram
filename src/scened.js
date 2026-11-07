// Scened: unas mil piezas en un espacio panorámico (mapa §2.7). Una escena
// compone varios mapas de Mapped (mapped.mapa) y sus ejes temporales
// (tiempo.ejeTemporal) en un marco común: los focos se ordenan por su
// relación en el eje (el hilo da el árbol, los hermanos quedan juntos por
// orden de llegada), las referencias cruzadas entre focos son aristas, y
// todo se cuenta. No es el render animado: aquí solo existe el sobrio.
//
// Tope duro de Scened (mapa §12): 10000 posiciones, que es lo que Scened
// lee de una vez (modos.lectura('scened'): mil décuplas de diez). Una
// décupla leída cuenta diez posiciones, como en lectura(); cada registro
// se lee una vez aunque lo compartan varios focos. Al llegar al tope la
// escena se corta con un aviso explícito, nunca en silencio.
// Cambiar de modo no muta el contenido: la escena solo lee.

import { ARIDAD, esReferencia, esDireccion } from './btml.js';
import { EPOCA_0 } from './epocas.js';
import { lectura } from './modos.js';
import { mapa } from './mapped.js';
import { ejeTemporal } from './tiempo.js';
import { esFormula, analizar } from './bql.js';

/** Tope duro de Scened en posiciones leídas: 1000 décuplas × 10. */
export const TOPE = lectura('scened');

/** Cómo elige focos escenaDe. */
export const ALCANCES = Object.freeze(['hermanos', 'hilo']);

/** Tipos de arista entre focos. */
export const ARISTAS = Object.freeze(['hilo', 'referencia', 'formula']);

const RAIZ = '0000000000';
const corto = (id) => id.slice(0, 8);

/** Registros cuya décupla lee un foco en la escena: él, su hilo, sus hijos y lo que sale en su eje temporal. */
function leidosDe(m, te) {
  const ids = new Set([m.foco]);
  for (const e of m.hilo) ids.add(e.id);
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
 * Referencias que declara una fórmula BQL: cada REF("id o prefijo", "dir"?)
 * de su árbol. Lectura estática: no evalúa (evaluar es puro, pero leería
 * otros registros). Una fórmula que no se puede analizar no declara nada.
 */
function refsDeFormula(texto) {
  let arbol;
  try {
    arbol = analizar(texto.replace(/^=/, ''));
  } catch {
    return [];
  }
  const refs = [];
  const texto0 = (a) => (a && typeof a === 'object' ? (typeof a.v === 'string' ? a.v : typeof a.valor === 'string' ? a.valor : undefined) : undefined);
  const visitar = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(visitar);
    if (typeof n.nombre === 'string' && n.nombre.toUpperCase() === 'REF' && Array.isArray(n.args) && texto0(n.args[0]) !== undefined) {
      refs.push({ prefijo: texto0(n.args[0]).replace(/^@/, '').toLowerCase(), dir: texto0(n.args[1]) });
    }
    for (const v of Object.values(n)) if (v && typeof v === 'object') visitar(v);
  };
  visitar(arbol);
  return refs;
}

/** Id completo de un prefijo, si es único en el eje (como REF en BQL). */
function resolverPrefijo(eje, prefijo) {
  if (!prefijo) return undefined;
  if (eje.obtener(prefijo)) return prefijo;
  const ids = eje.orden.filter((id) => id.startsWith(prefijo));
  return ids.length === 1 ? ids[0] : undefined;
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
 * el tope, entran los primeros). Los repetidos cuentan una vez, con aviso.
 * Opciones: camino y epoca (los de cada mapa: todos los focos se miran desde
 * el mismo camino y la misma época), ahora (el presente de los ejes
 * temporales), maximo (décuplas de hilo y de hijos por foco, como en mapa),
 * tope (posiciones leídas; por defecto y como máximo, el de Scened) y centro
 * (un foco que se marca).
 *
 * Marco común: el antecesor común de todos los focos en el hilo; cada foco
 * tiene su nivel (saltos desde él) y su posición, que sale de recorrer el
 * árbol del hilo desde el común con los hermanos por orden de llegada (el
 * antecesor antes que sus descendientes; los hermanos, juntos). Aristas:
 * 'hilo' (al foco antecesor más cercano en la escena, con los saltos y,
 * si es directo, la posición `en` donde está anclado), 'referencia' (una
 * referencia BTML del payload a otro foco, con su camino y su dirección) y
 * 'formula' (un REF de una fórmula BQL a otro foco). Las referencias no
 * reordenan: solo apuntan hacia atrás en el eje (un id es el hash de un
 * registro que ya existe).
 */
export function escena(eje, focos, { camino = [], epoca = EPOCA_0, ahora = new Date().toISOString(), maximo, tope = TOPE, centro } = {}) {
  if (!Array.isArray(focos) || focos.length === 0) throw new Error('una escena necesita al menos un foco');
  if (!(Number.isInteger(tope) && tope > 0)) throw new Error('tope inválido: ' + tope);
  if (tope > TOPE) throw new Error('el tope de Scened es ' + TOPE + ' posiciones leídas: ' + tope + ' lo supera');
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

  // Admisión por prioridad hasta el tope: cada registro leído cuenta una décupla, una sola vez.
  const opcionesMapa = { camino, epoca, ...(maximo !== undefined ? { maximo } : {}) };
  const opcionesTiempo = { camino, ahora, ...(maximo !== undefined ? { maximo } : {}) };
  const leidos = new Set();
  const admitidos = [];
  let corte = null;
  for (let k = 0; k < pedidos.length; k++) {
    const id = pedidos[k];
    const m = mapa(eje, id, opcionesMapa);
    const te = ejeTemporal(eje, id, opcionesTiempo);
    const nuevos = [...leidosDe(m, te)].filter((x) => !leidos.has(x));
    const necesita = (leidos.size + nuevos.length) * ARIDAD;
    if (necesita > tope) {
      const fuera = pedidos.slice(k);
      corte = { tope, posicionesLeidas: leidos.size * ARIDAD, necesitaba: necesita, foco: id, fuera };
      avisos.unshift(
        'tope de Scened: ' + tope + ' posiciones leídas. El foco ' + corto(id) + ' (' + (k + 1) + 'º de ' + pedidos.length + ') llevaría la lectura a ' + necesita +
        '; la escena se corta ahí y quedan fuera ' + fuera.length + (fuera.length === 1 ? ' foco: ' : ' focos: ') +
        fuera.slice(0, 10).map(corto).join(' ') + (fuera.length > 10 ? ' …' : ''),
      );
      break;
    }
    for (const x of nuevos) leidos.add(x);
    admitidos.push({ id, mapa: m, tiempo: te });
  }

  // Marco común: el antecesor común en el hilo y el orden por el árbol del hilo.
  const llegada = new Map(eje.orden.map((id, i) => [id, i]));
  const cadenas = new Map(admitidos.map((a) => [a.id, eje.hilo(a.id).map((e) => e.id).reverse()]));
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
          if (destino === undefined || (r.dir !== undefined && !esDireccion(r.dir))) continue; // REF sin resolver o mal formado: lo dirá BQL al evaluar
          if (posicion.has(destino)) aristas.push({ tipo: 'formula', de, a: posicion.get(destino), deId: a.id, aId: destino, camino: h.camino, dir: r.dir ?? RAIZ });
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
  const enEje = new Map(); // padre → hermanos escritos sobre él en el eje
  const hermanosEnEje = (sobre) => {
    if (sobre === null) return 1;
    if (!enEje.has(sobre)) enEje.set(sobre, eje.sobre(sobre).length);
    return enEje.get(sobre);
  };
  const piezas = admitidos.map((a, i) => {
    const ev = eje.obtener(a.id);
    return {
      posicion: i,
      id: a.id,
      autor: ev.autor,
      t: ev.t,
      sobre: ev.sobre,
      en: ev.en ?? RAIZ,
      nivel: cadenas.get(a.id).length - compartidos,
      centro: a.id === centro,
      hermano: { indice: indiceEnGrupo.get(a.id), de: grupos.get(ev.sobre).length },
      hermanosEnEje: hermanosEnEje(ev.sobre),
      representacion: a.mapa.terminal ?? a.mapa.celdas[0].contenido, // un terminal no tiene posición 0 (mapa §12): lo representa su terminal
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
    decuplasLeidas: leidos.size,
    posicionesLeidas: leidos.size * ARIDAD,
    tope,
    grupos: grupos.size,
    aristas: porTipo,
    referenciasFuera,
    escritos: suma((a) => a.mapa.medidas.escritos),
    movimientos: suma((a) => a.mapa.medidas.movimientos),
    posicionesDesarrolladas: suma((a) => a.mapa.medidas.posicionesDesarrolladas),
    pasado: suma((a) => a.tiempo.totalPasado),
    futuro: suma((a) => a.tiempo.totalFuturo),
  };
  return { modo: 'scened', comun, camino: [...camino], epoca: epoca.nombre ?? '', ahora, focos: piezas, aristas, recuentos, corte, avisos };
}

/**
 * Escena elegida desde un foco. alcance 'hermanos': el foco y los registros
 * escritos sobre su mismo padre (los comparables accesibles del 8), por
 * orden de llegada. alcance 'hilo': el foco y sus antecesores hasta el
 * génesis, el más cercano primero. El foco va primero (si hay corte, entra)
 * y queda marcado como centro. El resto de opciones, las de escena.
 */
export function escenaDe(eje, foco, { alcance = 'hermanos', ...opciones } = {}) {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  if (!ALCANCES.includes(alcance)) throw new Error('alcance desconocido: ' + alcance + ' (hermanos o hilo)');
  const focos =
    alcance === 'hilo'
      ? eje.hilo(foco).map((e) => e.id)
      : [foco, ...(ev.sobre === null ? [] : eje.sobre(ev.sobre).map((e) => e.id).filter((id) => id !== foco))];
  return { ...escena(eje, focos, { ...opciones, centro: foco }), alcance };
}

function breve(c) {
  if (c === undefined) return '—';
  if (Array.isArray(c)) return '[' + c.length + ']';
  if (esReferencia(c)) return '→' + corto(c.ref);
  const s = String(c);
  return s.length > 32 ? s.slice(0, 31) + '…' : s;
}

function textoArista(x) {
  if (x.tipo === 'hilo') return 'hilo→' + x.a + (x.saltos > 1 ? ' (' + x.saltos + ' saltos)' : '') + (x.en && x.en !== RAIZ ? ' en ' + x.en : '');
  const donde = x.camino.length ? x.camino.join('.') : 'raíz';
  return (x.tipo === 'formula' ? 'fórmula ' : 'ref ') + donde + '→' + x.a + ':' + x.dir;
}

/**
 * Render sobrio: cabecera con el marco común, una línea por foco (posición,
 * nivel, id, autor, representación, hermanos, tiempo y aristas que salen),
 * las aristas y los recuentos, y los avisos. El corte se dice siempre.
 */
export function sobrio(e) {
  const r = e.recuentos;
  const cab =
    'escena · ' + r.enEscena + ' de ' + r.pedidos + ' focos · común ' + (e.comun ? corto(e.comun) : '—') + ' · ' + e.epoca +
    ' · camino ' + (e.camino.length ? e.camino.join('.') : 'raíz') + ' · ' + r.posicionesLeidas + ' de ' + r.tope + ' posiciones leídas';
  const ancho = String(Math.max(0, e.focos.length - 1)).length;
  const lineas = e.focos.map((f) => {
    const partes = [
      String(f.posicion).padStart(ancho) + (f.centro ? '*' : ' ') + 'n' + f.nivel + ' ' + corto(f.id) + ' ' + f.autor + ' ' + breve(f.representacion),
      'hermano ' + f.hermano.indice + ' de ' + f.hermano.de + (f.hermanosEnEje > f.hermano.de ? ' (' + f.hermanosEnEje + ' en el eje)' : ''),
      'pasado ' + f.tiempo.totalPasado + ' futuro ' + f.tiempo.totalFuturo,
      ...f.salen.map(textoArista),
      ...(f.entran ? ['← ' + f.entran] : []),
    ];
    return partes.join(' · ');
  });
  const aristas = 'aristas: hilo ' + r.aristas.hilo + ' · referencia ' + r.aristas.referencia + ' · fórmula ' + r.aristas.formula + ' · fuera de escena ' + r.referenciasFuera;
  const recuentos = 'recuentos: grupos ' + r.grupos + ' · escritos ' + r.escritos + ' · movimientos ' + r.movimientos + ' · posiciones ' + r.posicionesDesarrolladas + ' · pasado ' + r.pasado + ' · futuro ' + r.futuro;
  return [cab, ...lineas, aristas, recuentos, ...e.avisos.map((a) => 'aviso: ' + a)].join('\n');
}

export const RENDERS = Object.freeze({ sobrio });

/** Render por nombre. El animado no existe: se dice, no se simula. */
export function render(e, nombre = 'sobrio') {
  const r = RENDERS[nombre];
  if (!r) throw new Error('render no disponible: ' + nombre);
  return r(e);
}
