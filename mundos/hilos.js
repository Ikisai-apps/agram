// Mundo de los hilos (PV6 y PV7): el primer render animado.
//
// Sobrio y animado son dos renders de la misma operación (mapa §10.3 [D]):
// este módulo dibuja en SVG el mismo eje temporal que el render sobrio pinta
// como listas (src/tiempo.js, ejeTemporal), y cada cosa que se mueve es el
// efecto de un evento real del eje (mapa §10.2 [D]: nada simulado sobre
// datos falsos). Orden de los mundos: los hilos primero (mapa §12 [D]).
//
// Qué se ve:
// - el presente en el centro, con el foco encima: es la costura;
// - a la izquierda, los registros del pasado como nodos encadenados por
//   referencia (hilo = cadena por `sobre`, mapa §10 [D]), no por mera fecha;
// - a la derecha, las proyecciones, las consolidaciones pendientes y lo
//   declarado en la posición 7, como arcos que salen del foco hacia bloques;
// - las bandas de tiempo (segundo … año y más) como franjas comprimidas:
//   cada banda más lejana ocupa 2/3 de la interior (corpus V3 §10.2: «más
//   espacio cerca del presente»; propuesta de composición, no cociente rígido);
// - debajo (vista completa), las carteras: los tokens de cada evento nuevo se
//   mueven como puntos de `de` a `a`; ∅ es emitir o consumir.
//
// Qué se anima, y solo cuando el evento es nuevo para quien mira (memoria()):
// - un registro nuevo entra por la izquierda;
// - una consolidación pendiente o una proyección se proyecta a la derecha;
// - una autorización anuda el arco;
// - una ejecución ancla: el arco suelta el futuro, cae al presente y se
//   ancla en el hilo, y sus tokens se mueven de `de` a `a`.
// Cada elemento lleva data-evento (el id del evento que lo produce) y
// data-efecto (el nombre del efecto). Los nombres son los del catálogo de
// efectos de la PR #45 (datos/efectos.json, mundos 6 y 7; src/efectos.js):
// esa PR aún no está en main, así que aquí se copian y una prueba compara
// las dos tablas en cuanto src/efectos.js exista. Lo que el corpus no nombra
// lleva «[X] decidir VG», igual que allí.
//
// [X] decidir VG (abierto en este mundo):
// - una consolidación pendiente no tiene fecha futura (es futuro subjetivo):
//   se sitúa a la derecha según la distancia que da tiempo.ejeTemporal, que es
//   lo que lleva pendiente;
// - lo que cae dentro del primer segundo se dibuja junto al foco, no encima;
// - cuando una banda no cabe, lo que sobra se agrega en un contador
//   («lo lejano, contadores agregados»), sin desplegar todavía;
// - el ∅ de las carteras (emitir y consumir) se dibuja en el presente.
//
// Sin DOM: svgHilos() es una función pura que devuelve el SVG como texto,
// para el navegador y para las pruebas de Node.

import { ejeTemporal, banda } from '../src/tiempo.js';
import { SEGUNDOS, ESCALAS_T } from '../src/tokens.js';
import { consolidaciones, autorizacionesValidas, FABRICA } from '../src/motor.js';
import { esReferencia } from '../src/btml.js';

/** Bandas del eje, de la más cercana al presente a la más lejana: las escalas de T y «más». */
export const BANDAS = Object.freeze([...ESCALAS_T, 'mas']);

/** Cada banda más lejana ocupa esta fracción de la interior (corpus V3 §10.2, propuesta). */
export const RAZON = 2 / 3;

const CORTA = Object.freeze({ segundo: 's', minuto: 'min', hora: 'h', dia: 'd', semana: 'sem', ciclo: 'cic', anio: 'a', mas: '+' });

const X_BIG = '[X] decidir VG: el nombre es de la big picture, no del corpus';

/**
 * Efectos de este mundo, por tipo de elemento. Mundo 6 = hilos del pasado,
 * 7 = hilos del futuro. `tipo` y `fase` son los del catálogo de la PR #45;
 * `nombre` es el que da ese catálogo al verlo desde el mundo (verEn).
 */
