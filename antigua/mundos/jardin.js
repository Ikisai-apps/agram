// Mundo del jardín (PV2, jardín/terrario/bosque de los criterios): tercera
// pieza de la X (mapa §12 [D]).
//
// Qué se ve: los OCUPANTES de la posición 2 del foco (bajo el camino), cada
// uno una PLANTA, con su vector de encaje (src/encaje.js): las colisiones son
// el estado normal de una posición y no se borran (mapa §12 [D]), así que
// cada ocupante crece aunque coincida con otro.
// - HIERBA: encaje exacto (las diez profundidades de acuerdo);
// - ARBUSTO: acuerdo parcial (llega por referencia a otra dirección);
// - FLOR: el ocupante fue ELEGIDO en una consolidación del foco (la
//   consolidación guarda el encaje de cada fuente elegida, src/motor.js);
// - FRUTO: esa consolidación se EJECUTÓ.
// El jardín no es un ranking (corpus V3 PV2): las plantas van en el orden
// del encaje, que no puntúa.
//
// Qué se anima, solo si el evento es nuevo para quien mira:
// - BROTE: un ocupante nuevo crece desde el suelo (lo escrito en la posición
//   2, o el foco mismo con lo que alcanza por referencia);
// - la flor se abre cuando la consolidación que lo elige es nueva;
// - el fruto cuaja cuando la propuesta se cierra: con el registro nuevo que la
//   cierra (encargo 3b: no hay paso de ejecutar; cada parte registra su
//   movimiento y la plantilla de cerrado del dueño lo lee).
//
// [X] decidir VG (abierto en este mundo):
// - hierba = exacto y arbusto = acuerdo parcial: el corpus da «hierbas:
//   criterios abundantes y superficiales; arbustos: familias» sin decir
//   cómo se reconoce cada uno;
// - el catálogo (PR #45) llama «fructificar» a consolidar visto desde el
//   jardín y no nombra el cierre en él. Aquí la elección se dibuja como flor
//   y el cierre como fruto; cada una lleva el nombre que el catálogo da a SU
//   operación (la flor, «fructificar»; el fruto, el genérico de la fase
//   «ejecutado» del catálogo, que es lo que el cierre sustituye) y su marca;
// - un ocupante propio que es una referencia y lo que alcanza son dos
//   plantas (colisión), y la flor va a las dos si la consolidación eligió
//   ese lugar.

import { ARIDAD } from '../../src/btml.js';
import { ocupantes } from '../../src/encaje.js';
import { propuestas, cierre } from '../../src/motor.js';
import { escapar, n1, corto, recorte, nombreEn, ritmo, atributos, ordenPlano, textoCorto } from './comun.js';

const X_FORMA = '[X] decidir VG: hierba = encaje exacto, arbusto = acuerdo parcial (el corpus no dice cómo se reconoce cada uno)';
const X_FLOR = '[X] decidir VG: el catálogo (PR #45) llama «fructificar» a consolidar visto desde el jardín; aquí esa consolidación se dibuja como flor sobre lo elegido';
const X_FRUTO = '[X] decidir VG: el catálogo (PR #45) no nombra el cierre en el jardín; aquí la propuesta cerrada se dibuja como fruto';
const conMarca = (efecto, marca) => ({ ...efecto, decision: [marca, efecto.decision].filter(Boolean).join(' · ') });

/** Forma de una planta por su encaje: hierba si es exacto, arbusto si el acuerdo es parcial. */
export function formaDe(acuerdo) {
  return acuerdo === ARIDAD ? 'hierba' : 'arbusto';
}

/** El evento que trae un ocupante al jardín: lo escrito, él mismo; lo propio y lo alcanzado, el foco que lo lleva. */
function traido(o, foco) {
  return o.tipo === 'escrito' ? o.evento : foco;
}

/**
 * Lo que dibuja el jardín de un foco (bajo `camino`): una planta por
 * ocupante de la posición 2, con su forma, su encaje y las flores y frutos
 * que le dieron las propuestas del foco (la flor, la elección; el fruto, el cierre). No escribe nada.
 */
