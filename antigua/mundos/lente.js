// Lente 0 (PV0, terminal y representación libre): la última pieza de la X
// (mapa §12 [D]), en el centro del tetraedro A, sobre el 5.
//
// Qué se ve: la PORTADA del foco, su representación libre: la posición 0
// bajo el camino (o el terminal, si el foco lo es), tal como la quiere su
// autor: una palabra, una cifra, una fórmula ya resuelta o un HTML. El corpus
// es claro: «PV0 no promete verdad»; la portada lo dice al pie. Detrás, en
// pila, las otras portadas: lo que otros han escrito en la posición 0 del
// foco (ocupantes escritos: corregir es añadir, nada sustituye en sitio).
//
// Qué se anima, solo si el evento es nuevo para quien mira:
// - la portada del foco aparece cuando el foco es nuevo («mostrar»);
// - una portada escrita por otro se apila detrás cuando su registro es nuevo.
//
// HTML: si la representación es HTML, el SVG enseña su texto sin etiquetas y
// la vista X la pinta aparte en un iframe sin permisos (sandbox vacío: sin
// scripts, sin formularios, sin el origen de la página).
//
// [X] decidir VG (abierto en este mundo):
// - una referencia en la posición 0 se sigue hasta lo que alcanza (la
//   portada es lo que alcanza, como lee el encaje);
// - las portadas de otros van detrás de la del foco, nunca delante: la
//   lente es del autor del foco y quien mira puede elegir otra (pendiente).

import { esReferencia } from '../../src/btml.js';
import { ocupantes, seguir } from '../../src/encaje.js';
import { esFormula, evaluar, desescapar } from '../../src/bql.js';
import { escapar, n1, corto, partir, baseDe, nombreEn, ritmo, atributos, ordenPlano, textoCorto } from './comun.js';

/** Si un texto es HTML: empieza por una etiqueta y acaba en otra. */
export function esHTML(texto) {
  return typeof texto === 'string' && /^\s*<([a-z][a-z0-9-]*|!doctype)[\s\S]*>\s*$/i.test(texto);
}

