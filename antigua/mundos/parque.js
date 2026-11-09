// Mundo del parque (PV3, parque acuático/spa de la comunicación): cuarta
// pieza de la X (mapa §12 [D]).
//
// Qué se ve: quién habla con quién alrededor del foco. Cada identidad es un
// agua: una PISCINA si es un grupo, una BAÑERA si es una persona (corpus V3
// PV3: «bañeras individuales, piscinas de grupos»). La posición 3 del foco
// declara quién con quién: esas aguas llevan un anillo y un canal entre
// ellas. Los ESCRITOS entre identidades son la comunicación: escribir sobre
// un registro de otro es HABLARLE (a una persona o a un grupo según lo que
// declaró su alta); un registro que solo ve el de otro (una referencia
// entera a él: el registro mínimo de ver del catálogo) es ESCUCHARLO. Se leen
// el hilo del foco hacia el génesis y lo escrito sobre él. El nivel del agua
// es cuánto ha recibido cada una.
//
// El parque no crea ni infiere relaciones ni motivos (corpus: «hablar o
// escuchar es un hecho observable; la razón de hacerlo es otro problema»):
// solo dibuja los escritos que hay. Escribir sobre lo propio no es hablar
// con nadie y no se dibuja.
//
// Qué se anima, solo si el evento es nuevo para quien mira:
// - una gota (o un paquete, si el escrito mueve E, P o R) viaja del agua de
//   quien habla a la de quien recibe, y el agua de llegada hace onda. El
//   paquete se nombra con el movimiento de tokens que lo dispara, visto desde
//   el parque (catálogo: mover = «subir el agua»);
// - quien escucha hace onda en su propia agua.
//
// [X] decidir VG (abierto en este mundo):
// - persona o cosa sale de quién escribió el alta de quien recibe (B1; un
//   grupo, solo en el prefijo de la versión 2); una cosa se dibuja como un muelle, y quien no
//   tiene alta, como una bañera con borde discontinuo;
// - «hablar» = escribir sobre un registro de otro, y «escuchar» = un registro
//   que es una referencia entera al de otro (catálogo, PR #45: ver);
// - el nombre del efecto es el del catálogo («hablar», «escuchar», «subir el
//   agua»), con «a una persona» o «a un grupo» añadido aquí;
// - dibujar como paquete un movimiento de tokens: el catálogo reserva
//   «paquete» para un impulso (una celda de clase 1), no para un movimiento.

import { esReferencia } from '../../src/btml.js';
import { escapar, n1, recorte, baseDe, descendientes, nombreEn, ritmo, atributos, ordenPlano } from './comun.js';

const X_TIPO = '[X] decidir VG: persona o cosa sale de quién escribió el alta de quien recibe (B1); grupo, solo en el prefijo de la versión 2';
const X_PAQUETE = '[X] decidir VG: el movimiento de tokens se dibuja como paquete; en el catálogo, «paquete» es un impulso (celda de clase 1) y el movimiento se llama como aquí';

/** Sentido de un movimiento de tokens, como en el catálogo de efectos. */
const sentido = (m) => (m.de === null ? 'emitir' : m.a === null ? 'consumir' : 'mover');

/** Forma del agua de una identidad por lo que es: persona, cosa o (en el prefijo de la versión 2) grupo. */
export function aguaDe(tipo) {
  return tipo === 'grupo' ? 'piscina' : tipo === 'persona' ? 'banera' : tipo === 'cosa' ? 'muelle' : 'sin-tipo';
}

/**
 * Lo que es una identidad, para dibujarla (VG, 10-11, B1: no hay tipo): una
 * persona si escribió su propia alta, una cosa si la escribió otro, y en el
 * prefijo de la versión 2 lo que declaraba su alta (un grupo); null sin alta.
 */
