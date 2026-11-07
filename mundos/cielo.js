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
// - una constelación por medida: diez estrellas, una por caja, en el orden de
//   los valores (de la caja 0 a la 9), sobre una bóveda simétrica (ni sube ni
//   baja: el orden de las cajas es de valores, no de grados);
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
//   medidas) y el orden de las medidas (las del registro, la décupla de
//   posiciones, las series de tokens);
// - en la celda 8 de Mapped solo caben las seis medidas del registro;
// - recomponer al cambiar de cohorte no es un efecto del catálogo: es lectura.
//
// Sin DOM: las funciones devuelven texto (SVG o HTML) para el navegador y
// para las pruebas de Node.

import {
  COHORTES, MEDIDAS_PV, MEDIDAS_REGISTRO, MOVIMIENTOS, cortesDe, caja, medir, baseVacia, baseUnitaria, fundir,
  bloqueDe, hijos, leerBase, situar, proyectoDe,
} from '../src/bases.js';
import { verEn } from '../src/efectos.js';
import { PV } from '../src/epocas.js';

export { COHORTES };

const X_FORMA = '[X] decidir VG: forma y orden de las constelaciones';
const X_COHORTE = '[X] decidir VG: recomponer al cambiar de cohorte es lectura, no un efecto del catálogo';

/** Nombres del catálogo de efectos vistos desde el cielo (src/efectos.js, mundo 8). */
export const EFECTOS = Object.freeze({
  constelacion: verEn({ tipo: 'escrito' }, 8)?.nombre ?? 'constelación',
  caja: verEn({ tipo: 'sustituir' }, 8)?.nombre ?? 'caja',
});

// ---------- datos ----------

/**
 * El registro cuyo 8 resume una cohorte del foco y la distancia del foco a
 * él (la misma regla que bases.situar): hermanos → el padre; proyecto → el
 * registro del hilo que cuelga del génesis; general → el génesis. null si el
 * foco no tiene esa cohorte (el génesis, o un proyecto en «proyecto»).
 */
export function registroDeCohorte(eje, foco, cohorte = 'hermanos') {
  if (!COHORTES.includes(cohorte)) throw new Error('cohorte desconocida: ' + cohorte);
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('registro desconocido: ' + foco);
  const hilo = eje.hilo(foco).map((e) => e.id);
  const registro = cohorte === 'hermanos' ? ev.sobre : cohorte === 'general' ? eje.genesisId : proyectoDe(eje, foco);
  if (registro === null) return null;
  const profundidad = hilo.indexOf(registro);
  return profundidad >= 1 ? { registro, profundidad } : null;
}

/**
 * Base de una cohorte calculada al vuelo, sin escribirla: mide uno a uno los
 * registros que están `profundidad` generaciones por debajo de `registro`
 * (sin bases) y los funde. Para profundidad 1 es baseDe(eje, registro).
 * No escribe nada: la base que sale no está en ningún 8.
 */
export function baseAlVuelo(eje, registro, profundidad = 1) {
  if (!eje.obtener(registro)) throw new Error('registro desconocido: ' + registro);
  if (!(Number.isInteger(profundidad) && profundidad >= 1)) throw new Error('profundidad >= 1');
  let nivel = [registro];
  for (let p = 0; p < profundidad; p++) nivel = nivel.flatMap((id) => hijos(eje, id).map((e) => e.id));
  let base = baseVacia();
  for (const id of nivel) base = fundir(base, baseUnitaria(medir(eje, id)));
  return { ...base, profundidad, desde: 'al vuelo', registro, refs: nivel, escrita: false };
}

/** Lo mismo que hace bases.situar con una base escrita, para una base en memoria. */
export function situarEnBase(base, valores) {
  const series = [...new Set([...Object.keys(base.medidas), ...Object.keys(valores)].filter((m) => m.startsWith(MOVIMIENTOS)))].sort();
  const medidas = {};
  const suma = (l) => l.reduce((s, c) => s + c, 0);
  for (const m of [...MEDIDAS_PV, ...MEDIDAS_REGISTRO, ...series]) {
    const b = bloqueDe(base, m);
    const valor = valores[m] ?? 0;
    const k = caja(m, valor);
    medidas[m] = {
      valor, caja: k, enCaja: b.cajas[k], debajo: suma(b.cajas.slice(0, k)), encima: suma(b.cajas.slice(k + 1)),
      minimo: b.minimo, maximo: b.maximo, media: base.n ? b.suma / base.n : 0,
    };
  }
  return medidas;
}

