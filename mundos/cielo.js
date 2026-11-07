// Mundo del cielo (PV8): las bases del 8 como constelaciones.
//
// Sobrio y animado son dos renders de la misma lectura (mapa §10.3 [D]): el
// sobrio es la tabla de medidas situadas (htmlCieloSobrio) y el animado, el
// cielo (svgCielo). Los dos leen datosCielo(), que a su vez lee las bases del
// 8 (src/bases.js; mapa §12 [D] «Cohortes y bases del 8»). Nada simulado: si
// el 8 de la cohorte no tiene base escrita, la base se calcula al vuelo con
// las mismas funciones (medir, fundir) y se marca «sin escribir».
//
// Qué se ve:
// - una constelación por medida de la confluencia (tiempo.MEDIDAS) y por
//   serie de token: diez estrellas, una por caja, en el orden de los valores
//   (de la caja 0 a la 9), sobre una bóveda simétrica (ni sube ni baja: el
//   orden de las cajas es de valores, no de grados);
// - la décupla: diez estrellas, una por posición 0–9, cuántos de la cohorte
//   la tienen desarrollada; el foco lleva un anillo en cada una que tiene;
// - el brillo de cada estrella (área y opacidad) es proporcional a su
//   recuento: cuántos registros de la cohorte caen en esa caja;
// - el foco, con un anillo en su caja, en cada constelación;
// - las líneas unen las estrellas encendidas, en el orden de las cajas;
// - un selector de cohorte (hermanos, proyecto, general) en el orden fijo de
//   COHORTES: nunca se ordenan cohortes ni se asigna nivel. Más estrellas no
//   es mejor: es más registros en esa caja.
//
// Qué se anima: al cambiar de cohorte, la constelación se recompone: cada
// estrella crece o mengua desde su brillo en la cohorte anterior y el anillo
// del foco se desplaza de su caja anterior a la nueva. Es un cambio de
// lectura (qué 8 se lee), no un evento del eje: lleva data-transicion.
//
// [X] decidir VG (abierto en este mundo):
// - las cajas no se rotulan con los HITOS del 8 (idea, aprendizaje…): se
//   rotulan con su tramo de valores, porque los hitos se leerían como nivel;
// - la forma de la constelación (bóveda simétrica, igual para todas las
//   medidas) y el orden (las de la confluencia, la décupla, las series);
// - en la celda 8 de Mapped solo caben las medidas de la confluencia;
// - recomponer al cambiar de cohorte no es un efecto del catálogo: es lectura;
// - sin base escrita, el cielo calcula al vuelo la cohorte entera (lo que
//   leería del 8 si cada registro tuviera su base al día), no la base que
//   escribiría ahora el registro (bases.calcularBase), que no cuenta lo que
//   cuelga de un hijo sin base.
//
// Sin DOM: las funciones devuelven texto (SVG o HTML) para el navegador y
// para las pruebas de Node.

import {
  medir, unitaria, fundir, estadisticaVacia, bloqueDe, leerBase, situar, clavesDeMedidas,
} from '../src/bases.js';
import { ALCANCES, MEDIDAS as MEDIDAS_CONFLUENCIA, comparables, proyectoDe, cajaDe, etiquetaClave } from '../src/tiempo.js';
import { verEn } from '../src/efectos.js';
import { PV, EPOCA_0 } from '../src/epocas.js';

/** Las tres cohortes (VG, 7-11): hermanos, proyecto, general. Siempre en este orden. */
export const COHORTES = ALCANCES;

/** La constelación de la décupla: cuántos de la cohorte tienen desarrollada cada posición 0–9. */
export const DECUPLA = 'pv';

const X_FORMA = '[X] decidir VG: forma y orden de las constelaciones';
const X_COHORTE = '[X] decidir VG: recomponer al cambiar de cohorte es lectura, no un efecto del catálogo';

