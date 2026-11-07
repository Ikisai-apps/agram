// Eje temporal (PV6 y PV7) y comparabilidad (PV8). El presente es la costura:
// a la izquierda los registros, a la derecha las proyecciones. Las bandas
// son las siete escalas del tiempo; lo cercano con detalle, lo lejano
// comprimido. PV8 es comparabilidad relativa entre comparables accesibles;
// las estrellas no son verdad. Cuando hay muchos registros, confluyen hacia
// arriba en el 8: las «bases» (fundibles, por medida y por posición)
// sobre las que el foco se sitúa sin recibir nivel ni grado.

import { SEGUNDOS, ESCALAS_T, AMBITO_GENESIS, claveToken, cantidadBase, partirClave } from './tokens.js';
import { ARIDAD, direccion, resolver, indicesDe, esReferencia } from './btml.js';
import { arbol } from './encaje.js';
import { consolidaciones } from './motor.js';
import { MODOS } from './modos.js';
import { esFormula, evaluar } from './bql.js';
import { EPOCA_0 } from './epocas.js';

/** Banda de una distancia temporal en segundos: la escala más pequeña que la contiene. */
export function banda(deltaSegundos) {
  const d = Math.abs(deltaSegundos);
  for (const e of ESCALAS_T) if (d < SEGUNDOS[e]) return e;
  return 'mas';
}

const seg = (iso) => Date.parse(iso) / 1000;

/**
 * Eje temporal del foco: pasado (hilo hacia atrás y escritos ya ocurridos,
 * el más cercano primero) y futuro (escritos con fecha posterior al ahora,
 * consolidaciones pendientes como futuro subjetivo, y lo declarado en la
 * posición 7). Cada entrada lleva su distancia y su banda.
 */
export function ejeTemporal(eje, foco, { ahora = new Date().toISOString(), maximo = MODOS.sequenced.decuplas, camino = [] } = {}) {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  const t0 = seg(ahora);
  const entrada = (e, tipo) => ({ id: e.id, autor: e.autor, t: e.t, tipo, delta: seg(e.t) - t0, banda: banda(seg(e.t) - t0) });
  const pasado = [];
  for (const h of eje.hilo(foco).slice(1)) pasado.push(entrada(h, 'registro'));
  const futuro = [];
  for (const h of eje.sobre(foco)) {
    if (seg(h.t) > t0) futuro.push(entrada(h, 'proyeccion'));
    else pasado.push(entrada(h, 'registro'));
  }
  for (const c of consolidaciones(eje, foco, camino)) {
    if (c.estado !== 'EJECUTADO') futuro.push({ id: c.id, autor: c.autor, t: c.t, tipo: 'consolidacion', estado: c.estado, delta: seg(c.t) - t0, banda: banda(seg(c.t) - t0) });
  }
  const declarado = resolver(ev.payload, direccion([...camino, 7]));
  if (declarado !== undefined) futuro.push({ id: foco, autor: ev.autor, t: ev.t, tipo: 'declarado', contenido: declarado, delta: 0, banda: 'segundo' });
  pasado.sort((a, b) => b.delta - a.delta); // el más cercano al presente primero (delta negativo mayor)
  futuro.sort((a, b) => a.delta - b.delta);
  const vistos = new Set();
  const unico = (l) => l.filter((x) => !vistos.has(x.id + x.tipo) && vistos.add(x.id + x.tipo));
  return { foco, ahora, pasado: unico(pasado).slice(0, maximo), futuro: unico(futuro).slice(0, maximo), totalPasado: pasado.length, totalFuturo: futuro.length };
}

/** Diez hitos heredados (índice → nivel.grado). Etiquetas provisionales; sin algoritmo que los asigne. */
export const HITOS = Object.freeze([
  { indice: 0, nivel: '0.3', nombre: 'idea' },
  { indice: 1, nivel: '1.1', nombre: 'aprendizaje' },
  { indice: 2, nivel: '2.1', nombre: 'aprendizaje avanzado' },
  { indice: 3, nivel: '3.1', nombre: 'aprendizaje profesional' },
  { indice: 4, nivel: '3.2', nombre: 'resolución profesional' },
  { indice: 5, nivel: '4.1', nombre: 'aprendizaje superior' },
  { indice: 6, nivel: '4.2', nombre: 'solución profesional avanzada' },
  { indice: 7, nivel: '5.1', nombre: 'investigación' },
  { indice: 8, nivel: '5.2', nombre: 'trabajo maestro' },
  { indice: 9, nivel: '5.3', nombre: 'resolución experimental' },
]);

