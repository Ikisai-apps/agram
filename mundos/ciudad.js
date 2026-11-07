// Mundo de la ciudad (PV1, reino/ciudad de los recursos): segunda pieza de la
// X (mapa §12 [D]).
//
// Qué se ve:
// - la MANZANA del foco: la posición 1 (recursos) bajo el camino, con una
//   TIENDA por subposición (1.0 … 1.9). Una tienda que es una referencia
//   apunta a otra (alcanzada, no copiada); una fórmula enseña su resultado;
// - los otros OCUPANTES de la posición 1 (encaje): lo escrito ahí por otros
//   (tiendas que alguien abre) y lo alcanzado por referencia (almacenes de
//   otro registro);
// - las VÍAS: una por serie de tokens E que mueven el foco, lo escrito sobre
//   él y sus ocupantes de 1 (VG, 7-11: E es una serie limitada que emite quien
//   respalda el recurso); las CASAS son las identidades que la recorren y la
//   PUERTA (∅) es por donde entra lo emitido y sale lo consumido.
//
// Qué se anima, solo si el evento es nuevo para quien mira:
// - un movimiento de E es MERCANCÍA que fluye por su vía de la casa de `de`
//   a la de `a` (catálogo: «mercancía que fluye»);
// - la emisión de una serie ABRE su vía: se traza desde la puerta («abrir
//   vía»);
// - lo escrito en la posición 1 por otro levanta una tienda («abrir tienda»);
// - una vía se CIERRA cuando su emisor ya lo ha dado todo: no le queda nada
//   de la serie que dar (en Booking, la plaza de esa noche se entregó: una
//   venta, no un fallo; otra reserva solapada ya no se ejecutaría). Cae la
//   barrera cuando es nuevo el movimiento que dejó al emisor a cero.
//
// [X] decidir VG (abierto en este mundo):
// - «vía cerrada» = el emisor ya no tiene nada de su serie que dar. El catálogo (PR
//   #45) dice que ninguna operación cierra una vía todavía; aquí es un estado
//   que se lee del eje, no una operación;
// - qué series son «del foco»: las que mueven el foco, lo escrito sobre él
//   (en cualquier profundidad) y sus ocupantes de la posición 1;
// - consumir E no tiene nombre en la ciudad (sale por la puerta).

import { claveToken } from '../src/tokens.js';
import { esReferencia, esLista } from '../src/btml.js';
import { ocupantes } from '../src/encaje.js';
import { esFormula, evaluar, desescapar } from '../src/bql.js';
import {
  escapar, n1, corto, recorte, baseDe, descendientes, nombreEn, sinOperacion, ritmo, atributos, ordenPlano, textoCorto,
} from './comun.js';

/** Denominación legible: los ids de 64 cifras se acortan a 8 (las plazas de Booking llevan el id de su habitación). */
export function etiquetaSerie(denominacion) {
  return String(denominacion).replace(/[0-9a-f]{64}/g, (id) => id.slice(0, 8));
}

/** El evento que dejó a cero el saldo del emisor en una serie: el último movimiento suyo de esa serie. */
function cierreDe(eje, clave, emisor) {
  for (let n = eje.orden.length - 1; n >= 0; n--) {
    const ev = eje.obtener(eje.orden[n]);
    if (ev.movimientos.some((m) => m.token === 'E' && m.de === emisor && claveToken(m) === clave)) return ev.id;
  }
  return null;
}

function tienda(eje, foco, indices, contenido, j) {
  if (contenido === undefined) return { j, vacia: true };
  // Por hojas (VG, 7-11 noche): una lista de uno (el 0 envuelto de una décupla) es su único ocupante.
  if (esLista(contenido) && contenido.length === 1) return tienda(eje, foco, indices, contenido[0], j);
  if (esReferencia(contenido)) return { j, tipo: 'referencia', texto: '→ ' + corto(contenido.ref), ref: contenido.ref, dir: contenido.dir ?? null };
  if (Array.isArray(contenido)) return { j, tipo: 'propio', texto: textoCorto(contenido) };
  if (esFormula(contenido)) {
    const r = evaluar(eje, foco, indices);
    return { j, tipo: 'formula', texto: r.estado === 'RESUELTO' ? r.texto : r.estado, formula: String(contenido) };
  }
  return { j, tipo: 'propio', texto: desescapar(String(contenido)) };
}

/**
 * Lo que dibuja la ciudad de un foco (bajo `camino`): la manzana de la
 * posición 1, los otros ocupantes de 1 y las vías de las series E con sus
 * movimientos, sus titulares y su estado. No escribe nada.
 */