export function claseDe(eje, id) {
  const v2 = typeof eje.tipoV2 === 'function' ? eje.tipoV2(id) : null;
  if (v2) return v2;
  const p = typeof eje.esPersona === 'function' ? eje.esPersona(id) : null;
  return p === true ? 'persona' : p === false ? 'cosa' : null;
}

/** Acto de un escrito de A sobre un registro de B: escuchar si solo lo ve (una referencia entera a él); si no, hablar. */
export function actoDe(ev, sobre) {
  return esReferencia(ev.payload) && ev.payload.ref === sobre.id && (ev.payload.dir ?? '0000000000') === '0000000000' ? 'escuchar' : 'hablar';
}

/**
 * Lo que dibuja el parque de un foco (bajo `camino`): las aguas de las
 * identidades que se escriben alrededor del foco, las declaradas en su
 * posición 3, y los escritos entre ellas. No escribe nada.
 */
export function datosParque(eje, foco, { camino = [], maximo = 6, maximoMensajes = 120 } = {}) {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  const identidades = new Set(eje.identidades());
  const base = baseDe(ev.payload, camino);
  const tres = Array.isArray(base) ? base[3] : undefined;
  const lista = Array.isArray(tres) ? tres : tres === undefined ? [] : [tres];
  const declarados = [...new Set(lista.filter((x) => typeof x === 'string' && identidades.has(x)))];
  const notas = lista.filter((x) => !(typeof x === 'string' && identidades.has(x))).length;

  const orden = ordenPlano(eje);
  const eventos = [...eje.hilo(foco).reverse(), ...descendientes(eje, foco, maximoMensajes)];
  const mensajes = [];
  for (const e of eventos) {
    if (e.sobre === null) continue;
    const b = eje.obtener(e.sobre);
    if (!b || b.autor === e.autor) continue;
    const acto = actoDe(e, b);
    // Quien escucha recibe lo que lee: el agua que hace onda es la suya. Quien habla, deja algo en el agua del otro.
    const tipo = claseDe(eje, b.autor);
    // El paquete: el primer movimiento que no es T (el tiempo lo gasta todo escrito).
    const mov = e.movimientos.find((m) => m.token !== 'T');
    const paquete = Boolean(mov);
    mensajes.push({
      evento: e.id, de: e.autor, a: b.autor, sobre: b.id, acto, tipo, paquete,
      ...(mov ? { carga: { token: mov.token, movimiento: sentido(mov), cantidad: mov.cantidad } } : {}),
      que: acto === 'escuchar' ? 'escuchar' : tipo === 'grupo' ? 'hablar a un grupo' : tipo === 'persona' ? 'hablar a una persona' : 'hablar',
    });
  }

  const recibidos = new Map();
  for (const m of mensajes) if (m.acto === 'hablar') recibidos.set(m.a, (recibidos.get(m.a) ?? 0) + 1);
  const actividad = new Map();
  for (const m of mensajes) for (const id of [m.de, m.a]) actividad.set(id, (actividad.get(id) ?? 0) + 1);
  const todas = [...new Set([...declarados, ...actividad.keys()])];
  todas.sort((a, b) => Number(declarados.includes(b)) - Number(declarados.includes(a)) || (actividad.get(b) ?? 0) - (actividad.get(a) ?? 0));
  const aguas = todas.slice(0, maximo).map((id) => {
    const tipo = claseDe(eje, id);
    return { id, tipo, forma: aguaDe(tipo), declarado: declarados.includes(id), recibidos: recibidos.get(id) ?? 0 };
  });

  // Pares: un trazo por (de, a, acto), con cuántos escritos lleva y cuál fue el último.
  const pares = new Map();
  for (const m of mensajes) {
    const k = m.de + '→' + m.a + ':' + m.acto;
    if (!pares.has(k)) pares.set(k, { de: m.de, a: m.a, acto: m.acto, que: m.que, eventos: [] });
    pares.get(k).eventos.push(m.evento);
  }

  const hablar = nombreEn({ tipo: 'escrito' }, 3);
  return {
    foco, camino: [...camino], declarados, notas, aguas, masAguas: Math.max(0, todas.length - aguas.length),
    mensajes, pares: [...pares.values()],
    efectos: {
      hablar: { ...hablar, decision: [hablar.decision, X_TIPO].filter(Boolean).join(' · ') },
      escuchar: nombreEn({ tipo: 'ver' }, 3),
      // Cada paquete lleva el nombre de su movimiento visto desde el parque (efectoPaquete).
    },
    orden,
  };
}