/** Tramo de valores de una caja: «0», «4–5», «≥ 42». Los valores medidos son recuentos (enteros ≥ 0). */
export function rangoDeCaja(medida, k) {
  const c = cortesDe(medida);
  const lo = k === 0 ? 0 : c[k - 1];
  if (k >= c.length) return '≥ ' + lo;
  const hi = c[k] - 1;
  return lo === hi ? String(lo) : lo + '–' + hi;
}

/** Nombre legible de una medida (largo para la tabla, corto para el cielo). */
export function nombreMedida(medida, { corto = false } = {}) {
  if (medida.startsWith('posiciones.')) {
    const k = Number(medida.slice('posiciones.'.length));
    return corto ? 'en ' + k + ' ' + PV[k].slice(0, 6) : 'posiciones en ' + k + ' ' + PV[k];
  }
  if (medida.startsWith(MOVIMIENTOS)) {
    const clave = medida.slice(MOVIMIENTOS.length);
    const [familia, serie] = [clave.slice(0, 1), clave.slice(2)];
    const s = familia === 'P' && /^[0-9a-f]{64}$/.test(serie) ? serie.slice(0, 8) : serie;
    return (corto ? 'mov. ' : 'movimientos ') + familia + ':' + (corto && s.length > 9 ? s.slice(0, 8) + '…' : s);
  }
  const nombres = {
    posiciones: ['posiciones', 'posiciones'], escritos: ['escritos encima', 'escritos'], identidades: ['identidades', 'identidades'],
    profundidad: ['profundidad del hilo', 'profundidad'], 'formulas.resueltas': ['fórmulas resueltas', 'fórm. resueltas'],
    'formulas.pendientes': ['fórmulas pendientes', 'fórm. pendientes'],
  };
  return nombres[medida]?.[corto ? 1 : 0] ?? medida;
}

/** Orden fijo de las medidas en el cielo: las del registro, la décupla de posiciones y las series (por clave). */
export function ordenMedidas(nombres) {
  const series = nombres.filter((m) => m.startsWith(MOVIMIENTOS)).sort();
  return [...MEDIDAS_REGISTRO, ...MEDIDAS_PV, ...series];
}

/**
 * Lo que dibuja el cielo de un foco en una cohorte. Lee la base escrita en el
 * 8 que resume la cohorte (bases.leerBase y bases.situar); si no hay, la
 * calcula al vuelo (baseAlVuelo) y lo dice: escrita = false. No escribe.
 * Devuelve { cohorte, foco, estado: 'RESUELTO' | 'SIN COHORTE', motivo?,
 * registro, profundidad, escrita, base: { id, autor, t, n, desde, anteriores,
 * frescura, refs }, incluido, medidas: [{ medida, cajas, valor, caja, enCaja,
 * debajo, encima, minimo, maximo, media }] }.
 */