export function datosCiudad(eje, foco, { camino = [], maximoVias = 6, maximoCasas = 6 } = {}) {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  const base = baseDe(ev.payload, camino);
  const uno = Array.isArray(base) ? base[1] : undefined;
  const indices = [...camino, 1];
  const tiendas = Array.isArray(uno)
    ? Array.from({ length: 10 }, (_, j) => tienda(eje, foco, [...indices, j], uno[j], j))
    : uno !== undefined ? [tienda(eje, foco, indices, uno, 0)] : [];

  const otros = ocupantes(eje, foco, indices).filter((o) => o.tipo !== 'propio').map((o) => ({
    tipo: o.tipo, evento: o.evento, autor: o.autor ?? eje.obtener(o.evento)?.autor ?? null,
    texto: o.rota ? 'referencia rota' : textoCorto(o.contenido), rota: Boolean(o.rota), acuerdo: o.acuerdo,
  }));

  // Los eventos de la ciudad: el foco, lo escrito sobre él y sus ocupantes de 1.
  const alcance = new Map([[ev.id, ev]]);
  for (const h of descendientes(eje, foco, 200)) alcance.set(h.id, h);
  for (const o of otros) { const e = eje.obtener(o.evento); if (e) alcance.set(e.id, e); }
  const orden = ordenPlano(eje);
  const eventos = [...alcance.values()].sort((a, b) => orden[a.id] - orden[b.id]);

  const series = new Map();
  for (const e of eventos) {
    for (const m of e.movimientos) {
      if (m.token !== 'E') continue;
      const clave = claveToken(m);
      if (!series.has(clave)) series.set(clave, { clave, emisor: m.emisor, denominacion: m.denominacion, movimientos: [] });
      series.get(clave).movimientos.push({ evento: e.id, de: m.de, a: m.a, cantidad: m.cantidad, movimiento: m.de === null ? 'emitir' : m.a === null ? 'consumir' : 'mover' });
    }
  }
  const ultima = (v) => Math.max(...v.movimientos.map((m) => orden[m.evento]));
  const todas = [...series.values()].sort((a, b) => ultima(b) - ultima(a));
  const vias = todas.slice(0, maximoVias).map((v) => {
    const saldoEmisor = eje.saldo(v.emisor, v.clave);
    const abierta = saldoEmisor > 0;
    const titulares = eje.identidades().map((id) => ({ id, cantidad: eje.saldo(id, v.clave) })).filter((x) => x.cantidad > 0);
    return {
      ...v, etiqueta: etiquetaSerie(v.denominacion), emitido: eje.serie(v.clave).emitido, saldoEmisor, abierta, titulares,
      cierre: abierta ? null : cierreDe(eje, v.clave, v.emisor),
    };
  });

  // Las casas: quienes aparecen en las vías dibujadas, en orden de aparición.
  const casas = [];
  const anotar = (id) => { if (id && !casas.includes(id)) casas.push(id); };
  for (const v of vias) {
    anotar(v.emisor);
    for (const m of v.movimientos) { anotar(m.de); anotar(m.a); }
  }

  return {
    foco, camino: [...camino], tiendas, otros, vias, masVias: Math.max(0, todas.length - vias.length),
    casas: casas.slice(0, maximoCasas), masCasas: Math.max(0, casas.length - maximoCasas),
    efectos: {
      abrirTienda: nombreEn({ tipo: 'escrito' }, 1),
      alcanzado: nombreEn({ tipo: 'ver' }, 1),
      emitir: nombreEn({ tipo: 'token', movimiento: 'emitir', token: 'E' }, 1),
      mover: nombreEn({ tipo: 'token', movimiento: 'mover', token: 'E' }, 1),
      consumir: nombreEn({ tipo: 'token', movimiento: 'consumir', token: 'E' }, 1),
      cerrar: { nombre: 'cerrar vía', decision: (sinOperacion(1, 'cerrar vía')?.nota ?? '[X] decidir VG: qué operación cierra una vía.') + ' Aquí, el emisor ya no tiene nada de su serie que dar.' },
    },
    orden,
  };
}

// ---------- render ----------

function geometria(compacto, nVias) {
  if (compacto) return { W: 120, H: 96, manzana: [5, 3, 20.4, 16, 2.5], calle: 52, via0: 61, via: 12, puerta: 5, x1: 117, etiquetas: false, otros: null, maxVias: 3 };
  return { W: 400, H: 132 + Math.max(2, nVias) * 28, manzana: [8, 16, 34, 30, 4], calle: 112, via0: 140, via: 28, puerta: 22, x1: 394, etiquetas: true, otros: [214, 22, 40, 28], maxVias: 6 };
}