/** Nombres del catálogo de efectos vistos desde el cielo (src/efectos.js, mundo 8). */
export const EFECTOS = Object.freeze({
  constelacion: verEn({ tipo: 'escrito' }, 8)?.nombre ?? 'constelación',
  caja: verEn({ tipo: 'sustituir' }, 8)?.nombre ?? 'caja',
});

// ---------- datos ----------

/**
 * El registro cuyo 8 resume una cohorte del foco y qué estadística de su
 * base se lee (la misma regla que bases.situar): hermanos → los hijos del 8
 * del padre; proyecto → el subárbol del 8 del proyecto (tiempo.proyectoDe);
 * general → el subárbol del 8 del génesis. null si el foco no tiene esa
 * cohorte (los hermanos del génesis).
 */
export function registroDeCohorte(eje, foco, cohorte = 'hermanos') {
  if (!COHORTES.includes(cohorte)) throw new Error('cohorte desconocida: ' + cohorte);
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('registro desconocido: ' + foco);
  if (cohorte === 'hermanos') return ev.sobre === null ? null : { registro: ev.sobre, seccion: 'hijos' };
  return { registro: cohorte === 'proyecto' ? proyectoDe(eje, foco).id : eje.genesisId, seccion: 'subarbol' };
}

/**
 * La estadística de una cohorte calculada al vuelo, sin escribirla: mide uno
 * a uno sus registros (tiempo.comparables: los hijos del padre, el subárbol
 * del proyecto o del génesis, sin bases) y los funde con las funciones de
 * las bases (unitaria, fundir), con los cortes de la época o los
 * provisionales: lo mismo que se leería del 8 si cada registro tuviera su
 * base al día. No escribe nada.
 */
export function baseAlVuelo(eje, foco, cohorte = 'hermanos', { epoca = EPOCA_0 } = {}) {
  const lista = comparables(eje, foco, cohorte);
  let est = estadisticaVacia();
  for (const e of lista) est = fundir(est, unitaria(medir(eje, e.id), epoca));
  return { ...est, refs: lista.map((e) => e.id), escrita: false };
}

/** Un bloque con el foco situado en él: lo mismo que hace bases.situar con cada medida. */
function situado(bloque, valor) {
  const k = cajaDe(valor, bloque.cortes);
  const suma = (l) => l.reduce((s, c) => s + c, 0);
  return {
    ...bloque, cortes: [...bloque.cortes], cajas: [...bloque.cajas], foco: valor, caja: k, enCaja: bloque.cajas[k],
    debajo: suma(bloque.cajas.slice(0, k)), encima: suma(bloque.cajas.slice(k + 1)), media: bloque.n ? bloque.suma / bloque.n : null,
  };
}

/** Sitúa las medidas de un registro (bases.medir) en una estadística en memoria, como bases.situar con una escrita. */
export function situarEnEstadistica(est, m, { epoca = EPOCA_0 } = {}) {
  const medidas = {};
  for (const clave of clavesDeMedidas()) medidas[clave] = situado(est.medidas[clave], m[clave]);
  const tokens = {};
  for (const clave of [...new Set([...Object.keys(est.tokens), ...Object.keys(m.tokens)])].sort()) {
    tokens[clave] = { etiqueta: etiquetaClave(clave), ...situado(bloqueDe(est, clave, epoca), m.tokens[clave] ?? 0) };
  }
  const posiciones = est.posiciones.map((p, i) => ({ indice: i, ...p, proporcion: p.comparables / est.n, foco: m.procedencias[i].tiene }));
  return { n: est.n, medidas, tokens, posiciones };
}

/** Tramo de valores de una caja según sus cortes: «0», «4–5», «≥ 42» con cortes enteros; «[a, b)» si no. */
export function rangoDeCaja(cortes, k) {
  if (!cortes.length) return k === 0 ? 'todos' : '—';
  const enteros = cortes.every(Number.isInteger);
  if (k >= cortes.length) return '≥ ' + cortes.at(-1);
  if (k === 0) return enteros && cortes[0] === 1 ? '0' : '< ' + cortes[0];
  const [lo, hi] = [cortes[k - 1], cortes[k]];
  if (!enteros) return '[' + lo + ', ' + hi + ')';
  return lo === hi - 1 ? String(lo) : lo + '–' + (hi - 1);
}