/** Medida simple de un registro: posiciones desarrolladas, escritos encima, movimientos. */
export function medir(eje, id) {
  const ev = eje.obtener(id);
  const contar = (p) => (Array.isArray(p) ? p.reduce((n, h) => n + contar(h), 0) : 1);
  return { posiciones: contar(ev.payload), escritos: eje.sobre(id).length, movimientos: ev.movimientos.length };
}

/**
 * Comparabilidad relativa (PV8): el foco frente a sus comparables accesibles,
 * los registros escritos sobre el mismo padre. Devuelve la posición del foco
 * (1 = más medido) y la lista ordenada. No asigna nivel ni grado: eso queda
 * sin algoritmo, como en la herencia.
 */
export function comparar(eje, foco) {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  const hermanos = ev.sobre === null ? [ev] : eje.sobre(ev.sobre);
  const lista = hermanos.map((h) => {
    const m = medir(eje, h.id);
    return { id: h.id, autor: h.autor, ...m, puntuacion: m.posiciones + 2 * m.escritos + m.movimientos };
  });
  lista.sort((a, b) => b.puntuacion - a.puntuacion);
  const posicion = lista.findIndex((x) => x.id === foco) + 1;
  return { foco, posicion, de: lista.length, comparables: lista, hitos: HITOS };
}

// ---------- confluencia del 8: las bases ----------

/**
 * Cohortes de comparación (VG, 7-11 tarde: «exactamente lo que buscábamos»):
 * hermanos = elementos similares; linaje (o proyecto) = dónde estoy;
 * general = el ámbito. Aquí, anidadas: los hermanos del foco (escritos sobre
 * el mismo padre, en cualquier posición) ⊂ el linaje (el foco, sus
 * antepasados hasta el génesis y lo escrito directamente sobre cada uno de
 * ellos: hermanos, «tíos» e hijos del foco) ⊂ general (todo el eje, el
 * ámbito del génesis). El linaje no es el hilo: el hilo (§10) es solo la
 * cadena foco → génesis.
 * [X] decidir VG: la composición exacta de cada cohorte. Dos variantes que
 * el ejemplo deja ver: hermanos por mismo padre Y misma posición `en` (hoy
 * solo el padre: la cuenta, en 1, es hermana de los criterios de cocina, en
 * 2: ¿son «elementos similares»?); y si el linaje es esta vecindad o el
 * proyecto (un registro concreto del hilo cuyo 8 se lee). Cambiar cohorte =
 * cambiar solo comparables().
 */
export const ALCANCES = Object.freeze(['hermanos', 'linaje', 'general']);

/**
 * Medidas que confluyen, con su etiqueta para mostrarlas. Ninguna es un nivel
 * ni un grado. Los tokens no están aquí: van por clave de saldo (ver
 * clavesDe), porque no existe un P total ni una R fungible.
 * [X] decidir VG: esta lista es la mínima que las piezas existentes permiten
 * medir sin inventar; el mapa (§9) solo dice «mediciones cuantitativas».
 */
export const MEDIDAS = Object.freeze([
  { clave: 'posiciones', etiqueta: 'posiciones desarrolladas (0–9)' },
  { clave: 'terminales', etiqueta: 'terminales del payload' },
  { clave: 'escritos', etiqueta: 'escritos encima' },
  { clave: 'movimientos', etiqueta: 'movimientos' },
  { clave: 'identidades', etiqueta: 'identidades distintas' },
  { clave: 'profundidadHilo', etiqueta: 'profundidad del hilo' },
  { clave: 'formulasResueltas', etiqueta: 'fórmulas resueltas' },
  { clave: 'formulasPendientes', etiqueta: 'fórmulas pendientes' },
]);

/**
 * Etiqueta de una clave de saldo (claveToken) para mostrar su base. Cada
 * serie es la suya: T:<escala>, E:<emisor>/<denominación>, P:<ámbito>,
 * R:<emisor>. Nada se convierte ni se suma entre series.
 */