/** Lo último de un texto largo (la noche de una plaza va al final de su denominación). */
function finDe(texto, n) {
  const t = String(texto);
  return t.length > n ? '…' + t.slice(t.length - n + 1) : t;
}

function casaEn(x, y, s) {
  return `<path class="x-casa-dibujo" d="M${n1(x - s)} ${n1(y)}V${n1(y - s)}L${n1(x)} ${n1(y - 1.8 * s)}L${n1(x + s)} ${n1(y - s)}V${n1(y)}Z"/>`;
}

/**
 * El SVG de la ciudad, como texto. Función pura.
 *   datos: lo que devuelve datosCiudad().
 *   compacto: sin rótulos, para la celda 1 de Mapped.
 *   nuevos: Set de ids de evento que se animan.
 */
export function svgCiudad(datos, { compacto = false, nuevos = new Set() } = {}) {
  const vias = datos.vias.slice(0, compacto ? 3 : 6);
  const g = geometria(compacto, vias.length);
  const r = ritmo(datos.orden, nuevos);
  const capas = { manzana: [], otros: [], calle: [], vias: [], mercancia: [] };

  // La manzana: diez solares en dos filas de cinco.
  const [mx, my, lw, lh, gap] = g.manzana;
  if (g.etiquetas) capas.manzana.push(`<text class="x-rotulo x-titulo" x="${mx}" y="10">1 recursos del foco · manzana</text>`);
  const solar = (j) => ({ x: mx + (j % 5) * (lw + gap), y: my + Math.floor(j / 5) * (lh + gap + (g.etiquetas ? 10 : 0)) });
  for (let j = 0; j < 10; j++) {
    const t = datos.tiendas[j];
    const { x, y } = solar(j);
    if (!t || t.vacia) {
      capas.manzana.push(`<rect class="x-solar" x="${x}" y="${y}" width="${lw}" height="${lh}" rx="2"><title>1.${j}: solar vacío</title></rect>`);
      continue;
    }
    const cx = x + lw / 2;
    const titulo = `tienda 1.${j}: ${t.texto}${t.formula ? ' (' + t.formula + ')' : ''}${t.tipo === 'referencia' ? ' · alcanzada por referencia' : ''}`;
    const dibujo = `<rect class="x-tienda x-${t.tipo}" x="${x}" y="${n1(y + lh * 0.35)}" width="${lw}" height="${n1(lh * 0.65)}" rx="1.5"/>`
      + `<path class="x-toldo x-${t.tipo}" d="M${x} ${n1(y + lh * 0.35)}L${n1(x + lw * 0.12)} ${y}H${n1(x + lw * 0.88)}L${x + lw} ${n1(y + lh * 0.35)}Z"/>`;
    const ir = t.ref ? ` data-ir="${escapar(t.ref)}"${t.dir ? ` data-dir="${escapar(t.dir)}"` : ''}` : '';
    capas.manzana.push(`<g class="x-solar-lleno"${ir}><title>${escapar(titulo)}</title>${dibujo}`
      + (g.etiquetas ? `<text class="x-rotulo x-tienda-texto" x="${n1(cx)}" y="${y + lh + 8}">${escapar(recorte(t.texto, 7))}</text>` : '') + '</g>');
  }

  // Los otros ocupantes de 1: tiendas abiertas por otros y almacenes alcanzados.
  if (g.otros) {
    const [ox, oy, ow, oh] = g.otros;
    if (datos.otros.length) capas.otros.push(`<text class="x-rotulo x-titulo" x="${ox}" y="10">ocupantes de 1</text>`);
    datos.otros.slice(0, 4).forEach((o, n) => {
      const x = ox + n * (ow + 4);
      const nuevo = o.tipo === 'escrito' && r.es(o.evento);
      const ef = o.tipo === 'escrito' ? datos.efectos.abrirTienda : datos.efectos.alcanzado;
      const clase = o.tipo === 'escrito' ? 'x-abierta' : 'x-almacen';
      capas.otros.push(`<g transform="translate(${x} ${oy + oh})"><g class="x-edificio ${clase}${o.rota ? ' x-rota' : ''}${nuevo ? ' x-nuevo x-levanta' : ''}" data-ir="${escapar(o.evento)}" ${atributos(o.evento, ef, 1, nuevo ? ` style="${r.estilo(o.evento)}"` : '')}>`
        + `<title>${escapar(`${o.tipo === 'escrito' ? 'tienda abierta por ' + o.autor : 'almacén alcanzado por referencia'} · ${o.texto} · ${corto(o.evento)}`)}</title>`
        + `<rect class="x-fachada" x="0" y="${-oh}" width="${ow}" height="${oh}" rx="2"/>`
        + (o.tipo === 'escrito' ? `<path class="x-toldo x-propio" d="M0 ${-oh}L4 ${-oh - 6}H${ow - 4}L${ow} ${-oh}Z"/>` : `<path class="x-flecha-almacen" d="M8 ${-oh / 2}H${ow - 8}M${ow - 13} ${-oh / 2 - 5}L${ow - 8} ${-oh / 2}L${ow - 13} ${-oh / 2 + 5}"/>`)
        + `<text class="x-rotulo x-tienda-texto" x="${ow / 2}" y="9">${escapar(recorte(o.texto, 8))}</text></g></g>`);
    });
    if (datos.otros.length > 4) capas.otros.push(`<text class="x-rotulo x-mas" x="${g.x1}" y="${oy + oh + 18}" text-anchor="end">+${datos.otros.length - 4}</text>`);
  }

  // La calle: la puerta (∅) y las casas; debajo, una vía por serie.
  const casas = datos.casas.slice(0, compacto ? 4 : 6);
  const xCasa = new Map([[null, g.puerta]]);
  const desde = g.puerta + (compacto ? 16 : 40);
  casas.forEach((id, n) => xCasa.set(id, casas.length === 1 ? (desde + g.x1) / 2 : desde + (n * (g.x1 - 10 - desde)) / (casas.length - 1)));
  const yVia = (n) => g.via0 + n * g.via;
  const yFin = vias.length ? yVia(vias.length - 1) : g.calle;
  capas.calle.push(`<g class="x-puerta"><title>∅: por aquí entra lo emitido y sale lo consumido</title><path d="M${g.puerta - (compacto ? 3 : 7)} ${g.calle + (compacto ? 0 : 2)}V${g.calle - (compacto ? 5 : 12)}Q${g.puerta} ${g.calle - (compacto ? 9 : 20)} ${g.puerta + (compacto ? 3 : 7)} ${g.calle - (compacto ? 5 : 12)}V${g.calle + (compacto ? 0 : 2)}"/>${g.etiquetas ? `<text class="x-rotulo" x="${g.puerta}" y="${g.calle + 12}">∅</text>` : ''}</g>`);
  for (const [id, x] of xCasa) {
    if (id === null) continue;
    capas.calle.push(`<line class="x-acera" x1="${n1(x)}" y1="${g.calle}" x2="${n1(x)}" y2="${yFin + (compacto ? 3 : 6)}"/>`);
    capas.calle.push(`<g class="x-casa"><title>${escapar('casa de ' + id)}</title>${casaEn(x, g.calle, compacto ? 3 : 7)}`
      + (g.etiquetas ? `<text class="x-rotulo" x="${n1(x)}" y="${g.calle - 16}">${escapar(recorte(id, 10))}</text>` : '') + '</g>');
  }

  vias.forEach((v, n) => {
    const y = yVia(n);
    const estado = v.abierta ? 'abierta' : 'cerrada';
    const emision = v.movimientos.find((m) => m.movimiento === 'emitir');
    const abre = emision && r.es(emision.evento);
    const desc = `vía ${v.clave}: ${v.emitido} emitidos por ${v.emisor}; ${v.emisor} tiene ${v.saldoEmisor} · ${estado}${v.titulares.length ? ' · titulares: ' + v.titulares.map((t) => t.id + ' ' + t.cantidad).join(', ') : ''}`;
    capas.vias.push(`<g class="x-via x-${estado}${abre ? ' x-nuevo x-abre' : ''}" data-serie="${escapar(v.clave)}" ${abre ? atributos(emision.evento, datos.efectos.emitir, 1, ` style="${r.estilo(emision.evento)}"`) : ''}>`
      + `<title>${escapar(desc)}</title><line class="x-carril" pathLength="1" x1="${g.puerta}" y1="${y}" x2="${g.x1}" y2="${y}"/>`
      + (g.etiquetas ? `<text class="x-rotulo x-via-nombre" x="${g.puerta + 10}" y="${y - 8}">${escapar(finDe(v.etiqueta, 26) + ' · ' + v.emisor + (v.abierta ? '' : ' · cerrada'))}</text>` : '') + '</g>');
    // Quién tiene tokens de la serie: una moneda por titular dibujado.
    for (const t of v.titulares) {
      if (!xCasa.has(t.id)) continue;
      capas.vias.push(`<circle class="x-moneda" cx="${n1(xCasa.get(t.id))}" cy="${y}" r="${compacto ? 1.8 : 3.4}"><title>${escapar(t.id + ' tiene ' + t.cantidad + ' de ' + v.clave)}</title></circle>`);
    }
    if (!v.abierta && xCasa.has(v.emisor)) {
      const x = xCasa.get(v.emisor);
      const cae = v.cierre && r.es(v.cierre);
      const s = compacto ? 3 : 5;
      capas.vias.push(`<g transform="translate(${n1(x)} ${y})"><g class="x-barrera${cae ? ' x-nuevo x-cae' : ''}" ${v.cierre ? atributos(v.cierre, datos.efectos.cerrar, 1, cae ? ` style="${r.estilo(v.cierre, 0.9)}"` : '') : ''}>`
        + `<title>${escapar('vía cerrada: ' + v.emisor + ' ya dio todo lo que emitió de ' + v.etiqueta + '; no le queda nada que dar')}</title><path d="M${-s} ${-s}L${s} ${s}M${s} ${-s}L${-s} ${s}"/></g></g>`);
    }
    // Mercancía: cada movimiento de un evento nuevo, de la casa de `de` a la de `a`.
    v.movimientos.forEach((m, k) => {
      if (!r.es(m.evento) || !xCasa.has(m.de) || !xCasa.has(m.a)) return;
      const x0 = xCasa.get(m.de);
      const dx = xCasa.get(m.a) - x0;
      const ef = datos.efectos[m.movimiento];
      const w = compacto ? 4 : 9;
      capas.mercancia.push(`<g transform="translate(${n1(x0)} ${y})"><g class="x-mercancia x-nuevo" ${atributos(m.evento, ef, 1, ` data-de="${escapar(m.de ?? '∅')}" data-a="${escapar(m.a ?? '∅')}" style="--dx:${n1(dx)}px;${r.estilo(m.evento, 0.35 + k * 0.15)}"`)}>`
        + `<rect x="${-w / 2}" y="${-w * 0.75}" width="${w}" height="${n1(w * 0.75)}" rx="1"/>`
        + (g.etiquetas ? `<text class="x-rotulo x-carga" y="${-w - 1}">${escapar(String(m.cantidad))}</text>` : '') + '</g></g>');
    });
  });
  if (!vias.length && g.etiquetas) capas.vias.push(`<text class="x-rotulo x-nada" x="${g.W / 2}" y="${g.via0}">ninguna serie de E se mueve aquí</text>`);
  const mas = datos.masVias + Math.max(0, datos.vias.length - vias.length);
  if (mas) capas.vias.push(`<text class="x-rotulo x-mas" x="${g.x1}" y="${yFin + (compacto ? 9 : 16)}" text-anchor="end">+${mas} vías</text>`);

  const abiertas = datos.vias.filter((v) => v.abierta).length;
  const etiqueta = `Ciudad: ${datos.tiendas.filter((t) => !t.vacia).length} tiendas en la manzana de la posición 1, ${datos.otros.length} ocupantes más; ${datos.vias.length + datos.masVias} vías de E (${abiertas} abiertas a la vista, ${datos.vias.length - abiertas} cerradas)`;
  return `<svg class="mundo mundo-ciudad${compacto ? ' compacto' : ''}" viewBox="0 0 ${g.W} ${g.H}" role="img" aria-label="${escapar(etiqueta)}" data-mundo="1" xmlns="http://www.w3.org/2000/svg">`
    + `<g class="x-capa-manzana">${capas.manzana.join('')}</g><g class="x-capa-otros">${capas.otros.join('')}</g>`
    + `<g class="x-capa-calle">${capas.calle.join('')}</g><g class="x-capa-vias">${capas.vias.join('')}</g>`
    + `<g class="x-capa-mercancia">${capas.mercancia.join('')}</g></svg>`;
}

/** Render sobrio de la misma lectura. */
export function lineasCiudad(datos) {
  const out = [];
  const llenas = datos.tiendas.filter((t) => !t.vacia);
  out.push('manzana (1): ' + (llenas.length ? llenas.map((t) => `1.${t.j} ${t.texto}`).join(' · ') : 'sin recursos'));
  for (const o of datos.otros) out.push(`${o.tipo === 'escrito' ? 'tienda abierta por ' + o.autor : 'almacén alcanzado'}: ${o.texto}`);
  for (const v of datos.vias) out.push(`vía ${v.etiqueta} de ${v.emisor}: ${v.abierta ? 'abierta' : 'cerrada (el emisor ya lo dio todo)'} · ${v.movimientos.length} movimientos · emitidos ${v.emitido}`);
  if (datos.masVias) out.push(`+${datos.masVias} vías más`);
  return out;
}