const CORTOS = Object.freeze({
  posiciones: 'posiciones', terminales: 'terminales', escritos: 'escritos', movimientos: 'movimientos', identidades: 'identidades',
  profundidadHilo: 'profundidad', formulasResueltas: 'fórm. resueltas', formulasPendientes: 'fórm. pendientes',
});

/** Nombre legible de una medida, una serie de token o la décupla (largo para la tabla, corto para el cielo). */
export function nombreMedida(medida, { corto = false } = {}) {
  if (medida === DECUPLA) return corto ? 'posiciones por PV' : 'posiciones por PV: cuántos tienen desarrollada cada una';
  const m = MEDIDAS_CONFLUENCIA.find((x) => x.clave === medida);
  if (m) return corto ? CORTOS[medida] ?? medida : m.etiqueta;
  if (/^[TEPR]:./.test(medida)) {
    if (!corto) return etiquetaClave(medida);
    const [familia, serie] = [medida[0], medida.slice(2)];
    const s = familia === 'P' && /^[0-9a-f]{64}$/.test(serie) ? serie.slice(0, 8) : serie;
    return familia + ':' + (s.length > 12 ? s.slice(0, 11) + '…' : s);
  }
  return medida;
}

/** Grupo de una constelación: 0 las medidas de la confluencia, 1 la décupla, 2 las series de token. */
function grupoDe(medida) {
  return medida === DECUPLA ? 1 : clavesDeMedidas().includes(medida) ? 0 : 2;
}

/**
 * Lo que dibuja el cielo de un foco en una cohorte. Lee la base escrita en el
 * 8 que resume la cohorte (bases.leerBase y bases.situar); si ese 8 no tiene
 * base, la calcula al vuelo (baseAlVuelo) y lo dice: escrita = false. No
 * escribe. Devuelve { cohorte, foco, estado: 'RESUELTO' | 'SIN COHORTE',
 * motivo?, registro, seccion, escrita, base: { id, autor, t, n, anteriores,
 * frescura }, incluido, cambiadas, medidas }, con las medidas en el orden
 * del cielo: las de la confluencia (tipo 'caja': n, cajas, cortes, valor,
 * caja, enCaja, debajo, encima, minimo, maximo, media), la décupla (tipo
 * 'pv': cajas = cuántos tienen cada posición, focoEn) y las series de token.
 */
export function datosCielo(eje, foco, { cohorte = 'hermanos', epoca = EPOCA_0 } = {}) {
  const c = registroDeCohorte(eje, foco, cohorte);
  if (!c) {
    return { cohorte, foco, estado: 'SIN COHORTE', motivo: 'el génesis no tiene padre', registro: null, seccion: null, escrita: false, base: null, incluido: null, cambiadas: [], medidas: [] };
  }
  const escrita = leerBase(eje, c.registro);
  let s;
  let base;
  let incluido;
  let cambiadas = [];
  if (escrita) {
    s = situar(eje, foco, { alcance: cohorte, epoca });
    incluido = s.incluido;
    cambiadas = s.cambiadas;
    base = { id: escrita.id, autor: escrita.autor, t: escrita.t, n: s.n, anteriores: escrita.anteriores, frescura: escrita.frescura };
  } else {
    const est = baseAlVuelo(eje, foco, cohorte, { epoca });
    s = situarEnEstadistica(est, medir(eje, foco), { epoca });
    incluido = est.refs.includes(foco);
    base = { id: null, autor: null, t: null, n: est.n, anteriores: 0, frescura: null };
  }
  // Sin el hito que da situar: el cielo rotula las cajas con su tramo de valores, no con niveles.
  const deCaja = (medida, x) => ({
    medida, tipo: 'caja', n: x.n, cajas: [...x.cajas], cortes: [...x.cortes], valor: x.foco, caja: x.caja, enCaja: x.enCaja,
    debajo: x.debajo, encima: x.encima, minimo: x.minimo, maximo: x.maximo, media: x.media,
  });
  const decupla = {
    medida: DECUPLA, tipo: 'pv', n: s.n, cajas: s.posiciones.map((p) => p.comparables), focoEn: s.posiciones.map((p) => Boolean(p.foco)),
    valor: s.posiciones.filter((p) => p.foco).length,
  };
  const medidas = [
    ...clavesDeMedidas().map((k) => deCaja(k, s.medidas[k])),
    decupla,
    ...Object.keys(s.tokens).sort().map((k) => deCaja(k, s.tokens[k])),
  ];
  return { cohorte, foco, estado: 'RESUELTO', registro: c.registro, seccion: c.seccion, escrita: Boolean(escrita), base, incluido, cambiadas, medidas };
}