export function etiquetaClave(clave) {
  const s = partirClave(clave);
  if (s.token === 'T') return 'T movido en ' + s.escala;
  if (s.token === 'E') return 'E movido (' + s.denominacion + ' de ' + s.emisor + ')';
  if (s.token === 'P') return 'P movido sobre ' + (s.ambito === AMBITO_GENESIS ? 'el eje' : s.ambito.slice(0, 8));
  if (s.token === 'R') return 'R movida de ' + s.emisor;
  return clave;
}

/** Comparables accesibles del foco según la cohorte, en orden de llegada al eje. El foco siempre está. */
export function comparables(eje, foco, alcance = 'hermanos') {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  if (!ALCANCES.includes(alcance)) throw new Error('alcance desconocido: ' + alcance);
  const ids = new Set([foco]);
  if (alcance === 'general') {
    for (const id of eje.orden) ids.add(id);
  } else if (alcance === 'linaje') {
    for (const h of eje.hilo(foco)) {
      ids.add(h.id);
      for (const e of eje.sobre(h.id)) ids.add(e.id);
    }
  } else if (ev.sobre !== null) {
    for (const e of eje.sobre(ev.sobre)) ids.add(e.id);
  }
  return eje.orden.filter((id) => ids.has(id)).map((id) => eje.obtener(id));
}

/**
 * Las diez posiciones de profundidad 0 de un registro, leídas del árbol
 * lógico del encaje (§12: el 8 compara ocupantes). Una posición está
 * desarrollada si tiene algún ocupante, y se dice por qué procedencia:
 * propia (contenido del payload que no es una referencia; «1.0» y «1.0.0»
 * colisionan en la 1 y cuentan en ella), referencia (la posición contiene
 * una referencia: alcanzada, no propia, porque las referencias no copian) o
 * escrita (algún registro anclado en esa posición o más hondo: `en` 1.2
 * desarrolla la 1). El registro entero (camino vacío) no es una posición:
 * un terminal no tiene posición 0. Lo escrito en la raíz (`en` 0000000000)
 * colisiona con la posición 0 por §12 y cuenta en ella; además se devuelve
 * aparte como `raiz`, para que el 8 pueda distinguirlo.
 * [X] decidir VG (§10.6): si lo escrito sin posición se anida en la raíz o
 * siempre en una posición concreta; mientras tanto, la raíz es ruido en la 0.
 */
export function posicionesDe(eje, id) {
  const posiciones = Array.from({ length: ARIDAD }, (_, indice) => ({ indice, propia: false, referencia: false, escrita: false, tiene: false }));
  const raiz = { escrita: false };
  for (const [dir, lista] of arbol(eje, id)) {
    const primera = indicesDe(dir)[0]; // undefined: la raíz
    for (const o of lista) {
      if (o.tipo === 'propio') {
        const k = o.camino[0];
        if (k === undefined) continue; // el registro entero, no una posición
        posiciones[k][esReferencia(o.contenido) ? 'referencia' : 'propia'] = true;
      } else if (o.tipo === 'escrito') {
        if (primera === undefined) raiz.escrita = true;
        posiciones[primera ?? 0].escrita = true;
      }
      // Un ocupante por referencia nace siempre de un propio que contiene la referencia: ya está contado.
    }
  }
  for (const p of posiciones) p.tiene = p.propia || p.referencia || p.escrita;
  return { posiciones, raiz, desarrolladas: posiciones.filter((p) => p.tiene).length };
}

/** Tokens movidos por un evento, por clave de saldo (T:escala, E:emisor/denominación, P:ámbito, R:emisor), en su unidad de saldo. */
export function clavesDe(ev) {
  const porClave = {};
  for (const mov of ev.movimientos) {
    const k = claveToken(mov);
    porClave[k] = (porClave[k] ?? 0) + cantidadBase(mov);
  }
  return porClave;
}