export function datosJardin(eje, foco, { camino = [], maximo = 8 } = {}) {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  const indices = [...camino, 2];
  const elegidas = propuestas(eje, foco, camino).map((c) => {
    const reg = eje.obtener(c.id);
    // Cerrada, el fruto es el registro que mueve lo anunciado (motor.cierre), o ella misma si no anunciaba nada.
    const fruto = c.cerrado === true ? (cierre(eje, c.id)?.id ?? c.id) : null;
    return { ...c, titulo: textoCorto(c.titulo), encaje: (reg.contexto?.encaje ?? []).filter((e) => e.posicion === 2), ejecucion: fruto };
  });
  const todas = ocupantes(eje, foco, indices).map((o) => {
    const origen = o.origenDir ?? o.dir;
    const flores = elegidas.filter((c) => c.encaje.some((e) => e.evento === o.evento && (e.origen ?? '0000000000') === origen));
    return {
      evento: o.evento, traido: traido(o, foco), tipo: o.tipo, camino: o.camino ?? [], autor: o.autor ?? eje.obtener(o.evento)?.autor ?? null,
      texto: o.rota ? 'referencia rota' : textoCorto(o.contenido), rota: Boolean(o.rota),
      acuerdo: o.acuerdo, vector: o.vector, signo: o.signo, forma: formaDe(o.acuerdo),
      flores: flores.map((c) => ({ consolidacion: c.id, autor: c.autor, titulo: c.titulo })),
      frutos: flores.filter((c) => c.ejecucion).map((c) => ({ consolidacion: c.id, ejecucion: c.ejecucion })),
    };
  });
  return {
    foco, camino: [...camino], plantas: todas.slice(0, maximo), masPlantas: Math.max(0, todas.length - maximo),
    efectos: {
      brote: nombreEn({ tipo: 'escrito' }, 2),
      flor: conMarca(nombreEn({ tipo: 'fase', fase: 'consolidado' }, 2), X_FLOR),
      fruto: conMarca(nombreEn({ tipo: 'fase', fase: 'ejecutado' }, 2), X_FRUTO),
    },
    decisionForma: X_FORMA,
    orden: ordenPlano(eje),
  };
}

// ---------- render ----------

function geometria(compacto) {
  return compacto
    ? { W: 120, H: 96, suelo: 76, x0: 14, x1: 106, escala: 0.55, etiquetas: false, max: 5 }
    : { W: 400, H: 156, suelo: 112, x0: 36, x1: 364, escala: 1.3, etiquetas: true, max: 8 };
}

function hierba(s) {
  const hojas = [[-7, -22, -11, -30], [-3, -30, -4, -40], [2, -34, 1, -44], [6, -28, 9, -36], [9, -18, 13, -24]];
  return hojas.map(([cx, cy, x, y]) => `<path class="x-brizna" d="M0 0Q${n1(cx * s)} ${n1(cy * s)} ${n1(x * s)} ${n1(y * s)}"/>`).join('');
}

function arbusto(s) {
  return `<path class="x-tallo" d="M0 0V${n1(-12 * s)}"/>`
    + [[-9, -18, 9], [8, -19, 9], [0, -28, 11], [-3, -16, 8], [5, -12, 7]].map(([x, y, rr]) => `<circle class="x-copa" cx="${n1(x * s)}" cy="${n1(y * s)}" r="${n1(rr * s)}"/>`).join('');
}

function flor(s) {
  const p = [0, 1, 2, 3, 4].map((a) => {
    const ang = (Math.PI * 2 * a) / 5 - Math.PI / 2;
    return `<circle class="x-petalo" cx="${n1(Math.cos(ang) * 4.2 * s)}" cy="${n1(Math.sin(ang) * 4.2 * s)}" r="${n1(3.4 * s)}"/>`;
  }).join('');
  return p + `<circle class="x-corola" r="${n1(2.4 * s)}"/>`;
}

/**
 * El SVG del jardín, como texto. Función pura.
 *   datos: lo que devuelve datosJardin().
 *   compacto: sin rótulos, para la celda 2 de Mapped.
 *   nuevos: Set de ids de evento que se animan.
 */