export const EFECTOS = Object.freeze({
  registro: Object.freeze({ mundo: 6, tipo: 'escrito', nombre: 'entra por la izquierda', decision: X_BIG }),
  proyeccion: Object.freeze({ mundo: 7, tipo: 'escrito', nombre: 'arco al futuro', decision: X_BIG }),
  declarado: Object.freeze({ mundo: 7, tipo: 'escrito', nombre: 'arco al futuro', decision: X_BIG }),
  consolidacion: Object.freeze({ mundo: 7, tipo: 'fase', fase: 'consolidado', nombre: 'arco al futuro', decision: X_BIG }),
  autorizacion: Object.freeze({ mundo: 7, tipo: 'fase', fase: 'autorizado', nombre: 'autorizar', decision: '[X] decidir VG: el corpus no nombra este efecto en este mundo' }),
  ejecucion: Object.freeze({ mundo: 7, tipo: 'fase', fase: 'ejecutado', nombre: 'ancla', decision: X_BIG }),
});

/** Movimiento de un token: emitir (de nadie), consumir (a nadie) o mover. */
export function movimientoDe(m) {
  return m.de === null ? 'emitir' : m.a === null ? 'consumir' : 'mover';
}

/** Nombre del efecto de un movimiento visto en los hilos: el genérico del catálogo (los hilos no lo nombran). */
export function nombreToken(m) {
  return movimientoDe(m) + ' ' + m.token;
}

// ---------- geometría: bandas comprimidas ----------

/** Ancho de cada banda en una mitad del eje: la primera w0 y cada una 2/3 de la anterior; suman la mitad. */
export function anchosDeBanda(mitad, razon = RAZON) {
  const n = BANDAS.length;
  const w0 = (mitad * (1 - razon)) / (1 - razon ** n);
  return BANDAS.map((_, i) => w0 * razon ** i);
}

/**
 * Distancia al presente, en unidades del dibujo, de algo que está a `delta`
 * segundos (pasado o futuro: cuenta el valor absoluto). Dentro de su banda,
 * escala logarítmica entre los límites de la banda; la primera, lineal.
 */
export function distanciaAlPresente(delta, mitad, razon = RAZON) {
  const d = Math.abs(delta);
  if (!Number.isFinite(d)) return mitad;
  const anchos = anchosDeBanda(mitad, razon);
  const i = BANDAS.indexOf(banda(d));
  const inicio = anchos.slice(0, i).reduce((a, b) => a + b, 0);
  const lo = i === 0 ? 0 : SEGUNDOS[BANDAS[i - 1]];
  const hi = i < ESCALAS_T.length ? SEGUNDOS[BANDAS[i]] : lo * 10;
  const frac = i === 0 ? d / hi : Math.min(1, Math.log(d / lo) / Math.log(hi / lo));
  return inicio + frac * anchos[i];
}

// ---------- datos: del eje a una lista plana ----------

const seg = (iso) => Date.parse(iso) / 1000;

function textoCorto(c) {
  if (c === undefined || c === null) return '';
  if (Array.isArray(c)) return c.length ? textoCorto(c[0]) : '[ ]';
  if (esReferencia(c)) return '→ ' + String(c.ref).slice(0, 8);
  const s = String(c);
  return s.startsWith('==') ? s.slice(1) : s;
}

/** Título de un registro: su posición 0 (su representación) o el terminal. */
export function titulo(ev) {
  return textoCorto(ev?.payload);
}

const copiaMovimientos = (ev) => (ev?.movimientos ?? []).map((m) => ({ ...m }));

/**
 * Lo que dibujan los hilos de un foco, sacado del eje: el eje temporal de
 * tiempo.ejeTemporal (el mismo que pinta el sobrio) más lo que el animado
 * necesita para encadenar y anclar: a qué apunta cada registro (`sobre`),
 * quién autorizó, qué ejecución ancló cada consolidación, los movimientos de
 * tokens de cada evento y el orden de entrada en el eje. No escribe nada.
 */