/**
 * Medidas de un registro para la confluencia: las posiciones desarrolladas
 * (posicionesDe, con sus procedencias), los terminales del payload y los
 * escritos y movimientos de medir(), los tokens movidos por clave de saldo
 * (clavesDe), las identidades distintas que tocan sus movimientos, la
 * profundidad del hilo y las fórmulas de su payload resueltas frente a las
 * no resueltas.
 * [X] decidir VG: PENDIENTE, INCOMPATIBLE y ERROR cuentan juntas como
 * «pendientes»; el mapa no dice si una fórmula rota es lo mismo que una que
 * espera.
 */
export function medidasDe(eje, id) {
  const ev = eje.obtener(id);
  if (!ev) throw new Error('registro desconocido: ' + id);
  const base = medir(eje, id);
  const p = posicionesDe(eje, id);
  const m = {
    posiciones: p.desarrolladas,
    terminales: base.posiciones,
    escritos: base.escritos,
    movimientos: base.movimientos,
    identidades: 0,
    profundidadHilo: eje.hilo(id).length - 1,
    formulasResueltas: 0,
    formulasPendientes: 0,
    tokens: clavesDe(ev),
    procedencias: p.posiciones,
    raiz: p.raiz,
  };
  const identidades = new Set();
  for (const mov of ev.movimientos) {
    if (mov.de) identidades.add(mov.de);
    if (mov.a) identidades.add(mov.a);
  }
  m.identidades = identidades.size;
  const recorrer = (nodo, indices) => {
    if (Array.isArray(nodo)) {
      nodo.forEach((hijo, i) => recorrer(hijo, [...indices, i]));
      return;
    }
    if (!esFormula(nodo)) return;
    if (evaluar(eje, id, indices).estado === 'RESUELTO') m.formulasResueltas++;
    else m.formulasPendientes++;
  };
  recorrer(ev.payload, []);
  return m;
}

/** Diez cajas: las diez posiciones de la décupla de una medida, que son los diez hitos del 8. */
export const CAJAS = ARIDAD;

/**
 * Cortes provisionales de las cajas de una medida en una cohorte: nueve
 * umbrales de igual anchura entre el mínimo y el máximo de la cohorte.
 * [X] decidir VG: los cortes de las cajas son regla de la época (VG, 7-11) y
 * la época 0 no los tiene. Con cortes de la cohorte el histograma no se
 * funde con el de otra cohorte (fundir exige los mismos cortes); cuando una
 * época dé `cortes(medida)`, confluir los usa y las bases se funden.
 */
export function cortesDeCohorte(minimo, maximo) {
  if (!(maximo > minimo)) return [];
  const ancho = (maximo - minimo) / CAJAS;
  return Array.from({ length: CAJAS - 1 }, (_, j) => minimo + (j + 1) * ancho);
}

/** Caja de un valor: cuántos cortes deja por debajo o en él (0–9). Sin cortes, la 0. */
export function cajaDe(valor, cortes) {
  let k = 0;
  while (k < cortes.length && valor >= cortes[k]) k++;
  return k;
}

/**
 * Base de una medida en una cohorte (VG, 7-11 tarde): solo lo FUNDIBLE.
 * Recuento, suma, mínimo, máximo e histograma de diez cajas (una décupla
 * por medida, cuyas diez posiciones son los diez hitos del 8), y la caja
 * donde se sitúa el foco. Lo no fundible (medianas exactas, cuantiles,
 * cuántos tienen más o menos que el foco) no está: VG lo descarta o lo
 * aproxima. `cortes` (nueve umbrales crecientes) viene de la época; sin
 * ellos, los provisionales de la cohorte (ver cortesDeCohorte).
 * No es un nivel ni un grado: la caja es dónde cae el foco, no lo que vale.
 */
export function distribucion(valores, valorFoco, { cortes } = {}) {
  let n = 0;
  let suma = 0;
  let minimo = Infinity;
  let maximo = -Infinity;
  for (const v of valores) {
    n++;
    suma += v;
    if (v < minimo) minimo = v;
    if (v > maximo) maximo = v;
  }
  const deEpoca = Array.isArray(cortes);
  const usados = deEpoca ? [...cortes] : cortesDeCohorte(minimo, maximo);
  const cajas = new Array(CAJAS).fill(0);
  for (const v of valores) cajas[cajaDe(v, usados)]++;
  return {
    foco: valorFoco,
    n,
    suma,
    minimo: n ? minimo : null,
    maximo: n ? maximo : null,
    cortes: usados,
    origenCortes: deEpoca ? 'epoca' : 'cohorte',
    cajas,
    caja: cajaDe(valorFoco, usados),
  };
}