// ---------- render: SVG como texto ----------

function escapar(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const n1 = (x) => Math.round(x * 10) / 10;
const n2 = (x) => Math.round(x * 100) / 100;
const corto = (id) => String(id).slice(0, 8);

const W = 400;

// Columnas por grupo: las medidas de la confluencia, la décupla (a lo ancho) y las series de token.
function geometria(compacto) {
  return compacto
    ? { W: 200, columnas: [2, 1, 2], alto: [30, 30, 30], arriba: 2, margen: [9, 9, 9], cima: 9, amplitud: 5, rmax: 3, rotulo: false }
    : { W, columnas: [4, 1, 4], alto: [52, 62, 52], arriba: 4, margen: [8, 24, 8], cima: 16, amplitud: 7, rmax: 3.6, rotulo: true };
}

/** Posición de la estrella de la caja k en una constelación de ancho cw con esquina (x0, y0): una bóveda simétrica. */
function estrella(g, x0, y0, cw, margen, k) {
  const x = x0 + margen + (k * (cw - 2 * margen)) / 9;
  const y = y0 + g.cima + g.amplitud * (1 - Math.sin((Math.PI * k) / 9));
  return { x, y };
}

/** Radio y opacidad de una estrella: el área y la opacidad crecen con la fracción de la cohorte en esa caja. */
export function brillo(cuenta, n, rmax = 3.6) {
  if (!(cuenta > 0) || !(n > 0)) return { r: 0.7, o: 0.28, encendida: false };
  const f = Math.min(1, cuenta / n);
  return { r: Math.max(0.9, rmax * Math.sqrt(f)), o: 0.35 + 0.65 * f, encendida: true };
}

/** Qué medidas caben: en la celda de Mapped, solo las de la confluencia. */
function visibles(datos, compacto) {
  return compacto ? datos.medidas.filter((m) => grupoDe(m.medida) === 0) : datos.medidas;
}

/** Filas del cielo: cada grupo empieza fila, con sus columnas y su alto. */
function maquetar(medidas, g) {
  const celdas = [];
  let y = g.arriba;
  let col = 0;
  let anterior = null;
  for (const m of medidas) {
    const gr = grupoDe(m.medida);
    if (anterior !== null && (gr !== anterior || col === g.columnas[anterior])) { y += g.alto[anterior]; col = 0; }
    const cw = g.W / g.columnas[gr];
    celdas.push({ m, x0: col * cw, y0: y, cw, ch: g.alto[gr], margen: g.margen[gr] });
    col += 1;
    anterior = gr;
  }
  return { celdas, alto: anterior === null ? 0 : y + g.alto[anterior] - g.arriba };
}

/** Lo que dice una estrella al pasar por encima. */
function tituloEstrella(m, k, cuenta, n) {
  if (m.tipo === 'pv') return `${k} ${PV[k]}: ${cuenta} de ${n} la tienen desarrollada${m.focoEn[k] ? '; el foco también' : ''}`;
  return `${nombreMedida(m.medida)} · caja ${k} (${rangoDeCaja(m.cortes, k)}) · ${cuenta} de ${n}`;
}

/** El anillo del foco en una caja (o en una posición de la décupla). */
function anillo(g, p, titulo, estilo = '') {
  return `<g class="foco-cielo" data-efecto="${escapar(EFECTOS.caja)}" data-mundo="8"${estilo}><title>${escapar(titulo)}</title><circle class="anillo" cx="${n1(p.x)}" cy="${n1(p.y)}" r="${n1(g.rmax + 2)}"/></g>`;
}

/**
 * El SVG del cielo, como texto. Función pura: no toca el DOM ni el eje.
 *   datos: lo que devuelve datosCielo().
 *   compacto: para la celda 8 de Mapped (las medidas de la confluencia, sin rótulos).
 *   anterior: datosCielo() del mismo foco en la cohorte que se deja; si se da,
 *     cada estrella y el anillo del foco se recomponen desde allí.
 */
export function svgCielo(datos, { compacto = false, anterior = null } = {}) {
  const g = geometria(compacto);
  const medidas = visibles(datos, compacto);
  const previas = anterior && anterior.foco === datos.foco && anterior.cohorte !== datos.cohorte && anterior.estado === 'RESUELTO'
    ? new Map(anterior.medidas.map((m) => [m.medida, m])) : null;
  const n = datos.base?.n ?? 0;
  const { celdas, alto } = maquetar(medidas, g);
  const H = compacto ? 124 : Math.max(60, g.arriba + alto + 4);
  const partes = [];
  for (const { m, x0, y0, cw, ch, margen } of celdas) {
    const previa = previas?.get(m.medida);
    const nPrev = previa?.n ?? anterior?.base?.n ?? 0;
    const pos = Array.from({ length: 10 }, (_, k) => estrella(g, x0, y0, cw, margen, k));
    const estrellas = m.cajas.map((cuenta, k) => {
      const b = brillo(cuenta, n, g.rmax);
      const { x, y } = pos[k];
      let estilo = '';
      if (previas) {
        const a = brillo(previa?.cajas[k] ?? 0, nPrev, g.rmax);
        estilo = ` style="--s0:${n2(a.r / b.r)};--o0:${n2(Math.min(1, a.o / b.o))}"`;
      }
      const halo = b.encendida ? `<circle class="halo" cx="${n1(x)}" cy="${n1(y)}" r="${n1(b.r * 2.3)}" opacity="${n2(b.o * 0.35)}"/>` : '';
      return `<g class="estrella${b.encendida ? ' encendida' : ' hueco'}" data-caja="${k}" data-cuenta="${cuenta}"${estilo}><title>${escapar(tituloEstrella(m, k, cuenta, n))}</title>${halo}<circle class="astro" cx="${n1(x)}" cy="${n1(y)}" r="${n1(b.r)}" opacity="${n2(b.o)}"/></g>`;
    });
    const encendidas = pos.filter((_, k) => m.cajas[k] > 0);
    const trazo = encendidas.length > 1 ? `<path class="trazo" d="${encendidas.map((p, i) => (i ? 'L' : 'M') + n1(p.x) + ' ' + n1(p.y)).join(' ')}"/>` : '';
    let anillos;
    if (m.tipo === 'pv') {
      // La décupla: el foco tiene o no cada posición; un anillo en cada una que tiene.
      anillos = m.focoEn.map((tiene, k) => (tiene ? anillo(g, pos[k], `el foco tiene desarrollada la ${k} ${PV[k]} · ${m.cajas[k]} de ${n} en la cohorte`) : '')).join('');
    } else {
      let estiloFoco = '';
      if (previa) {
        const p0 = pos[previa.caja];
        estiloFoco = ` style="--dx0:${n1(p0.x - pos[m.caja].x)}px;--dy0:${n1(p0.y - pos[m.caja].y)}px"`;
      }
      const dentro = `${m.enCaja} en su caja` + (m.enCaja ? '' : ' (la base no lo mide así)');
      anillos = anillo(g, pos[m.caja], `foco: ${m.valor} · caja ${m.caja} (${rangoDeCaja(m.cortes, m.caja)}) · ${m.debajo} debajo, ${dentro}, ${m.encima} encima · sin nivel ni grado`, estiloFoco);
    }
    let rotulo = '';
    if (g.rotulo) {
      const valor = m.tipo === 'pv' ? `el foco tiene ${m.valor} de 10` : `foco ${m.valor}`;
      rotulo = `<text class="rotulo-medida" x="${n1(x0 + cw / 2)}" y="${n1(y0 + ch - 9)}">${escapar(nombreMedida(m.medida, { corto: true }))}</text><text class="rotulo-valor" x="${n1(x0 + cw / 2)}" y="${n1(y0 + ch - 1)}">${escapar(valor)}</text>`;
      if (m.tipo === 'pv') rotulo += pos.map((p, k) => `<text class="rotulo-pv" x="${n1(p.x)}" y="${n1(p.y + 12)}">${k} ${escapar(PV[k].slice(0, 5))}</text>`).join('');
    }
    partes.push(`<g class="constelacion${m.tipo === 'pv' ? ' decupla' : ''}" data-medida="${escapar(m.medida)}" data-efecto="${escapar(EFECTOS.constelacion)}" data-mundo="8" data-decision="${X_FORMA}">${trazo}${estrellas.join('')}${anillos}${rotulo}</g>`);
  }
  const clases = ['cielo', compacto ? 'compacto' : '', datos.escrita ? 'escrita' : 'sin-escribir', previas ? 'recompone' : ''].filter(Boolean).join(' ');
  const etiqueta = datos.estado !== 'RESUELTO'
    ? `Cielo sin cohorte (${datos.cohorte}): ${datos.motivo}`
    : `Cielo de ${corto(datos.foco)} entre ${datos.cohorte}: ${n} registros, ${medidas.length} constelaciones${datos.escrita ? '' : ', base sin escribir'}`;
  const vacio = datos.estado !== 'RESUELTO'
    ? `<text class="rotulo-vacio" x="${g.W / 2}" y="${H / 2}">${compacto ? 'sin cohorte' : escapar('sin cohorte: ' + datos.motivo)}</text>` : '';
  const evento = datos.base?.id ? ` data-evento="${escapar(datos.base.id)}"` : '';
  const transicion = previas ? ` data-transicion="cohorte" data-decision="${X_COHORTE}"` : '';
  return `<svg class="${clases}" viewBox="0 0 ${g.W} ${H}" role="img" aria-label="${escapar(etiqueta)}" data-cohorte="${escapar(datos.cohorte)}" data-escrita="${datos.escrita}"${evento}${transicion} xmlns="http://www.w3.org/2000/svg">`
    + `<rect class="fondo-cielo" x="0" y="0" width="${g.W}" height="${H}" rx="${compacto ? 6 : 10}"/>${vacio}${partes.join('')}</svg>`;
}

// ---------- vistas ----------

function fechaCorta(t) {
  return t ? t.replace('T', ' ').slice(5, 16) : '';
}

/** El selector de cohorte: siempre en el orden de COHORTES, sin ordenar ni puntuar. */
export function selectorCohorte(actual) {
  return `<div class="cohortes" role="group" aria-label="cohorte">${COHORTES.map((c) => `<button class="cohorte" data-cohorte="${c}" aria-pressed="${c === actual}">${c}</button>`).join('')}</div>`;
}

const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);