export function svgJardin(datos, { compacto = false, nuevos = new Set() } = {}) {
  const g = geometria(compacto);
  const r = ritmo(datos.orden, nuevos);
  const plantas = datos.plantas.slice(0, g.max);
  const s = g.escala;
  const capas = { suelo: [], plantas: [] };
  capas.suelo.push(`<rect class="x-tierra" x="0" y="${g.suelo}" width="${g.W}" height="${compacto ? 6 : 10}"/>`);
  capas.suelo.push(`<line class="x-suelo" x1="0" y1="${g.suelo}" x2="${g.W}" y2="${g.suelo}"/>`);
  if (g.etiquetas) capas.suelo.push(`<text class="x-rotulo x-titulo" x="8" y="12">2 criterios del foco · ${datos.plantas.length + datos.masPlantas} ocupantes</text>`);
  const xDe = (n) => (plantas.length === 1 ? (g.x0 + g.x1) / 2 : g.x0 + (n * (g.x1 - g.x0)) / (plantas.length - 1));

  plantas.forEach((p, n) => {
    const x = xDe(n);
    const nueva = r.es(p.traido);
    const alto = p.forma === 'hierba' ? 44 : 38;
    let cuerpo = p.forma === 'hierba' ? hierba(s) : arbusto(s);
    // Flores y frutos: cada uno sale de su evento real.
    p.flores.slice(0, 2).forEach((f, k) => {
      const abre = r.es(f.consolidacion);
      const fx = (k === 0 ? 0 : 9) * s;
      const fy = -(alto + 2 - k * 10) * s;
      cuerpo += `<g transform="translate(${n1(fx)} ${n1(fy)})"><g class="x-flor${abre ? ' x-nuevo x-abre-flor' : ''}" ${atributos(f.consolidacion, datos.efectos.flor, 2, abre ? ` style="${r.estilo(f.consolidacion, 0.3)}"` : '')}>`
        + `<title>${escapar(`flor: elegido en «${f.titulo}» por ${f.autor} · ${corto(f.consolidacion)}`)}</title>${flor(s)}</g></g>`;
    });
    p.frutos.slice(0, 2).forEach((f, k) => {
      const cuaja = r.es(f.ejecucion);
      const fx = (k === 0 ? -8 : 10) * s;
      const fy = -(alto - 14) * s;
      cuerpo += `<g transform="translate(${n1(fx)} ${n1(fy)})"><g class="x-fruto${cuaja ? ' x-nuevo x-cuaja' : ''}" ${atributos(f.ejecucion, datos.efectos.fruto, 2, cuaja ? ` style="${r.estilo(f.ejecucion, 0.3)}"` : '')}>`
        + `<title>${escapar(`fruto: la propuesta ${corto(f.consolidacion)} está cerrada · ${corto(f.ejecucion)}`)}</title><circle r="${n1(3.6 * s)}"/></g></g>`;
    });
    const encaje = p.acuerdo === 10 ? 'encaje exacto' : `${p.acuerdo} de 10 profundidades de acuerdo`;
    const titulo = `${p.forma}: ${p.texto} · ${p.tipo}${p.camino.length ? ' ' + p.camino.join('.') : ''} · ${encaje} · ${corto(p.evento)}`;
    const rotulo = g.etiquetas
      ? `<text class="x-rotulo x-planta-texto" y="${16}">${escapar(recorte(p.texto, 11))}</text><text class="x-rotulo x-planta-origen" y="27">${escapar(p.tipo + (p.acuerdo === 10 ? '' : ' · ' + p.acuerdo + '/10'))}</text>`
      : '';
    capas.plantas.push(`<g transform="translate(${n1(x)} ${g.suelo})"><g class="x-planta x-${p.forma}${p.rota ? ' x-rota' : ''}" data-ir="${escapar(p.evento)}" data-forma="${p.forma}" data-decision-forma="${escapar(datos.decisionForma)}">`
      + `<title>${escapar(titulo)}</title><rect class="x-toque" x="${n1(-14 * s)}" y="${n1(-(alto + 8) * s)}" width="${n1(28 * s)}" height="${n1((alto + 8) * s)}"/>`
      + `<g class="x-crece${nueva ? ' x-nuevo x-brota' : ''}" ${nueva ? atributos(p.traido, datos.efectos.brote, 2, ` style="${r.estilo(p.traido)}"`) : ''}>${cuerpo}</g>${rotulo}</g></g>`);
  });
  if (!plantas.length && g.etiquetas) capas.plantas.push(`<text class="x-rotulo x-nada" x="${g.W / 2}" y="${g.suelo - 30}">sin criterios en la posición 2</text>`);
  const mas = datos.masPlantas + datos.plantas.length - plantas.length;
  if (mas) capas.plantas.push(`<text class="x-rotulo x-mas" x="${g.W - 4}" y="${g.suelo - 4}" text-anchor="end">+${mas}</text>`);

  const flores = datos.plantas.filter((p) => p.flores.length).length;
  const frutos = datos.plantas.filter((p) => p.frutos.length).length;
  const etiqueta = `Jardín: ${datos.plantas.length + datos.masPlantas} plantas en la posición 2 (${datos.plantas.filter((p) => p.forma === 'hierba').length} hierbas, ${datos.plantas.filter((p) => p.forma === 'arbusto').length} arbustos), ${flores} con flor y ${frutos} con fruto`;
  return `<svg class="mundo mundo-jardin${compacto ? ' compacto' : ''}" viewBox="0 0 ${g.W} ${g.H}" role="img" aria-label="${escapar(etiqueta)}" data-mundo="2" xmlns="http://www.w3.org/2000/svg">`
    + `<g class="x-capa-suelo">${capas.suelo.join('')}</g><g class="x-capa-plantas">${capas.plantas.join('')}</g></svg>`;
}

/** Render sobrio de la misma lectura. */
export function lineasJardin(datos) {
  if (!datos.plantas.length) return ['sin criterios en la posición 2'];
  const out = datos.plantas.map((p) => `${p.forma} · ${p.texto} · ${p.tipo}${p.acuerdo === 10 ? ' · exacto' : ' · acuerdo ' + p.acuerdo + '/10'}`
    + (p.flores.length ? ' · flor (' + p.flores.map((f) => f.titulo).join(', ') + ')' : '') + (p.frutos.length ? ' · fruto' : ''));
  if (datos.masPlantas) out.push(`+${datos.masPlantas} plantas más`);
  return out;
}