export function datosCielo(eje, foco, { cohorte = 'hermanos' } = {}) {
  const c = registroDeCohorte(eje, foco, cohorte);
  if (!c) {
    const motivo = cohorte === 'hermanos' ? 'el génesis no tiene padre' : cohorte === 'proyecto'
      ? (eje.obtener(foco).sobre === null ? 'el génesis no tiene proyecto' : 'el foco es el propio proyecto') : 'el génesis es el propio ámbito';
    return { cohorte, foco, estado: 'SIN COHORTE', motivo, registro: null, profundidad: 0, escrita: false, base: null, incluido: null, medidas: [] };
  }
  const { registro, profundidad } = c;
  const escrita = leerBase(eje, registro, { profundidad });
  let base;
  let situadas;
  let incluido;
  if (escrita) {
    const s = situar(eje, foco, { cohorte });
    situadas = s.medidas;
    incluido = s.incluido;
    base = escrita;
  } else {
    base = baseAlVuelo(eje, registro, profundidad);
    situadas = situarEnBase(base, medir(eje, foco));
    incluido = base.refs.includes(foco);
  }
  // Sin la etiqueta de HITOS que da situar: el cielo rotula las cajas con su tramo de valores, no con niveles.
  const medidas = ordenMedidas(Object.keys(situadas)).map((m) => {
    const { etiqueta, ...situada } = situadas[m];
    return { medida: m, cajas: [...bloqueDe(base, m).cajas], ...situada };
  });
  return {
    cohorte, foco, estado: 'RESUELTO', registro, profundidad, escrita: Boolean(escrita),
    base: {
      id: escrita?.id ?? null, autor: escrita?.autor ?? null, t: escrita?.t ?? null, n: base.n, desde: base.desde,
      anteriores: escrita?.anteriores ?? 0, frescura: escrita?.frescura ?? null, refs: base.refs.length,
    },
    incluido, medidas,
  };
}

// ---------- render: SVG como texto ----------