export function datosHilos(eje, foco, { ahora = new Date().toISOString(), camino = [], maximo } = {}) {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  const e = ejeTemporal(eje, foco, { ahora, camino, ...(maximo ? { maximo } : {}) });
  const t0 = seg(ahora);
  const ancestros = new Set(eje.hilo(foco).slice(1).map((x) => x.id));

  const pasado = e.pasado.map((x) => {
    const r = eje.obtener(x.id);
    return {
      id: x.id, autor: x.autor, t: x.t, delta: x.delta, banda: x.banda,
      sobre: r.sobre, hilo: ancestros.has(x.id), genesis: r.sobre === null,
      fase: r.contexto?.fase ?? null, titulo: titulo(r), movimientos: copiaMovimientos(r),
    };
  });

  const futuro = e.futuro.map((x) => {
    const base = { id: x.id, tipo: x.tipo, autor: x.autor, t: x.t, delta: x.delta, banda: x.banda };
    if (x.tipo === 'declarado') return { ...base, titulo: textoCorto(x.contenido), movimientos: [] };
    const r = eje.obtener(x.id);
    const f = { ...base, titulo: titulo(r), movimientos: copiaMovimientos(r) };
    if (x.tipo === 'consolidacion') {
      f.estado = x.estado;
      const a = autorizacionesValidas(eje, x.id)[0];
      if (a) f.autorizacion = { id: a.id, autor: a.autor, movimientos: copiaMovimientos(a) };
    }
    return f;
  });

  const anclas = [];
  for (const c of consolidaciones(eje, foco, camino)) {
    if (c.estado !== 'EJECUTADO') continue;
    const x = eje.sobre(c.id, FABRICA).find((h) => h.contexto?.fase === 'ejecutado' && h.autor === c.autor);
    if (!x) continue;
    const delta = seg(x.t) - t0;
    anclas.push({
      id: x.id, consolidacion: c.id, autorizacion: x.contexto.evidencia?.[1] ?? null,
      titulo: textoCorto(c.titulo), autor: x.autor, t: x.t, delta, banda: banda(delta),
      pendiente: seg(x.t) - seg(c.t), // cuánto estuvo a la derecha antes de anclar
      movimientos: copiaMovimientos(x),
    });
  }

  const ids = new Set([foco, ...pasado.map((x) => x.id), ...futuro.map((x) => x.id), ...anclas.map((x) => x.id)]);
  for (const f of futuro) if (f.autorizacion) ids.add(f.autorizacion.id);
  for (const a of anclas) for (const id of [a.consolidacion, a.autorizacion]) if (id) ids.add(id);
  const orden = {};
  eje.orden.forEach((id, i) => { if (ids.has(id)) orden[id] = i; });

  return {
    foco: { id: ev.id, autor: ev.autor, t: ev.t, sobre: ev.sobre, titulo: titulo(ev), delta: seg(ev.t) - t0, banda: banda(seg(ev.t) - t0) },
    ahora, pasado, futuro, anclas: anclas.slice(-(maximo ?? 10)),
    identidades: eje.identidades(), totalPasado: e.totalPasado, totalFuturo: e.totalFuturo, orden,
  };
}

/**
 * Memoria de quien mira: qué eventos del eje ya ha visto en los hilos. Solo
 * lo nuevo se anima (un cambio real del eje); la primera vez que se miran
 * los hilos, o con otro eje, nada se anima. `reproducir` vuelve a contar
 * como nuevo todo el eje, para ver llegar cada registro en su orden real.
 */
export function memoria() {
  let ejeVisto = null;
  let conocidos = null;
  return {
    nuevos(eje, { reproducir = false } = {}) {
      const ids = eje.orden;
      let n;
      if (reproducir) n = new Set(ids);
      else if (ejeVisto !== eje || !conocidos) n = new Set();
      else n = new Set(ids.filter((id) => !conocidos.has(id)));
      ejeVisto = eje;
      conocidos = new Set(ids);
      return n;
    },
  };
}

// ---------- render: SVG como texto ----------