/** Línea de estado de la base: escrita (quién, cuándo, frescura) o «sin escribir». */
export function estadoBase(datos) {
  if (datos.estado !== 'RESUELTO') return `<span class="sin-cohorte">sin cohorte: ${escapar(datos.motivo)}</span>`;
  const b = datos.base;
  const que = datos.seccion === 'hijos' ? 'los hijos' : 'el subárbol';
  const donde = `${que} del 8 de <button class="enlace" data-ir="${escapar(datos.registro)}">${corto(datos.registro)}</button>`;
  if (!datos.escrita) return `<span class="marca-sin-escribir">sin escribir</span> calculada al vuelo sobre ${plural(b.n, 'registro', 'registros')}: ${donde} no tiene base`;
  const f = b.frescura;
  const novedades = [
    f?.hijosNuevos ? plural(f.hijosNuevos, 'hijo nuevo', 'hijos nuevos') : '',
    f?.basesNuevas ? plural(f.basesNuevas, 'base más reciente', 'bases más recientes') : '',
    f?.debajo ? plural(f.debajo, 'novedad más abajo', 'novedades más abajo') : '',
  ].filter(Boolean).join(' · ');
  const fresca = f?.sinNovedades ? 'sin novedades' : novedades;
  const fuera = datos.incluido === false ? ' · el foco no está medido en ella' : '';
  const cambiadas = datos.cambiadas.length ? ' · el foco ha cambiado desde entonces en ' + plural(datos.cambiadas.length, 'medida', 'medidas') : '';
  return `base <button class="enlace" data-ir="${escapar(b.id)}">${corto(b.id)}</button> escrita por ${escapar(b.autor)} el ${fechaCorta(b.t)}: ${donde} · n ${b.n} · ${fresca}${b.anteriores ? ' · ' + plural(b.anteriores, 'anterior', 'anteriores') : ''}${fuera}${cambiadas}`;
}