function escapar(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const n1 = (x) => Math.round(x * 10) / 10;
const n2 = (x) => Math.round(x * 100) / 100;
const corto = (id) => String(id).slice(0, 8);

const W = 400;

function geometria(compacto) {
  return compacto
    ? { W: 200, columnas: [2, 2, 2], ch: 40, arriba: 2, margen: 9, cima: 13, amplitud: 6, rmax: 3.2, rotulo: false }
    : { W, columnas: [3, 5, 5], ch: 52, arriba: 4, margen: 7, cima: 16, amplitud: 7, rmax: 3.6, rotulo: true };
}

/** Posición de la estrella de la caja k en una constelación de ancho cw con esquina (x0, y0): una bóveda simétrica. */
function estrella(g, x0, y0, cw, k) {
  const x = x0 + g.margen + (k * (cw - 2 * g.margen)) / 9;
  const y = y0 + g.cima + g.amplitud * (1 - Math.sin((Math.PI * k) / 9));
  return { x, y };
}

/** Radio y opacidad de una estrella: el área y la opacidad crecen con la fracción de la cohorte en esa caja. */
export function brillo(cuenta, n, rmax = 3.6) {
  if (!(cuenta > 0) || !(n > 0)) return { r: 0.7, o: 0.28, encendida: false };
  const f = Math.min(1, cuenta / n);
  return { r: Math.max(0.9, rmax * Math.sqrt(f)), o: 0.35 + 0.65 * f, encendida: true };
}

/** Qué medidas caben: en la celda de Mapped, solo las del registro. */
function visibles(datos, compacto) {
  return compacto ? datos.medidas.filter((m) => MEDIDAS_REGISTRO.includes(m.medida)) : datos.medidas;
}

/** Filas del cielo: cada grupo (las seis del registro, la décupla de posiciones, las series) empieza fila, con sus columnas. */
function maquetar(medidas, g) {
  const grupo = (m) => (MEDIDAS_REGISTRO.includes(m) ? 0 : MEDIDAS_PV.includes(m) ? 1 : 2);
  const celdas = [];
  let fila = 0;
  let col = 0;
  let anterior = null;
  for (const m of medidas) {
    const gr = grupo(m.medida);
    if (anterior !== null && (gr !== anterior || col === g.columnas[anterior])) { fila += 1; col = 0; }
    const cw = g.W / g.columnas[gr];
    celdas.push({ m, x0: col * cw, y0: g.arriba + fila * g.ch, cw });
    col += 1;
    anterior = gr;
  }
  return { celdas, filas: medidas.length ? fila + 1 : 0 };
}

/**
 * El SVG del cielo, como texto. Función pura: no toca el DOM ni el eje.
 *   datos: lo que devuelve datosCielo().
 *   compacto: para la celda 8 de Mapped (las seis medidas del registro, sin rótulos).
 *   anterior: datosCielo() del mismo foco en la cohorte que se deja; si se da,
 *     cada estrella y el anillo del foco se recomponen desde allí.
 */
export function svgCielo(datos, { compacto = false, anterior = null } = {}) {
  const g = geometria(compacto);
  const medidas = visibles(datos, compacto);
  const previas = anterior && anterior.foco === datos.foco && anterior.cohorte !== datos.cohorte && anterior.estado === 'RESUELTO'
    ? new Map(anterior.medidas.map((m) => [m.medida, m])) : null;
  const n = datos.base?.n ?? 0;
  const { celdas, filas } = maquetar(medidas, g);
  const H = compacto ? 124 : Math.max(60, g.arriba + filas * g.ch + 4);
  const partes = [];
  for (const { m, x0, y0, cw } of celdas) {
    const previa = previas?.get(m.medida);
    const nPrev = anterior?.base?.n ?? 0;
    const pos = Array.from({ length: 10 }, (_, k) => estrella(g, x0, y0, cw, k));
    const estrellas = m.cajas.map((cuenta, k) => {
      const b = brillo(cuenta, n, g.rmax);
      const { x, y } = pos[k];
      let estilo = '';
      if (previas) {
        const a = brillo(previa?.cajas[k] ?? 0, nPrev, g.rmax);
        estilo = ` style="--s0:${n2(a.r / b.r)};--o0:${n2(Math.min(1, a.o / b.o))}"`;
      }
      const titulo = `${nombreMedida(m.medida)} · caja ${k} (${rangoDeCaja(m.medida, k)}) · ${cuenta} de ${n}`;
      const halo = b.encendida ? `<circle class="halo" cx="${n1(x)}" cy="${n1(y)}" r="${n1(b.r * 2.3)}" opacity="${n2(b.o * 0.35)}"/>` : '';
      return `<g class="estrella${b.encendida ? ' encendida' : ' hueco'}" data-caja="${k}" data-cuenta="${cuenta}"${estilo}><title>${escapar(titulo)}</title>${halo}<circle class="astro" cx="${n1(x)}" cy="${n1(y)}" r="${n1(b.r)}" opacity="${n2(b.o)}"/></g>`;
    });
    const encendidas = pos.filter((_, k) => m.cajas[k] > 0);
    const trazo = encendidas.length > 1 ? `<path class="trazo" d="${encendidas.map((p, i) => (i ? 'L' : 'M') + n1(p.x) + ' ' + n1(p.y)).join(' ')}"/>` : '';
    const f = pos[m.caja];
    let estiloFoco = '';
    if (previa) {
      const p0 = pos[previa.caja];
      estiloFoco = ` style="--dx0:${n1(p0.x - f.x)}px;--dy0:${n1(p0.y - f.y)}px"`;
    }
    const dentro = `${m.enCaja} en su caja` + (m.enCaja ? '' : ' (el foco no está medido en esta base)');
    const anillo = `<g class="foco-cielo" data-efecto="${escapar(EFECTOS.caja)}" data-mundo="8"${estiloFoco}><title>${escapar(`foco: ${m.valor} · caja ${m.caja} (${rangoDeCaja(m.medida, m.caja)}) · ${m.debajo} debajo, ${dentro}, ${m.encima} encima · sin nivel ni grado`)}</title><circle class="anillo" cx="${n1(f.x)}" cy="${n1(f.y)}" r="${n1(g.rmax + 2)}"/></g>`;
    const rotulo = g.rotulo ? `<text class="rotulo-medida" x="${n1(x0 + cw / 2)}" y="${n1(y0 + g.ch - 9)}">${escapar(nombreMedida(m.medida, { corto: true }))}</text><text class="rotulo-valor" x="${n1(x0 + cw / 2)}" y="${n1(y0 + g.ch - 1)}">foco ${escapar(m.valor)}</text>` : '';
    partes.push(`<g class="constelacion" data-medida="${escapar(m.medida)}" data-efecto="${escapar(EFECTOS.constelacion)}" data-mundo="8" data-decision="${X_FORMA}">${trazo}${estrellas.join('')}${anillo}${rotulo}</g>`);
  }
  const clases = ['cielo', compacto ? 'compacto' : '', datos.escrita ? 'escrita' : 'sin-escribir', previas ? 'recompone' : ''].filter(Boolean).join(' ');
  const etiqueta = datos.estado !== 'RESUELTO'
    ? `Cielo sin cohorte (${datos.cohorte}): ${datos.motivo}`
    : `Cielo de ${corto(datos.foco)} entre ${datos.cohorte}: ${n} registros, ${medidas.length} medidas${datos.escrita ? '' : ', base sin escribir'}`;
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

/** Línea de estado de la base: escrita (quién, cuándo, frescura) o «sin escribir». */
export function estadoBase(datos) {
  if (datos.estado !== 'RESUELTO') return `<span class="sin-cohorte">sin cohorte: ${escapar(datos.motivo)}</span>`;
  const b = datos.base;
  const donde = `8 de <button class="enlace" data-ir="${escapar(datos.registro)}">${corto(datos.registro)}</button> · profundidad ${datos.profundidad}`;
  if (!datos.escrita) return `<span class="marca-sin-escribir">sin escribir</span> base calculada al vuelo sobre ${b.n} registro${b.n === 1 ? '' : 's'}: no está en el ${donde}`;
  const f = b.frescura;
  const fresca = f?.alDia ? 'al día' : [f?.hijosNuevos ? f.hijosNuevos + ' nuevo' + (f.hijosNuevos === 1 ? '' : 's') + ' desde entonces' : '', f?.basesNuevas ? f.basesNuevas + ' base' + (f.basesNuevas === 1 ? '' : 's') + ' más reciente' + (f.basesNuevas === 1 ? '' : 's') : ''].filter(Boolean).join(' · ');
  const fuera = datos.incluido === false ? ' · el foco no está medido en ella' : '';
  return `base <button class="enlace" data-ir="${escapar(b.id)}">${corto(b.id)}</button> escrita por ${escapar(b.autor)} el ${fechaCorta(b.t)} en el ${donde} · n ${b.n} · ${fresca}${b.anteriores ? ' · ' + b.anteriores + ' anterior' + (b.anteriores === 1 ? '' : 'es') : ''}${fuera}`;
}

/** La vista del cielo (render animado): selector, estado de la base, el SVG y una leyenda. */
export function htmlCielo(datos, { anterior = null } = {}) {
  return `<figure class="cielo-vista">${selectorCohorte(datos.cohorte)}<figcaption class="cielo-estado">${estadoBase(datos)}</figcaption>`
    + svgCielo(datos, { anterior })
    + '<div class="cielo-leyenda"><span class="ley-estrella">una estrella por caja: su brillo es cuántos registros caen en ella</span><span class="ley-foco">el foco, en su caja</span><span>sin nivel ni grado: más estrellas no es mejor</span></div></figure>';
}

/** Render sobrio del mismo cielo: por medida, el valor del foco, su caja y cuántos quedan debajo, en ella y encima. */
export function htmlCieloSobrio(datos) {
  const filas = datos.medidas.map((m) => `<div class="medida-fila"><span class="medida-nombre">${escapar(nombreMedida(m.medida))}</span>`
    + `<span class="medida-valor">foco <b>${escapar(m.valor)}</b> · caja ${m.caja} (${escapar(rangoDeCaja(m.medida, m.caja))})</span>`
    + `<span class="medida-cohorte">${m.debajo} debajo · ${m.enCaja} en su caja · ${m.encima} encima · mín ${m.minimo ?? '—'} · máx ${m.maximo ?? '—'} · media ${n2(m.media)}</span></div>`).join('');
  return `<section class="cielo-sobrio">${selectorCohorte(datos.cohorte)}<div class="cielo-estado">${estadoBase(datos)}</div>`
    + (datos.estado === 'RESUELTO' ? `<div class="medidas-cielo">${filas}</div><div class="pista">sin nivel ni grado: las cajas son tramos de valores</div>` : '') + '</section>';
}