/**
 * Fundir dos bases de la misma medida es O(1) (VG, 7-11): recuentos y sumas
 * se suman, mínimo y máximo se combinan, y las cajas se suman una a una si
 * las dos usan los mismos cortes; si no, el histograma no se puede fundir y
 * queda en null (lo demás sí). El foco no se funde: se vuelve a situar
 * contra la base fundida.
 */
export function fundir(a, b) {
  const mismos = a.cortes.length === b.cortes.length && a.cortes.every((c, i) => c === b.cortes[i]);
  const extremo = (f, x, y) => (x === null ? y : y === null ? x : f(x, y));
  return {
    n: a.n + b.n,
    suma: a.suma + b.suma,
    minimo: extremo(Math.min, a.minimo, b.minimo),
    maximo: extremo(Math.max, a.maximo, b.maximo),
    cortes: mismos ? [...a.cortes] : null,
    origenCortes: mismos && a.origenCortes === b.origenCortes ? a.origenCortes : null,
    cajas: mismos ? a.cajas.map((x, i) => x + b.cajas[i]) : null,
  };
}

/**
 * Confluencia del 8: las «bases» del foco frente a una cohorte de
 * comparables accesibles. Por cada medida (MEDIDAS) y por cada clave de
 * token que algún comparable mueve, su base fundible y la caja del foco; por
 * cada posición 0–9, cuántos comparables la tienen desarrollada, por qué
 * procedencia (propia, referencia, escrita) y si el foco la tiene; y aparte,
 * cuántos tienen algo escrito en la raíz. La época pone el significado de
 * cada posición (regla corta) y, si los tiene, los cortes de las cajas
 * (`epoca.cortes(clave)`). No asigna nivel ni grado: los HITOS se devuelven
 * solo como tabla. Consulta sin efectos: escribir las bases como registros
 * en la posición 8 (VG, 7-11) es otra pieza.
 */
export function confluir(eje, foco, { alcance = 'hermanos', epoca = EPOCA_0 } = {}) {
  const lista = comparables(eje, foco, alcance);
  const filas = lista.map((e) => ({ id: e.id, autor: e.autor, t: e.t, ...medidasDe(eje, e.id) }));
  const delFoco = filas.find((f) => f.id === foco);
  const cortesDe = (clave) => (typeof epoca.cortes === 'function' ? epoca.cortes(clave) : undefined);
  const medidas = {};
  for (const { clave } of MEDIDAS) medidas[clave] = distribucion(filas.map((f) => f[clave]), delFoco[clave], { cortes: cortesDe(clave) });
  const claves = [...new Set(filas.flatMap((f) => Object.keys(f.tokens)))].sort();
  const tokens = {};
  for (const clave of claves) tokens[clave] = { etiqueta: etiquetaClave(clave), ...distribucion(filas.map((f) => f.tokens[clave] ?? 0), delFoco.tokens[clave] ?? 0, { cortes: cortesDe(clave) }) };
  const posiciones = [];
  for (let i = 0; i < ARIDAD; i++) {
    const cuenta = { comparables: 0, propias: 0, referencias: 0, escritas: 0 };
    for (const f of filas) {
      const p = f.procedencias[i];
      if (p.tiene) cuenta.comparables++;
      if (p.propia) cuenta.propias++;
      if (p.referencia) cuenta.referencias++;
      if (p.escrita) cuenta.escritas++;
    }
    const { propia, referencia, escrita, tiene } = delFoco.procedencias[i];
    posiciones.push({ indice: i, significado: epoca.reglaCorta(0, i), ...cuenta, proporcion: cuenta.comparables / filas.length, foco: tiene, delFoco: { propia, referencia, escrita } });
  }
  const enRaiz = filas.filter((f) => f.raiz.escrita).length;
  const raiz = { comparables: enRaiz, proporcion: enRaiz / filas.length, foco: delFoco.raiz.escrita };
  return { foco, alcance, n: filas.length, comparables: filas, medidas, tokens, posiciones, raiz, hitos: HITOS };
}