/** El texto de un HTML sin etiquetas (para el SVG y para leer). */
export function textoPlano(html) {
  return String(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function representacion(eje, foco, indices, contenido) {
  if (contenido === undefined) return { texto: '', vacia: true };
  if (esReferencia(contenido)) {
    const s = seguir(eje, contenido);
    if (s.rota) return { texto: 'referencia rota: ' + corto(contenido.ref), referencia: contenido.ref };
    return { ...representacion(eje, s.evento, s.camino, s.contenido), referencia: contenido.ref };
  }
  if (Array.isArray(contenido)) return representacion(eje, foco, [...indices, 0], contenido[0]);
  if (esFormula(contenido)) {
    const r = evaluar(eje, foco, indices);
    return { texto: r.estado === 'RESUELTO' ? r.texto : String(contenido), formula: String(contenido), estado: r.estado };
  }
  const t = desescapar(String(contenido));
  return esHTML(t) ? { texto: textoPlano(t), html: t } : { texto: t };
}

/**
 * Lo que dibuja la lente de un foco (bajo `camino`): su portada (la posición
 * 0, o el terminal) y las portadas que otros escribieron en su posición 0.
 * No escribe nada.
 */
export function datosLente(eje, foco, { camino = [], maximo = 3 } = {}) {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  const base = baseDe(ev.payload, camino);
  const terminal = !Array.isArray(base);
  const indices = terminal ? [...camino] : [...camino, 0];
  const portada = representacion(eje, foco, indices, terminal ? base : base[0]);
  const otras = ocupantes(eje, foco, [...camino, 0]).filter((o) => o.tipo === 'escrito').map((o) => ({
    evento: o.evento, autor: o.autor, t: o.t, texto: textoCorto(o.contenido),
  }));
  return {
    foco, camino: [...camino], autor: ev.autor, t: ev.t, terminal, ...portada,
    otras: otras.slice(-maximo), masOtras: Math.max(0, otras.length - maximo),
    efecto: nombreEn({ tipo: 'escrito' }, 0),
    orden: ordenPlano(eje),
  };
}

// ---------- render ----------

function geometria(compacto) {
  return compacto
    ? { W: 120, H: 96, x: 34, y: 4, w: 52, h: 86, ancho: 9, lineas: 4, letra: 8.5, interlinea: 10, titulo0: 24, pila: 5, etiquetas: false }
    : { W: 400, H: 236, x: 114, y: 8, w: 172, h: 218, ancho: 15, lineas: 6, letra: 16, interlinea: 20, titulo0: 66, pila: 9, etiquetas: true };
}

/**
 * El SVG de la lente, como texto. Función pura.
 *   datos: lo que devuelve datosLente().
 *   compacto: para la celda central (0 sobre 5) de Mapped.
 *   nuevos: Set de ids de evento que se animan.
 */
export function svgLente(datos, { compacto = false, nuevos = new Set() } = {}) {
  const g = geometria(compacto);
  const r = ritmo(datos.orden, nuevos);
  const capas = { pila: [], portada: [] };

  // La pila: las portadas de otros, detrás y desplazadas.
  datos.otras.forEach((o, n) => {
    const k = datos.otras.length - n;
    const nueva = r.es(o.evento);
    capas.pila.push(`<g transform="translate(${n1(g.x + k * g.pila)} ${n1(g.y + k * (g.pila * 0.4))})"><g class="x-otra${nueva ? ' x-nuevo x-apila' : ''}" data-ir="${escapar(o.evento)}" ${atributos(o.evento, datos.efecto, 0, nueva ? ` style="${r.estilo(o.evento)}"` : '')}>`
      + `<title>${escapar(`otra portada, de ${o.autor}: ${o.texto} · ${corto(o.evento)}`)}</title><rect class="x-hoja" width="${g.w}" height="${g.h}" rx="3"/></g></g>`);
  });

  const lineas = datos.vacia ? [] : partir(datos.texto, g.ancho, g.lineas);
  const nuevo = r.es(datos.foco);
  const titulo = lineas.map((l, n) => `<text class="x-titular" x="${g.w / 2}" y="${g.titulo0 + n * g.interlinea}" style="font-size:${g.letra}px">${escapar(l)}</text>`).join('');
  const pie = g.etiquetas
    ? `<text class="x-rotulo x-cabecera" x="${g.w / 2}" y="20">AGRAM · 0 lente</text>`
      + `<line class="x-filete" x1="14" y1="28" x2="${g.w - 14}" y2="28"/>`
      + `<text class="x-rotulo x-firma" x="${g.w / 2}" y="${g.h - 26}">${escapar(datos.autor + ' · ' + String(datos.t).slice(0, 10))}</text>`
      + `<text class="x-rotulo x-verdad" x="${g.w / 2}" y="${g.h - 12}">PV0 no promete verdad</text>`
    : `<line class="x-filete" x1="6" y1="12" x2="${g.w - 6}" y2="12"/>`;
  const marcas = (datos.html ? `<text class="x-rotulo x-sello" x="${g.w - 8}" y="${compacto ? 9 : 44}" text-anchor="end">HTML</text>` : '')
    + (datos.formula ? `<text class="x-rotulo x-sello" x="${g.w - 8}" y="${compacto ? 9 : 44}" text-anchor="end">= ${escapar(String(datos.estado ?? '').toLowerCase())}</text>` : '')
    + (datos.referencia ? `<text class="x-rotulo x-sello" x="8" y="${compacto ? 9 : 44}" text-anchor="start">→ ${escapar(corto(datos.referencia))}</text>` : '');
  const vacia = datos.vacia ? `<text class="x-rotulo x-nada" x="${g.w / 2}" y="${g.h / 2}">sin representación</text>` : '';
  const desc = `portada de ${corto(datos.foco)} por ${datos.autor}: ${datos.vacia ? 'sin representación' : datos.texto}${datos.html ? ' (HTML)' : ''}`;
  capas.portada.push(`<g transform="translate(${g.x} ${g.y})"><g class="x-portada${nuevo ? ' x-nuevo x-muestra' : ''}" ${atributos(datos.foco, datos.efecto, 0, nuevo ? ` style="${r.estilo(datos.foco)}"` : '')}>`
    + `<title>${escapar(desc)}</title><rect class="x-hoja x-frente" width="${g.w}" height="${g.h}" rx="3"/>${pie}${marcas}${titulo}${vacia}</g></g>`);
  if (datos.masOtras && g.etiquetas) capas.pila.push(`<text class="x-rotulo x-mas" x="${g.W - 6}" y="${g.H - 6}" text-anchor="end">+${datos.masOtras} portadas</text>`);

  const etiqueta = `Lente 0: ${datos.vacia ? 'sin representación' : '«' + datos.texto + '»'}${datos.otras.length ? `; ${datos.otras.length + datos.masOtras} portadas más de otros` : ''}`;
  return `<svg class="mundo mundo-lente${compacto ? ' compacto' : ''}" viewBox="0 0 ${g.W} ${g.H}" role="img" aria-label="${escapar(etiqueta)}" data-mundo="0" xmlns="http://www.w3.org/2000/svg">`
    + `<g class="x-capa-pila">${capas.pila.join('')}</g><g class="x-capa-portada">${capas.portada.join('')}</g></svg>`;
}

/** El HTML de la portada, si lo es, en un iframe sin permisos. Solo para la vista X. */
export function marcoHTML(datos) {
  if (!datos.html) return '';
  return `<iframe class="x-marco" sandbox="" referrerpolicy="no-referrer" title="representación HTML del foco (sin scripts)" srcdoc="${escapar(datos.html)}"></iframe>`;
}

/** Render sobrio de la misma lectura. */
export function lineasLente(datos) {
  const out = [(datos.vacia ? 'sin representación' : '«' + datos.texto + '»') + ' · ' + datos.autor + (datos.html ? ' · HTML' : '') + (datos.formula ? ' · ' + datos.formula : '')];
  for (const o of datos.otras) out.push(`otra portada de ${o.autor}: ${o.texto}`);
  out.push('PV0 no promete verdad');
  return out;
}