function escapar(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const n1 = (x) => Math.round(x * 10) / 10;
const corto = (id) => String(id).slice(0, 8);
const recorte = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function haceCuanto(delta, b) {
  const d = Math.abs(delta);
  const u = [['anio', 'año'], ['ciclo', 'ciclo'], ['semana', 'semana'], ['dia', 'día'], ['hora', 'h'], ['minuto', 'min']];
  let txt = Math.round(d) + ' s';
  for (const [k, nombre] of u) {
    if (d >= SEGUNDOS[k]) { txt = Math.round(d / SEGUNDOS[k]) + ' ' + nombre; break; }
  }
  return (delta <= 0 ? 'hace ' : 'dentro de ') + txt + ' · banda ' + b;
}

const W = 400;
const CX = W / 2;

function geometria(compacto) {
  return compacto
    ? { H: 124, eje: 62, r: 7, margen: 6, minimo: 16, carrilesPasado: [0, -24, 24, -46, 46], carrilesFuturo: [-24, 24, -46, 46, 0], bloque: [18, 12] }
    : { H: 286, eje: 132, r: 6, margen: 12, minimo: 18, carrilesPasado: [0, -26, 26, -52, 52, -78], carrilesFuturo: [-28, 28, -56, 56, -84, 0], bloque: [18, 12], carteras: 258 };
}

/** Coloca en carriles: cada nodo en el primer carril donde no pisa al anterior; lo que no cabe, al contador de su banda. */
function encarrilar(items, carriles, separacion, preferente = () => false) {
  const ultimo = new Map();
  const colocados = [];
  const sobran = new Map();
  const orden = [...items.filter(preferente), ...items.filter((x) => !preferente(x))];
  for (const it of orden) {
    const lista = preferente(it) ? carriles : [...carriles.slice(1), carriles[0]];
    const c = lista.find((k) => !ultimo.has(k) || Math.abs(ultimo.get(k) - it.x) >= separacion);
    if (c === undefined) { sobran.set(it.banda, (sobran.get(it.banda) ?? 0) + 1); continue; }
    ultimo.set(c, it.x);
    colocados.push({ ...it, carril: c });
  }
  return { colocados, sobran };
}

/**
 * El SVG de los hilos, como texto. Función pura: no toca el DOM ni el eje.
 *   datos: lo que devuelve datosHilos().
 *   ventana: 'todo' (vista completa), 'pasado' (celda 6) o 'futuro' (celda 7).
 *   compacto: sin rótulos ni carteras, para las celdas de Mapped.
 *   nuevos: Set de ids de evento que se animan (memoria().nuevos).
 *   nombrar: opcional, (clave, efecto) → nombre, para leer los nombres de
 *     otro catálogo (src/efectos.js cuando esté en main).
 */
export function svgHilos(datos, { ventana = 'todo', compacto = false, nuevos = new Set(), nombrar } = {}) {
  if (!['todo', 'pasado', 'futuro'].includes(ventana)) throw new Error('ventana desconocida: ' + ventana);
  const g = geometria(compacto);
  const mitad = CX - g.margen;
  const nombre = (clave) => (nombrar ? nombrar(clave, EFECTOS[clave]) : null) ?? EFECTOS[clave].nombre;
  const decision = (clave) => EFECTOS[clave].decision ? ` data-decision="${escapar(EFECTOS[clave].decision)}"` : '';
  const atributos = (clave, id, extra = '') => `data-evento="${escapar(id)}" data-efecto="${escapar(nombre(clave))}" data-mundo="${EFECTOS[clave].mundo}"${decision(clave)}${extra}`;
  const xPasado = (delta) => CX - Math.max(distanciaAlPresente(delta, mitad), g.minimo);
  const xFuturo = (delta) => CX + Math.max(distanciaAlPresente(delta, mitad), g.minimo);
  const verPasado = ventana !== 'futuro';
  const verFuturo = ventana !== 'pasado';

  // Retardo por evento: los nuevos llegan en su orden de entrada en el eje.
  const nuevosEnOrden = [...nuevos].filter((id) => datos.orden[id] !== undefined).sort((a, b) => datos.orden[a] - datos.orden[b]);
  const PASO = 0.55;
  const retardo = (id, mas = 0) => `--retardo:${Math.round((Math.max(0, nuevosEnOrden.indexOf(id)) * PASO + mas) * 100) / 100}s`;
  const esNuevo = (id) => nuevos.has(id);
  const origen = `transform-origin:${CX}px ${g.eje}px`;

  const capas = { bandas: [], hilos: [], nodos: [], futuro: [], anclas: [], carteras: [], puntos: [] };

  // Rótulos: solo en la vista completa, y uno por carril cada 50 unidades (el más cercano al presente primero).
  const rotulados = new Map();
  const rotular = (carril, x) => {
    if (compacto || Math.abs((rotulados.get(carril) ?? -Infinity) - x) < 50) return false;
    rotulados.set(carril, x);
    return true;
  };

  // Bandas: franjas alternas a cada lado, con su rótulo si cabe.
  const anchos = anchosDeBanda(mitad);
  let acumulado = 0;
  anchos.forEach((w, i) => {
    const lados = [...(verPasado ? [CX - acumulado - w] : []), ...(verFuturo ? [CX + acumulado] : [])];
    for (const x of lados) {
      capas.bandas.push(`<rect class="banda b${i % 2}" x="${n1(x)}" y="${compacto ? 4 : 18}" width="${n1(w)}" height="${g.H - (compacto ? 8 : 52)}"><title>${BANDAS[i]}</title></rect>`);
      if (!compacto && w >= 14) capas.bandas.push(`<text class="rotulo-banda" x="${n1(x + w / 2)}" y="13">${CORTA[BANDAS[i]]}</text>`);
    }
    acumulado += w;
  });
  const eje = `<line class="eje" x1="${verPasado ? g.margen : CX}" y1="${g.eje}" x2="${verFuturo ? W - g.margen : CX}" y2="${g.eje}"/>`
    + `<line class="presente" x1="${CX}" y1="${compacto ? 4 : 18}" x2="${CX}" y2="${g.H - (compacto ? 4 : 34)}"/>`
    + (compacto ? '' : `<text class="rotulo-presente" x="${CX}" y="13">ahora</text>`);

  // Pasado: nodos en carriles; el hilo hacia el génesis va en el carril del eje.
  const sep = 2 * g.r + 4;
  const { colocados: pasado, sobran } = encarrilar(
    datos.pasado.map((p) => ({ ...p, x: xPasado(p.delta) })),
    g.carrilesPasado, sep, (p) => p.hilo,
  );
  const posicion = new Map([[datos.foco.id, { x: CX, y: g.eje }]]);
  for (const p of pasado) posicion.set(p.id, { x: p.x, y: g.eje + p.carril });

  const enlace = (a, b) => {
    const mx = n1((a.x + b.x) / 2);
    return `M${n1(a.x)} ${n1(a.y)} C${mx} ${n1(a.y)} ${mx} ${n1(b.y)} ${n1(b.x)} ${n1(b.y)}`;
  };
  if (verPasado) {
    // Hilos: cada registro unido a aquello sobre lo que se escribió (la referencia `sobre`).
    const conSobre = [...pasado, { ...datos.foco, x: CX, carril: 0 }];
    for (const p of conSobre) {
      const destino = p.sobre ? posicion.get(p.sobre) : undefined;
      if (!destino) continue;
      const nuevo = p.id !== datos.foco.id && esNuevo(p.id);
      capas.hilos.push(`<path class="hilo${nuevo ? ' nuevo traza' : ''}" pathLength="1" d="${enlace({ x: p.x, y: g.eje + p.carril }, destino)}" ${atributos('registro', p.id, nuevo ? ` style="${retardo(p.id, 0.25)}"` : '')}/>`);
    }
    for (const p of pasado) {
      const nuevo = esNuevo(p.id);
      const clase = ['nodo', p.hilo ? 'en-hilo' : 'escrito', p.genesis ? 'genesis' : '', p.fase ? 'fase-' + p.fase : '', nuevo ? 'nuevo entra' : ''].filter(Boolean).join(' ');
      const forma = p.genesis
        ? `<rect class="marca" x="${-g.r}" y="${-g.r}" width="${2 * g.r}" height="${2 * g.r}" rx="2"/>`
        : `<circle class="marca" r="${g.r}"/>`;
      const rotulo = rotular(p.carril, p.x) ? `<text class="rotulo" y="${p.carril < 0 ? -g.r - 4 : g.r + 10}">${escapar(recorte(p.titulo, 12))}</text>` : '';
      capas.nodos.push(`<g transform="translate(${n1(p.x)} ${n1(g.eje + p.carril)})"><g class="${clase}" data-ir="${escapar(p.id)}" ${atributos('registro', p.id, nuevo ? ` style="${retardo(p.id)}"` : '')}>`
        + `<title>${escapar(`registro ${corto(p.id)} · ${p.autor} · ${p.titulo} · ${haceCuanto(p.delta, p.banda)}`)}</title>`
        + `<circle class="toque" r="${g.r + 7}"/>${forma}${rotulo}</g></g>`);
    }
    for (const [b, n] of sobran) {
      const i = BANDAS.indexOf(b);
      const x = CX - anchos.slice(0, i).reduce((s, w) => s + w, 0) - anchos[i] / 2;
      capas.nodos.push(`<g class="contador" transform="translate(${n1(x)} ${compacto ? 12 : 28})"><title>${n} registros más en la banda ${b}</title><text class="rotulo-contador">+${n}</text></g>`);
    }
  }

  // Foco: el registro en el presente, en la costura.
  const foco = `<g class="foco" transform="translate(${CX} ${g.eje})"><title>${escapar(`foco ${corto(datos.foco.id)} · ${datos.foco.autor} · ${datos.foco.titulo} · escrito ${haceCuanto(datos.foco.delta, datos.foco.banda)}`)}</title>`
    + `<circle class="anillo" r="${g.r + 4}"/><circle class="marca" r="${g.r - 1}"/>`
    + (compacto ? '' : `<text class="rotulo-foco" y="${g.r + 18}">${escapar(recorte(datos.foco.titulo, 22))}</text>`) + '</g>';

  // Futuro: arcos que salen del foco hacia sus bloques.
  const [bw, bh] = g.bloque;
  const arco = (x2, y2, curva = -22) => `M${CX} ${g.eje} Q${n1((CX + x2) / 2)} ${n1(Math.min(g.eje, y2) + curva)} ${n1(x2)} ${n1(y2)}`;
  const { colocados: futuro, sobran: sobranF } = encarrilar(
    datos.futuro.map((f) => ({ ...f, x: xFuturo(f.delta) })),
    g.carrilesFuturo, bw + 4,
  );
  if (verFuturo) {
    for (const f of futuro) {
      const y = g.eje + f.carril;
      const clave = f.tipo === 'consolidacion' ? 'consolidacion' : f.tipo === 'declarado' ? 'declarado' : 'proyeccion';
      const estado = f.estado ? ' ' + (f.estado === 'AUTORIZADO' ? 'autorizado' : 'pendiente') : '';
      const nuevo = esNuevo(f.id);
      const desc = f.tipo === 'consolidacion' ? `consolidación ${corto(f.id)} · ${f.autor} · ${f.titulo} · ${f.estado.toLowerCase()}`
        : f.tipo === 'declarado' ? `declarado en la posición 7 del foco · ${f.titulo}`
          : `proyección ${corto(f.id)} · ${f.autor} · ${f.titulo} · ${haceCuanto(f.delta, f.banda)}`;
      const rotulo = !rotular('f' + f.carril, f.x) ? '' : `<text class="rotulo" x="${n1(f.x + bw / 2)}" y="${n1(y + (f.carril < 0 ? -bh / 2 - 4 : bh / 2 + 10))}">${escapar(recorte(f.titulo, 12))}</text>`;
      let nudo = '';
      if (f.autorizacion) {
        const na = esNuevo(f.autorizacion.id);
        nudo = `<g transform="translate(${n1(f.x)} ${n1(y)})"><g class="nudo${na ? ' nuevo anuda' : ''}" ${atributos('autorizacion', f.autorizacion.id, na ? ` style="${retardo(f.autorizacion.id)}"` : '')}><title>${escapar(`autorizado por ${f.autorizacion.autor} · ${corto(f.autorizacion.id)}`)}</title><circle r="${compacto ? 4.5 : 3.5}"/></g></g>`;
      }
      capas.futuro.push(`<g class="futuro ${f.tipo}${estado}${nuevo ? ' nuevo proyecta' : ''}" data-ir="${escapar(f.id)}" ${atributos(clave, f.id, ` style="${origen}${nuevo ? ';' + retardo(f.id, 0.2) : ''}"`)}>`
        + `<title>${escapar(desc)}</title><path class="arco" pathLength="1" d="${arco(f.x, y)}"/>`
        + `<rect class="toque" x="${n1(f.x - 6)}" y="${n1(y - bh / 2 - 6)}" width="${bw + 12}" height="${bh + 12}"/>`
        + `<rect class="bloque" x="${n1(f.x)}" y="${n1(y - bh / 2)}" width="${bw}" height="${bh}" rx="2"/>${rotulo}</g>${nudo}`);
    }
    for (const [b, n] of sobranF) {
      const i = BANDAS.indexOf(b);
      const x = CX + anchos.slice(0, i).reduce((s, w) => s + w, 0) + anchos[i] / 2;
      capas.futuro.push(`<g class="contador" transform="translate(${n1(x)} ${compacto ? 12 : 28})"><title>${n} más en la banda ${b}</title><text class="rotulo-contador">+${n}</text></g>`);
    }
  }

  // Anclas: la ejecución suelta el arco del futuro y lo ancla en el hilo.
  for (const a of datos.anclas) {
    const ax = xPasado(a.delta);
    const nuevo = esNuevo(a.id);
    const fantasmaX = xFuturo(a.pendiente);
    const desc = `ejecutado ${corto(a.id)} · ${a.autor} · ${a.titulo} · ${haceCuanto(a.delta, a.banda)}`;
    let soltar = nuevo && verFuturo
      ? `<path class="suelta nuevo" pathLength="1" d="${arco(fantasmaX, g.eje + g.carrilesFuturo[0])}" style="${origen};${retardo(a.id)}" ${atributos('ejecucion', a.id)}/>`
      : '';
    // Si la consolidación también es nueva (reproducir), el arco primero se proyecta y después se suelta.
    if (soltar && esNuevo(a.consolidacion)) {
      soltar = `<g class="nuevo proyecta" style="${origen};${retardo(a.consolidacion, 0.2)}" ${atributos('consolidacion', a.consolidacion)}>${soltar}</g>`;
    }
    const anclar = verPasado
      ? `<g class="ancla${nuevo ? ' nuevo ancla-cae' : ''}" data-ir="${escapar(a.id)}" ${atributos('ejecucion', a.id, ` style="${origen}${nuevo ? ';' + retardo(a.id, 0.5) : ''}"`)}><title>${escapar(desc)}</title>`
        + `<path class="arco-anclado" pathLength="1" d="M${CX} ${g.eje} Q${n1((CX + ax) / 2)} ${n1(g.eje + (compacto ? 20 : 30))} ${n1(ax)} ${g.eje}"/>`
        + `<g transform="translate(${n1(ax)} ${g.eje})${compacto ? ' scale(1.5)' : ''}"><circle class="toque" r="${g.r + 6}"/><path class="simbolo-ancla" d="M0 -6V5M-4.5 1.5Q0 8 4.5 1.5M-2.5 -3.5H2.5"/></g></g>`
      : '';
    capas.anclas.push(soltar + anclar);
  }

  // Carteras y tokens (vista completa): cada movimiento de un evento nuevo, un punto de `de` a `a`.
  if (!compacto && ventana === 'todo') {
    const ids = datos.identidades;
    const izq = Math.ceil(ids.length / 2);
    const der = ids.length - izq;
    const sitio = new Map([[null, CX]]);
    ids.forEach((id, k) => {
      const x = k < izq
        ? g.margen + 18 + (izq === 1 ? (CX - 40 - g.margen - 18) / 2 : (k * (CX - 40 - g.margen - 18)) / (izq - 1))
        : CX + 40 + (der === 1 ? (W - g.margen - 18 - CX - 40) / 2 : ((k - izq) * (W - g.margen - 18 - CX - 40)) / (der - 1));
      sitio.set(id, x);
    });
    const y = g.carteras;
    for (const [id, x] of sitio) {
      capas.carteras.push(`<g class="cartera${id === null ? ' vacio' : ''}" transform="translate(${n1(x)} ${y})"><title>${escapar(id === null ? '∅: emitir (de nadie) o consumir (a nadie)' : 'cartera de ' + id)}</title><circle r="4"/><text class="rotulo" y="16">${escapar(id === null ? '∅' : recorte(id, 10))}</text></g>`);
    }
    const eventos = [];
    const vistos = new Set();
    const anotar = (id, movimientos, mas) => { if (esNuevo(id) && !vistos.has(id)) { vistos.add(id); eventos.push({ id, movimientos, mas }); } };
    for (const p of datos.pasado) anotar(p.id, p.movimientos, 0.6);
    for (const f of datos.futuro) {
      anotar(f.id, f.movimientos, 0.6);
      if (f.autorizacion) anotar(f.autorizacion.id, f.autorizacion.movimientos, 0.4);
    }
    for (const a of datos.anclas) anotar(a.id, a.movimientos, 1.3);
    let total = 0;
    for (const e of eventos) {
      e.movimientos.forEach((m, k) => {
        if (total >= 24) return;
        if (!sitio.has(m.de) || !sitio.has(m.a)) return;
        total += 1;
        const x1 = sitio.get(m.de);
        const dx = sitio.get(m.a) - x1;
        const serie = m.token === 'T' ? m.escala : m.token === 'E' ? m.denominacion : m.token === 'P' ? 'P' : 'R';
        capas.puntos.push(`<g transform="translate(${n1(x1)} ${y})"><g class="punto nuevo token-${m.token}" data-evento="${escapar(e.id)}" data-efecto="${escapar(nombreToken(m))}" data-de="${escapar(m.de ?? '∅')}" data-a="${escapar(m.a ?? '∅')}" style="--dx:${n1(dx)}px;${retardo(e.id, e.mas + k * 0.22)}">`
          + `<g class="sube"><circle r="4"/><text class="rotulo-punto" y="-7">${escapar(m.cantidad + ' ' + serie)}</text></g></g></g>`);
      });
    }
  }

  const caja = ventana === 'todo' ? `0 0 ${W} ${g.H}` : ventana === 'pasado' ? `0 0 ${CX} ${g.H}` : `${CX} 0 ${CX} ${g.H}`;
  const etiqueta = ventana === 'futuro'
    ? `Hilos del futuro: ${datos.totalFuturo} entre proyecciones, consolidaciones pendientes y lo declarado`
    : ventana === 'pasado' ? `Hilos del pasado: ${datos.totalPasado} registros` : `Hilos de ${corto(datos.foco.id)}: ${datos.totalPasado} en el pasado, ${datos.totalFuturo} en el futuro`;
  return `<svg class="hilos${compacto ? ' compacto' : ''}" viewBox="${caja}" role="img" aria-label="${escapar(etiqueta)}" data-ventana="${ventana}" xmlns="http://www.w3.org/2000/svg">`
    + `<g class="capa-bandas">${capas.bandas.join('')}</g>${eje}`
    + `<g class="capa-hilos">${capas.hilos.join('')}</g><g class="capa-anclas">${capas.anclas.join('')}</g>`
    + `<g class="capa-futuro">${capas.futuro.join('')}</g><g class="capa-nodos">${capas.nodos.join('')}</g>${foco}`
    + `<g class="capa-carteras">${capas.carteras.join('')}</g><g class="capa-puntos">${capas.puntos.join('')}</g></svg>`;
}

/** La vista «hilos» completa: el SVG, una leyenda y el botón para ver llegar el eje en su orden. */
export function htmlHilos(datos, opciones = {}) {
  const leyenda = [
    ['nodo', 'registro: entra por la izquierda'],
    ['hilo', 'hilo: aquello sobre lo que se escribió'],
    ['arco', 'arco al futuro: proyección o consolidación pendiente'],
    ['nudo', 'autorizado'],
    ['ancla', 'ancla: ejecutado'],
    ['punto', 'tokens de → a'],
  ];
  return `<figure class="hilos-vista">${svgHilos(datos, { ...opciones, ventana: 'todo', compacto: false })}`
    + `<figcaption class="hilos-leyenda">${leyenda.map(([c, t]) => `<span class="ley ley-${c}">${escapar(t)}</span>`).join('')}</figcaption>`
    + '<button class="hilos-reproducir" data-reproducir title="vuelve a contar como nuevo todo el eje: cada registro llega en su orden real">reproducir la llegada</button></figure>';
}