// ---------- render ----------

/** Nombre del paquete: el del movimiento de tokens que lo dispara, visto desde el parque, con la marca de la forma. */
export function efectoPaquete(carga) {
  const ef = nombreEn({ tipo: 'token', movimiento: carga.movimiento, token: carga.token }, 3);
  return { ...ef, decision: [X_PAQUETE, ef.decision].filter(Boolean).join(' · ') };
}

function geometria(compacto) {
  return compacto
    ? { W: 120, H: 96, cx: 60, cy: 47, rx: 40, ry: 28, piscina: [15, 8], banera: [13, 7], etiquetas: false, salto: 12 }
    : { W: 400, H: 232, cx: 200, cy: 118, rx: 142, ry: 74, piscina: [40, 19], banera: [27, 13], etiquetas: true, salto: 34 };
}

function dibujoAgua(a, g, nivel) {
  const [rx, ry] = a.forma === 'piscina' ? g.piscina : g.banera;
  const borde = a.forma === 'piscina'
    ? `<ellipse class="x-borde" rx="${rx}" ry="${ry}"/>`
    : a.forma === 'muelle'
      ? `<rect class="x-borde" x="${-rx}" y="${-ry * 0.7}" width="${2 * rx}" height="${n1(ry * 1.4)}" rx="1"/>`
      : `<rect class="x-borde" x="${-rx}" y="${-ry}" width="${2 * rx}" height="${2 * ry}" rx="${ry}"/>`;
  const k = 0.45 + 0.5 * nivel;
  const agua = a.forma === 'piscina'
    ? `<ellipse class="x-agua" rx="${n1(rx * k)}" ry="${n1(ry * k)}"/>`
    : `<rect class="x-agua" x="${n1(-rx * k)}" y="${n1(-ry * k)}" width="${n1(2 * rx * k)}" height="${n1(2 * ry * k)}" rx="${n1(ry * k)}"/>`;
  return borde + agua;
}

/**
 * El SVG del parque, como texto. Función pura.
 *   datos: lo que devuelve datosParque().
 *   compacto: sin rótulos, para la celda 3 de Mapped.
 *   nuevos: Set de ids de evento que se animan.
 */