/** La vista del cielo (render animado): selector, estado de la base, el SVG y una leyenda. */
export function htmlCielo(datos, { anterior = null } = {}) {
  return `<figure class="cielo-vista">${selectorCohorte(datos.cohorte)}<figcaption class="cielo-estado">${estadoBase(datos)}</figcaption>`
    + svgCielo(datos, { anterior })
    + '<div class="cielo-leyenda"><span class="ley-estrella">una estrella por caja: su brillo es cuántos registros caen en ella</span><span class="ley-foco">el foco, en su caja</span><span>sin nivel ni grado: más estrellas no es mejor</span></div></figure>';
}

/** Render sobrio del mismo cielo: por medida, el valor del foco, su caja y cuántos quedan debajo, en ella y encima. */
export function htmlCieloSobrio(datos) {
  const fila = (m) => {
    if (m.tipo === 'pv') {
      const lista = m.cajas.map((c, k) => `${k} ${PV[k]} ${c}/${m.n}${m.focoEn[k] ? ' ●' : ''}`).join(' · ');
      return `<div class="medida-fila"><span class="medida-nombre">${escapar(nombreMedida(m.medida))}</span><span class="medida-valor">el foco tiene <b>${m.valor}</b> de 10 (●)</span><span class="medida-cohorte">${escapar(lista)}</span></div>`;
    }
    return `<div class="medida-fila"><span class="medida-nombre">${escapar(nombreMedida(m.medida))}</span>`
      + `<span class="medida-valor">foco <b>${escapar(m.valor)}</b> · caja ${m.caja} (${escapar(rangoDeCaja(m.cortes, m.caja))})</span>`
      + `<span class="medida-cohorte">${m.debajo} debajo · ${m.enCaja} en su caja · ${m.encima} encima · mín ${m.minimo ?? '—'} · máx ${m.maximo ?? '—'} · media ${m.media === null ? '—' : n2(m.media)}</span></div>`;
  };
  return `<section class="cielo-sobrio">${selectorCohorte(datos.cohorte)}<div class="cielo-estado">${estadoBase(datos)}</div>`
    + (datos.estado === 'RESUELTO' ? `<div class="medidas-cielo">${datos.medidas.map(fila).join('')}</div><div class="pista">sin nivel ni grado: las cajas son tramos de valores</div>` : '') + '</section>';
}