export function svgParque(datos, { compacto = false, nuevos = new Set() } = {}) {
  const g = geometria(compacto);
  const r = ritmo(datos.orden, nuevos);
  const aguas = datos.aguas.slice(0, compacto ? 5 : 6);
  const sitio = new Map();
  aguas.forEach((a, n) => {
    if (aguas.length === 1) { sitio.set(a.id, { x: g.cx, y: g.cy }); return; }
    if (aguas.length === 2) { sitio.set(a.id, { x: g.cx + (n ? 1 : -1) * g.rx * 0.72, y: g.cy }); return; }
    const ang = -Math.PI / 2 + (n * 2 * Math.PI) / aguas.length;
    sitio.set(a.id, { x: g.cx + g.rx * Math.cos(ang), y: g.cy + g.ry * Math.sin(ang) });
  });
  const maxRecibidos = Math.max(1, ...aguas.map((a) => a.recibidos));
  const capas = { canales: [], trazos: [], aguas: [], viajes: [], ondas: [] };
  if (g.etiquetas) capas.canales.push(`<text class="x-rotulo x-titulo" x="8" y="12">3 comunicación · quién con quién</text>`);

  // Canal declarado en la posición 3 del foco: entre cada par de declarados.
  const decl = aguas.filter((a) => a.declarado);
  for (let i = 0; i < decl.length; i++) {
    for (let j = i + 1; j < decl.length; j++) {
      const p = sitio.get(decl[i].id);
      const q = sitio.get(decl[j].id);
      capas.canales.push(`<line class="x-canal" x1="${n1(p.x)}" y1="${n1(p.y)}" x2="${n1(q.x)}" y2="${n1(q.y)}"><title>${escapar('declarados en la posición 3 del foco: ' + decl[i].id + ' con ' + decl[j].id)}</title></line>`);
    }
  }

  // Trazos: un arco por (de, a, acto); el de ida y el de vuelta se separan.
  const curva = (p, q, lado) => {
    const mx = (p.x + q.x) / 2;
    const my = (p.y + q.y) / 2;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const off = (compacto ? 8 : 22) * lado;
    return `M${n1(p.x)} ${n1(p.y)}Q${n1(mx - (dy / len) * off)} ${n1(my + (dx / len) * off)} ${n1(q.x)} ${n1(q.y)}`;
  };
  for (const par of datos.pares) {
    const p = sitio.get(par.de);
    const q = sitio.get(par.a);
    if (!p || !q) continue;
    const d = curva(p, q, 1);
    const ancho = n1(Math.min(compacto ? 2.2 : 4, (compacto ? 0.8 : 1.2) + Math.log2(par.eventos.length)));
    const ultimo = par.eventos[par.eventos.length - 1];
    capas.trazos.push(`<path class="x-trazo x-${par.acto}" d="${d}" style="stroke-width:${ancho}" data-ir="${escapar(ultimo)}"><title>${escapar(`${par.de} → ${par.a}: ${par.que} · ${par.eventos.length} ${par.eventos.length === 1 ? 'escrito' : 'escritos'}`)}</title></path>`);
  }

  for (const a of aguas) {
    const { x, y } = sitio.get(a.id);
    const nivel = a.recibidos / maxRecibidos;
    const que = a.forma === 'piscina' ? 'piscina (grupo)' : a.forma === 'banera' ? 'bañera (persona)' : a.forma === 'muelle' ? 'muelle (cosa)' : 'bañera (sin tipo declarado)';
    capas.aguas.push(`<g transform="translate(${n1(x)} ${n1(y)})"><g class="x-agua-de x-${a.forma}${a.declarado ? ' x-declarado' : ''}" data-identidad="${escapar(a.id)}" data-decision="${escapar(X_TIPO)}">`
      + `<title>${escapar(`${a.id}: ${que} · ha recibido ${a.recibidos}${a.declarado ? ' · declarado en la posición 3' : ''}`)}</title>${dibujoAgua(a, g, nivel)}`
      + (g.etiquetas ? `<text class="x-rotulo x-quien" y="${(a.forma === 'piscina' ? g.piscina[1] : g.banera[1]) + 12}">${escapar(recorte(a.id, 12))}</text>` : '') + '</g></g>');
  }

  // Lo nuevo: una gota (o un paquete) de quien habla a quien recibe; ondas al llegar y al escuchar.
  for (const m of datos.mensajes) {
    if (!r.es(m.evento)) continue;
    const p = sitio.get(m.de);
    const q = sitio.get(m.a);
    if (!p || !q) continue;
    if (m.acto === 'escuchar') {
      capas.ondas.push(`<g transform="translate(${n1(p.x)} ${n1(p.y)})"><g class="x-onda x-nuevo x-escucha" ${atributos(m.evento, datos.efectos.escuchar, 3, ` data-de="${escapar(m.de)}" data-a="${escapar(m.a)}" style="${r.estilo(m.evento)}"`)}><title>${escapar(m.de + ' escucha a ' + m.a)}</title><circle r="${compacto ? 8 : 18}"/></g></g>`);
      continue;
    }
    const ef = m.paquete ? efectoPaquete(m.carga) : { ...datos.efectos.hablar, nombre: datos.efectos.hablar.nombre + (m.tipo === 'grupo' ? ' a un grupo' : m.tipo === 'persona' ? ' a una persona' : '') };
    const gota = m.paquete
      ? `<rect class="x-paquete" x="${compacto ? -2.5 : -5}" y="${compacto ? -2.5 : -5}" width="${compacto ? 5 : 10}" height="${compacto ? 5 : 10}" rx="1"/>`
      : `<path class="x-gota" d="M0 ${compacto ? -3.5 : -7}Q${compacto ? 3 : 6} ${compacto ? 0 : 1} 0 ${compacto ? 3 : 5}Q${compacto ? -3 : -6} ${compacto ? 0 : 1} 0 ${compacto ? -3.5 : -7}Z"/>`;
    capas.viajes.push(`<g transform="translate(${n1(p.x)} ${n1(p.y)})"><g class="x-viaje x-nuevo" ${atributos(m.evento, ef, 3, ` data-de="${escapar(m.de)}" data-a="${escapar(m.a)}" style="--dx:${n1(q.x - p.x)}px;--dy:${n1(q.y - p.y)}px;--alto:${-g.salto}px;${r.estilo(m.evento)}"`)}>`
      + `<g class="x-salta">${gota}</g></g></g>`);
    capas.ondas.push(`<g transform="translate(${n1(q.x)} ${n1(q.y)})"><g class="x-onda x-nuevo x-llega" ${atributos(m.evento, ef, 3, ` style="${r.estilo(m.evento, 1.05)}"`)}><circle r="${compacto ? 9 : 20}"/></g></g>`);
  }

  if (!aguas.length && g.etiquetas) capas.aguas.push(`<text class="x-rotulo x-nada" x="${g.cx}" y="${g.cy}">nadie se escribe con nadie aquí</text>`);
  if (datos.masAguas) capas.aguas.push(`<text class="x-rotulo x-mas" x="${g.W - 4}" y="${g.H - 4}" text-anchor="end">+${datos.masAguas}</text>`);

  const hablan = datos.mensajes.filter((m) => m.acto === 'hablar').length;
  const escuchan = datos.mensajes.length - hablan;
  const etiqueta = `Parque: ${datos.aguas.length + datos.masAguas} aguas (${datos.aguas.filter((a) => a.forma === 'piscina').length} piscinas de grupo, ${datos.aguas.filter((a) => a.forma === 'banera').length} bañeras de persona); ${hablan} escritos que hablan y ${escuchan} que escuchan`;
  return `<svg class="mundo mundo-parque${compacto ? ' compacto' : ''}" viewBox="0 0 ${g.W} ${g.H}" role="img" aria-label="${escapar(etiqueta)}" data-mundo="3" xmlns="http://www.w3.org/2000/svg">`
    + `<g class="x-capa-canales">${capas.canales.join('')}</g><g class="x-capa-trazos">${capas.trazos.join('')}</g>`
    + `<g class="x-capa-aguas">${capas.aguas.join('')}</g><g class="x-capa-ondas">${capas.ondas.join('')}</g><g class="x-capa-viajes">${capas.viajes.join('')}</g></svg>`;
}

/** Render sobrio de la misma lectura. */
export function lineasParque(datos) {
  const out = [];
  out.push('declarados en 3: ' + (datos.declarados.length ? datos.declarados.join(', ') : 'nadie') + (datos.notas ? ` (+${datos.notas} que no son identidades)` : ''));
  for (const a of datos.aguas) out.push(`${a.id}: ${a.forma === 'piscina' ? 'piscina' : a.forma === 'banera' ? 'bañera' : a.forma} · ha recibido ${a.recibidos}`);
  for (const p of datos.pares) out.push(`${p.de} → ${p.a}: ${p.que} · ${p.eventos.length}`);
  return out;
}

