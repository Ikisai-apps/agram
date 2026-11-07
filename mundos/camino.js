// Mundo del camino (PV9): los pasos desde el foco hacia la acción.
//
// Sobrio y animado son dos renders de la misma lectura (mapa §10.3 [D]): el
// sobrio es la lista de pasos con sus botones; el animado, la misma lista
// con la senda dibujada encima (svgCamino). Los dos leen datosCamino(), que
// solo pregunta al núcleo: posiciones sin desarrollar (encaje.ocupantes),
// fórmulas pendientes (bql.evaluar), la propuesta (motor.proponer) y las
// consolidaciones con su estado (motor.consolidaciones / estadoDe). Nada
// simulado (mapa §10.2 [D]).
//
// Cada paso lleva su efecto nombrado por el catálogo (src/efectos.js): el
// efecto principal de la operación que daría el paso, en el mundo donde
// ocurre, y cómo lo ve el camino (verEn(·, 9)) cuando el catálogo lo dice.
//
// Botones:
// - «previsualizar» no escribe: corre la operación real del motor sobre una
//   COPIA del eje (reconstruida y validada evento a evento, como al cargar)
//   y enseña el evento que se escribiría, sus efectos y, si el motor la
//   rechaza, por qué. El eje no cambia.
// - «ejecutar» solo en una consolidación autorizada y para su autor (la
//   regla V0 del motor: ejecuta el autor). Al ejecutar, el paso se consolida
//   con animación al rehacer la vista, y el registro aparece en los hilos.
// - además, los que ya ofrece la fábrica: autorizar (quien tiene P y no es
//   el autor) y consolidar la propuesta; y «escribir aquí» para una
//   posición sin desarrollar (lleva a Pointed con esa posición elegida).
//
// [X] decidir VG (abierto en este mundo):
// - el catálogo nombra «previsualizar» a la consolidación vista desde el
//   camino (V3 PV9: controles «previsualizar» y «ejecutar»); aquí el botón
//   «previsualizar» NO consolida: es una lectura que no escribe;
// - qué paso resuelve una fórmula pendiente: hoy, añadir un ocupante en su
//   celda (corregir es añadir), con el efecto «sustituir» de su mundo;
// - el orden de la senda (desarrollar, fórmulas, propuesta, autorizar,
//   ejecutar; lo ejecutado al final, junto a la acción) y que se muestren
//   solo las tres últimas ejecuciones;
// - la previsualización de una posición sin desarrollar no lleva contenido
//   (lo pone quien escribe): dice dónde se anclaría y con qué efecto;
// - una propuesta que ya está consolidada (otra consolidación del mismo
//   foco y camino con el mismo contenido, en cualquier estado) no vuelve a
//   salir como paso: la senda sigue por esa consolidación hasta la acción.
//   Consolidarla otra vez se hace desde la fábrica;
// - la previsualización no enseña el id del registro que se escribiría: el
//   id sale de la hora en que se escriba, que todavía no existe.

import { direccion, esReferencia, indicesDe } from '../src/btml.js';
import { RAIZ } from '../src/evento.js';
import { PV } from '../src/epocas.js';
import { ocupantes } from '../src/encaje.js';
import { evaluar, esFormula, desescapar } from '../src/bql.js';
import * as motor from '../src/motor.js';
import { efectosDe, verEn, nombreMundo, sobrio as lineasDeEfectos, CATALOGO, MARCAS_EFECTO, SIN_NOMBRE } from '../src/efectos.js';
import { Eje } from '../src/eje.js';

/** Clases de paso, en el orden de la senda: del foco hacia la acción. */
export const TIPOS = Object.freeze(['desarrollar', 'formula', 'propuesta', 'autorizar', 'ejecutar']);

/** Cuántas ejecuciones se ven junto a la acción. */
export const DADOS = 3;

const ID_PREVISTO = '(previsto)';

// ---------- efectos de cada paso ----------

/** Un evento que todavía no existe, con lo justo para que el catálogo diga su efecto. No va al eje. */
function molde(sobre, en, payload, contexto = {}) {
  return { id: ID_PREVISTO, autor: null, sobre, en, t: null, movimientos: [], payload, contexto };
}

/** El efecto principal de una lista: la fase del motor si la hay; si no, la primera celda. */
function principal(lista, cual) {
  return cual === 'fase' ? lista.find((e) => e.tipo === 'fase') : lista.find((e) => e.tipo !== 'token' && e.tipo !== 'fase');
}

/** Lo que el camino cuenta de un efecto: su nombre en su mundo y, si lo declara, cómo lo ve el camino. */
export function describirEfecto(ef) {
  if (!ef) return null;
  const visto = verEn(ef, 9);
  return {
    tipo: ef.tipo, ...(ef.fase ? { fase: ef.fase } : {}), mundo: ef.mundo, mundoNombre: nombreMundo(ef.mundo), celda: ef.celda,
    nombre: ef.nombre, enCamino: visto?.nombre ?? null,
    decisiones: soloX(ef.decisiones), decisionesCamino: soloX(visto?.decisiones),
  };
}

/** Las marcas «[X] decidir VG» de una lista de decisiones del catálogo. */
const soloX = (lista) => [...new Set((lista ?? []).filter((d) => typeof d === 'string' && d.startsWith('[X]')))];

/**
 * El efecto de la fase que registraría un paso del motor, sin evento: el
 * catálogo solo reconoce la fase de un registro que ya está en el eje
 * (efectos.efectosDe), así que se nombra como lo nombraría allí: en la
 * fábrica del camino (el último dígito de `en`), con su marca de clase.
 */
function efectoFase(fase, en) {
  const mundo = indicesDe(en).at(-1) ?? 0;
  const ef = { tipo: 'fase', fase, mundo, celda: en };
  const propio = verEn(ef, mundo);
  const nombre = propio?.nombre ?? CATALOGO.tipos.fase.generico[fase];
  return describirEfecto({ ...ef, nombre, decisiones: [...(propio?.decisiones ?? [SIN_NOMBRE]), MARCAS_EFECTO.claseFase] });
}

function efectoDe(eje, ev, cual) {
  return describirEfecto(principal(efectosDe(eje, ev), cual));
}

// ---------- datos ----------

function payloadEn(payload, camino) {
  let p = payload;
  for (const i of camino) p = Array.isArray(p) ? p[i] : undefined;
  return p;
}

function textoDe(c) {
  if (c === undefined || c === null) return '';
  if (Array.isArray(c)) return c.length ? textoDe(c[0]) : '[ ]';
  if (esReferencia(c)) return '→ ' + String(c.ref).slice(0, 8);
  return String(desescapar(c));
}

const dirSegura = (indices) => (indices.length <= 10 ? direccion(indices) : null);

/** Texto canónico de un contenido (claves ordenadas): para comparar payloads sin depender del orden de las claves. */
function canonico(x) {
  if (Array.isArray(x)) return '[' + x.map(canonico).join(',') + ']';
  if (x && typeof x === 'object') return '{' + Object.keys(x).sort().map((k) => JSON.stringify(k) + ':' + canonico(x[k])).join(',') + '}';
  return JSON.stringify(x ?? null);
}

/**
 * Lo que motor.consolidar escribiría en el payload, sin el título, con las
 * elecciones de motor.proponer: un candidato es una referencia a su evento
 * en su dirección; una referencia o un terminal, tal cual; un hueco antes
 * de la última elección, una referencia al foco en esa posición. Sirve para
 * reconocer una propuesta que ya está consolidada; las pruebas comprueban
 * que coincide con lo que escribe el motor.
 */
export function contenidoPropuesto(foco, camino, elecciones) {
  const indices = Object.keys(elecciones).map(Number).sort((a, b) => a - b);
  if (!indices.length) return [];
  const forma = (e) => (Array.isArray(e) ? e.map(forma) : e && typeof e === 'object' && e.candidato ? { ref: e.candidato.evento, dir: e.candidato.dir ?? RAIZ } : e);
  const salida = [];
  for (let i = 1; i <= indices.at(-1); i++) salida.push(elecciones[i] === undefined ? { ref: foco, dir: direccion([...camino, i]) } : forma(elecciones[i]));
  return salida;
}

/** La consolidación (del foco y su camino) que ya tiene el contenido de la propuesta, o null. */
export function propuestaConsolidada(eje, foco, camino, elecciones) {
  const propuesto = canonico(contenidoPropuesto(foco, camino, elecciones));
  const c = motor.consolidaciones(eje, foco, camino).find((x) => canonico(eje.obtener(x.id).payload.slice(1)) === propuesto);
  return c ? { evento: c.id, estado: c.estado, titulo: textoDe(c.titulo) } : null;
}

/** Título de la consolidación que propone el camino: el mismo al previsualizar y al consolidar. */
export function tituloPropuesta(eje, foco, camino = []) {
  const ev = eje.obtener(foco);
  const p = payloadEn(ev.payload, camino);
  const t = textoDe(Array.isArray(p) ? p[0] : p) || String(foco).slice(0, 8);
  return 'Propuesta sobre ' + (t.length > 50 ? t.slice(0, 49) + '…' : t);
}

/**
 * Los pasos del foco hacia la acción, leídos del eje. No escribe.
 * Devuelve { foco, camino, identidad, titulo, pasos, dados, totalDados }:
 * - pasos, en el orden de TIPOS y numerados (n) desde 1:
 *   desarrollar (posición sin ocupantes: indices, celda), formula (fórmula
 *   del foco que no resuelve: formula, estado, motivo), propuesta (lo que
 *   propone motor.proponer: elecciones, origenes), autorizar y ejecutar
 *   (consolidaciones pendientes o autorizadas: evento, autor, estado,
 *   autorizacion); cada uno con `efecto` (describirEfecto) y `puede`
 *   ({ ejecutar, autorizar, consolidar, motivo }) para `identidad`;
 * - dados: las últimas DADOS consolidaciones ejecutadas (evento, ejecucion);
 * - propuestaConsolidada: si lo que propone motor.proponer ya está
 *   consolidado ({ evento, estado, titulo }), y entonces no hay paso
 *   «propuesta»; si no, null.
 */
export function datosCamino(eje, foco, { camino = [], identidad = null, maximoDados = DADOS } = {}) {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  const base = payloadEn(ev.payload, camino);
  const pasos = [];

  // Posiciones sin desarrollar: sin ocupantes (ni propios, ni alcanzados, ni escritos).
  for (let i = 0; i < 10 && camino.length < 10; i++) {
    const indices = [...camino, i];
    if (ocupantes(eje, foco, indices).length) continue;
    const celda = direccion(indices);
    pasos.push({
      clave: 'desarrollar:' + indices.join('.'), tipo: 'desarrollar', posicion: i, indices, celda,
      titulo: 'desarrollar ' + i + ' ' + PV[i], efecto: efectoDe(eje, molde(foco, celda, ''), 'celda'),
    });
  }

  // Fórmulas del foco que no resuelven.
  const formulas = new Set();
  const visitar = (nodo, indices) => {
    if (Array.isArray(nodo)) { nodo.forEach((h, k) => visitar(h, [...indices, k])); return; }
    if (!esFormula(nodo)) return;
    const r = evaluar(eje, foco, indices);
    if (r.estado === 'RESUELTO') return;
    const celda = dirSegura(indices);
    formulas.add(indices.join('.'));
    pasos.push({
      clave: 'formula:' + indices.join('.'), tipo: 'formula', indices, celda, formula: nodo, estado: r.estado, motivo: r.motivo ?? r.texto,
      titulo: 'fórmula ' + r.estado.toLowerCase() + ' en ' + indices.join('.'), efecto: celda ? efectoDe(eje, molde(foco, celda, ''), 'celda') : null,
    });
  };
  visitar(base, [...camino]);

  // La propuesta del operador B; lo que no puede proponer y no es una fórmula ya contada, también es un paso pendiente.
  const prop = motor.proponer(eje, foco, { camino });
  for (const p of prop.pendientes) {
    const indices = [...camino, p.posicion];
    if (formulas.has(indices.join('.'))) continue;
    const celda = direccion(indices);
    pasos.push({
      clave: 'formula:' + indices.join('.'), tipo: 'formula', indices, celda, formula: textoDe(payloadEn(ev.payload, indices)), estado: 'PENDIENTE', motivo: p.motivo,
      titulo: 'pendiente en ' + indices.join('.'), efecto: efectoDe(eje, molde(foco, celda, ''), 'celda'),
    });
  }
  const elecciones = Object.keys(prop.elecciones).length;
  const yaConsolidada = elecciones ? propuestaConsolidada(eje, foco, camino, prop.elecciones) : null;
  if (elecciones && !yaConsolidada) {
    const titulo = tituloPropuesta(eje, foco, camino);
    pasos.push({
      clave: 'propuesta', tipo: 'propuesta', titulo, elecciones, origenes: prop.origenes.map((o) => ({ ...o })),
      efecto: efectoFase('consolidado', direccion([...camino, 4])),
      puede: { consolidar: Boolean(identidad && eje.saldos.has(identidad)) },
    });
  }

  // Consolidaciones de la fábrica del foco: pendientes, autorizadas y ejecutadas.
  const dados = [];
  for (const c of motor.consolidaciones(eje, foco, camino)) {
    const titulo = textoDe(c.titulo);
    if (c.estado === 'EJECUTADO') {
      const x = eje.sobre(c.id, motor.FABRICA).find((h) => h.contexto?.fase === 'ejecutado' && h.autor === c.autor);
      dados.push({ clave: 'dado:' + c.id, tipo: 'dado', evento: c.id, ejecucion: x?.id ?? null, autor: c.autor, t: x?.t ?? c.t, titulo, efecto: x ? efectoDe(eje, x, 'fase') : null });
      continue;
    }
    const pendiente = c.estado === 'PENDIENTE DE AUTORIZACIÓN';
    const aut = pendiente ? null : motor.autorizacionesValidas(eje, c.id)[0];
    const tipo = pendiente ? 'autorizar' : 'ejecutar';
    const efecto = pendiente
      ? efectoFase('autorizado', motor.FABRICA)
      : efectoFase('ejecutado', motor.FABRICA);
    const ejecutar = !pendiente && identidad === c.autor;
    const autorizar = pendiente && Boolean(identidad) && motor.puedeAutorizar(eje, identidad, c.id);
    const motivo = pendiente
      ? 'falta autorizar: autoriza quien no es su autor (' + c.autor + ') y tiene P sobre un registro del hilo que ' + c.autor + ' no escribió'
      : ejecutar ? '' : 'ejecuta su autor: ' + c.autor;
    pasos.push({
      clave: tipo + ':' + c.id, tipo, evento: c.id, autor: c.autor, t: c.t, estado: c.estado, titulo,
      autorizacion: aut ? { id: aut.id, autor: aut.autor } : null, efecto, puede: { ejecutar, autorizar, motivo },
    });
  }

  const orden = (p) => TIPOS.indexOf(p.tipo);
  const ordenados = pasos.map((p, i) => [p, i]).sort((a, b) => orden(a[0]) - orden(b[0]) || a[1] - b[1]).map(([p], i) => ({ ...p, n: i + 1 }));
  return {
    foco, camino: [...camino], identidad, titulo: textoDe(Array.isArray(base) ? base[0] : base) || String(foco).slice(0, 8),
    pasos: ordenados, dados: dados.slice(-maximoDados), totalDados: dados.length, propuestaConsolidada: yaConsolidada,
  };
}

// ---------- previsualizar: la operación real sobre una copia ----------

/** Copia del eje, reconstruida y validada evento a evento (como al cargar). Lo que se escriba en ella no toca el original. */
export async function copiar(eje) {
  return Eje.desde(eje.orden.map((id) => eje.obtener(id)), { exigirFirmas: eje.exigirFirmas });
}

/**
 * Quién daría el paso: ejecuta el autor de la consolidación; autoriza quien
 * mira si puede y, si no, la primera identidad que puede; lo demás, quien mira.
 */
export function actorDe(eje, paso, identidad) {
  if (paso.tipo === 'ejecutar') return paso.autor;
  if (paso.tipo === 'autorizar') {
    if (identidad && motor.puedeAutorizar(eje, identidad, paso.evento)) return identidad;
    return eje.identidades().find((i) => motor.puedeAutorizar(eje, i, paso.evento)) ?? identidad;
  }
  return identidad;
}

const OPERACION = Object.freeze({ desarrollar: 'escribir', formula: 'escribir', propuesta: 'consolidar', autorizar: 'autorizar', ejecutar: 'ejecutar' });

/**
 * Previsualiza el paso `clave` de datosCamino() sin escribir en el eje. Para propuesta, autorizar y
 * ejecutar corre la operación del motor sobre una copia (copiar) con la
 * clave de quien lo daría (actorDe; `privadaDe(identidad)` da su clave
 * privada, si la hay) y devuelve el evento que se escribiría y sus efectos;
 * si el motor la rechaza, el error. Para una posición sin desarrollar o una
 * fórmula pendiente no hay contenido que escribir: devuelve dónde se
 * anclaría y con qué efecto, y la evaluación de la fórmula.
 * → { clave, tipo, operacion, como, escribe: false, efectos, lineas,
 *     evento?, error?, nota? }
 */
export async function previsualizar(eje, datos, clave, { identidad = datos.identidad, privadaDe = () => undefined, t = new Date().toISOString() } = {}) {
  const paso = datos.pasos.find((p) => p.clave === clave);
  if (!paso) throw new Error('paso desconocido: ' + clave);
  const { foco, camino } = datos;
  const como = actorDe(eje, paso, identidad);
  const comun = { clave: paso.clave, tipo: paso.tipo, operacion: OPERACION[paso.tipo], como, escribe: false };
  if (paso.tipo === 'desarrollar' || paso.tipo === 'formula') {
    if (!paso.celda) return { ...comun, efectos: [], lineas: '', nota: 'más de diez profundidades: no hay celda donde escribir' };
    const efectos = efectosDe(eje, molde(foco, paso.celda, ''));
    const nota = paso.tipo === 'desarrollar'
      ? 'El contenido lo pone quien escribe (Pointed, en ' + paso.indices.join('.') + '): se anclaría en ' + paso.celda + ' y movería un minuto de T por posición escrita.'
      : 'La fórmula ' + paso.formula + ' está ' + String(paso.estado).toLowerCase() + ': ' + paso.motivo + '. Corregir es añadir: un ocupante nuevo en ' + paso.celda + '.';
    return { ...comun, efectos, lineas: lineasDeEfectos(efectos, { detalle: true }), nota };
  }
  if (!['propuesta', 'autorizar', 'ejecutar'].includes(paso.tipo)) throw new Error('paso sin previsualización: ' + paso.tipo);
  const copia = await copiar(eje);
  let ev;
  try {
    if (paso.tipo === 'propuesta') {
      const prop = motor.proponer(copia, foco, { camino });
      ev = await motor.consolidar(copia, { autor: como, foco, camino, elecciones: prop.elecciones, titulo: tituloPropuesta(copia, foco, camino), t }, privadaDe(como));
    } else if (paso.tipo === 'autorizar') {
      ev = await motor.autorizar(copia, { autorizante: como, consolidacion: paso.evento, t }, privadaDe(como));
    } else {
      ev = await motor.ejecutar(copia, { autor: como, consolidacion: paso.evento, t }, privadaDe(como));
    }
  } catch (e) {
    return { ...comun, efectos: [], lineas: '', error: String(e.message ?? e).replace(/^evento (rechazado|mal formado): /, '') };
  }
  const efectos = efectosDe(copia, ev);
  const { id, autor, sobre, en, movimientos, payload, contexto } = ev;
  return { ...comun, evento: { id, autor, sobre, en, t: ev.t, movimientos, payload, contexto }, efectos, lineas: lineasDeEfectos(efectos, { detalle: true }) };
}

// ---------- render: SVG como texto ----------

function escapar(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const n1 = (x) => Math.round(x * 10) / 10;
const corto = (id) => String(id).slice(0, 8);
const recorte = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function geometria(compacto) {
  return compacto
    ? { W: 200, xs: [25, 75, 125, 175], filaH: 40, y0: 22, s: 6, curva: 18, maximo: 12, rotulo: false }
    : { W: 400, xs: [52, 149, 246, 343], filaH: 70, y0: 30, s: 9, curva: 34, maximo: Infinity, rotulo: true };
}

/** Los nodos de la senda: el foco, los pasos, lo ejecutado y la acción. En la celda, lo que no cabe va a un contador. */
function nodos(datos, g) {
  const medio = [...datos.pasos, ...datos.dados];
  let lista = [{ tipo: 'foco', clave: 'foco' }, ...medio, { tipo: 'meta', clave: 'meta' }];
  if (lista.length > g.maximo) {
    const caben = g.maximo - 3;
    lista = [lista[0], ...medio.slice(0, caben), { tipo: 'mas', clave: 'mas', n: medio.length - caben }, lista.at(-1)];
  }
  return lista.map((x, p) => {
    const fila = Math.floor(p / g.xs.length);
    const col = p % g.xs.length;
    return { ...x, fila, x: fila % 2 ? g.xs[g.xs.length - 1 - col] : g.xs[col], y: g.y0 + fila * g.filaH };
  });
}

/** La senda: rectas dentro de una fila y una curva hacia fuera al cambiar de fila. */
function senda(ps, g) {
  if (!ps.length) return '';
  let d = `M${n1(ps[0].x)} ${n1(ps[0].y)}`;
  for (let i = 1; i < ps.length; i++) {
    const a = ps[i - 1];
    const b = ps[i];
    if (a.fila === b.fila) d += ` L${n1(b.x)} ${n1(b.y)}`;
    else {
      const lado = a.fila % 2 ? -1 : 1;
      d += ` C${n1(a.x + lado * g.curva)} ${n1(a.y)} ${n1(b.x + lado * g.curva)} ${n1(b.y)} ${n1(b.x)} ${n1(b.y)}`;
    }
  }
  return d;
}

function piedra(tipo, s) {
  const cuadro = (rx) => `<rect class="piedra" x="${-s}" y="${-s}" width="${2 * s}" height="${2 * s}" rx="${rx}"/>`;
  switch (tipo) {
    case 'foco': return `<circle class="anillo-foco" r="${s + 3}"/><circle class="marca-foco" r="${s - 2}"/>`;
    case 'desarrollar': return `<circle class="piedra" r="${s}"/>`;
    case 'formula': return `<path class="piedra" d="M0 ${-s - 1}L${s + 1} 0L0 ${s + 1}L${-s - 1} 0Z"/>`;
    case 'propuesta': return cuadro(s / 2);
    case 'autorizar': return cuadro(2);
    case 'ejecutar': return cuadro(2) + `<circle class="nudo" cx="${s}" cy="${-s}" r="${Math.max(2.5, s / 3)}"/>`;
    case 'dado': return cuadro(2) + `<path class="simbolo-ancla" transform="scale(${n1(s / 9)})" d="M0 -5.5V5M-4.2 1.4Q0 7.5 4.2 1.4M-2.4 -3.2H2.4"/>`;
    case 'meta': return `<path class="mastil" d="M${-s / 2} ${s}V${-s - 2}"/><path class="bandera" d="M${-s / 2} ${-s - 2}L${s + 2} ${-s / 2}L${-s / 2} 1Z"/>`;
    default: return '';
  }
}

const NOMBRE_TIPO = Object.freeze({
  desarrollar: 'sin desarrollar', formula: 'fórmula pendiente', propuesta: 'propuesta', autorizar: 'consolidado: falta autorizar',
  ejecutar: 'autorizado: falta ejecutar', dado: 'ejecutado',
});

function nombreEfecto(paso) {
  return paso.efecto ? paso.efecto.enCamino ?? paso.efecto.nombre : '';
}

/**
 * El SVG de la senda, como texto. Función pura: no toca el DOM ni el eje.
 *   datos: lo que devuelve datosCamino().
 *   compacto: para la celda 9 de Mapped (sin rótulos; lo que no cabe, en un contador).
 *   nuevos: Set de ids de evento nuevos para quien mira (hilos.memoria().nuevos):
 *     una consolidación nueva aparece, una autorización nueva anuda y una
 *     ejecución nueva consolida su paso.
 *   previsto: clave del paso que se está previsualizando: se marca quieto
 *     (un anillo discontinuo), porque previsualizar no escribe nada.
 */
export function svgCamino(datos, { compacto = false, nuevos = new Set(), previsto = null } = {}) {
  const g = geometria(compacto);
  const ps = nodos(datos, g);
  const filas = ps.length ? ps.at(-1).fila + 1 : 1;
  const H = compacto ? 124 : g.y0 + (filas - 1) * g.filaH + 40;
  const d = senda(ps, g);
  let retardo = 0;
  const conRetardo = () => `--retardo:${(retardo++ * 0.35).toFixed(2)}s`;
  const grupos = ps.map((p) => {
    const clases = ['paso', 'tipo-' + p.tipo];
    const attrs = [];
    let estilo = '';
    let extra = '';
    if (p.tipo === 'foco') {
      attrs.push(`data-mundo="5"`);
    } else if (p.tipo === 'meta') {
      attrs.push(`data-mundo="4"`);
    } else if (p.tipo !== 'mas') {
      attrs.push(`data-paso="${escapar(p.clave)}"`);
      if (p.efecto) attrs.push(`data-efecto="${escapar(nombreEfecto(p))}"`, `data-mundo="${p.efecto.mundo}"`);
      const decisiones = p.efecto ? (p.efecto.enCamino ? p.efecto.decisionesCamino : p.efecto.decisiones) : [];
      if (decisiones.length) attrs.push(`data-decision="${escapar(decisiones.join(' | '))}"`);
      if (p.evento) attrs.push(`data-evento="${escapar(p.evento)}"`);
      if (p.tipo === 'dado') { if (p.ejecucion) attrs.push(`data-ir="${escapar(p.ejecucion)}"`); } else attrs.push(`data-previsualizar="${escapar(p.clave)}"`);
      if (p.tipo === 'dado' && p.ejecucion && nuevos.has(p.ejecucion)) {
        clases.push('nuevo', 'consolida');
        estilo = conRetardo();
        extra = `<circle class="onda" r="${g.s + 2}"/>`;
      } else if (p.evento && nuevos.has(p.evento)) {
        clases.push('nuevo', 'aparece');
        estilo = conRetardo();
      }
      if (p.tipo === 'ejecutar' && p.autorizacion && nuevos.has(p.autorizacion.id)) clases.push('anuda');
      if (previsto && p.clave === previsto) {
        clases.push('previsto');
        extra += `<circle class="marca-previa" r="${g.s + 5}"/>`;
      }
    }
    const titulo = p.tipo === 'foco' ? `foco ${corto(datos.foco)} · ${datos.titulo}`
      : p.tipo === 'meta' ? `la acción · ${datos.totalDados} ejecutada${datos.totalDados === 1 ? '' : 's'} sobre este foco`
        : p.tipo === 'mas' ? `${p.n} pasos más: en la cruz`
          : `${p.n ? p.n + '. ' : ''}${p.titulo} · ${NOMBRE_TIPO[p.tipo]}${p.efecto ? ' · efecto: ' + p.efecto.nombre + ' (' + p.efecto.mundoNombre + ')' + (p.efecto.enCamino ? ' · en el camino: ' + p.efecto.enCamino : '') : ''}`;
    let rotulo = '';
    if (g.rotulo) {
      const texto = p.tipo === 'foco' ? 'foco' : p.tipo === 'meta' ? 'acción' : p.tipo === 'mas' ? '' : recorte(p.titulo, 16);
      rotulo = `<text class="rotulo" y="${g.s + 14}">${escapar(texto)}</text>`;
      if (p.n) rotulo += `<text class="num" y="3.2">${p.n}</text>`;
      if (p.tipo !== 'foco' && p.tipo !== 'meta' && p.tipo !== 'mas' && p.efecto) rotulo += `<text class="rotulo-efecto" y="${g.s + 24}">${escapar(recorte(nombreEfecto(p), 18))}</text>`;
      if (p.tipo === 'meta' && datos.totalDados) rotulo += `<text class="rotulo-efecto" y="${g.s + 24}">${datos.totalDados} hecha${datos.totalDados === 1 ? '' : 's'}</text>`;
    }
    const mas = p.tipo === 'mas' ? `<text class="rotulo-contador" y="3">+${p.n}</text>` : '';
    const toque = p.tipo === 'mas' ? '' : `<circle class="toque" r="${g.s + 8}"/>`;
    return `<g transform="translate(${n1(p.x)} ${n1(p.y)})"><g class="${clases.join(' ')}" ${attrs.join(' ')}${estilo ? ` style="${estilo}"` : ''}><title>${escapar(titulo)}</title>${toque}${extra}${piedra(p.tipo, g.s)}${mas}${rotulo}</g></g>`;
  });
  const total = datos.pasos.length;
  const etiqueta = `Camino de ${corto(datos.foco)}: ${total} paso${total === 1 ? '' : 's'} hacia la acción, ${datos.totalDados} ejecutado${datos.totalDados === 1 ? '' : 's'}`;
  return `<svg class="camino${compacto ? ' compacto' : ''}" viewBox="0 0 ${g.W} ${H}" role="img" aria-label="${escapar(etiqueta)}" xmlns="http://www.w3.org/2000/svg">`
    + `<path class="suelo" d="${d}"/><path class="linea" d="${d}"/>${grupos.join('')}</svg>`;
}

// ---------- vistas ----------

function botonesDe(p, identidad) {
  const b = [];
  if (p.tipo !== 'dado') b.push(`<button class="accion-sec" data-previsualizar="${escapar(p.clave)}">previsualizar</button>`);
  if (p.tipo === 'desarrollar') b.push(`<button class="accion-sec" data-posicion="${p.posicion}" data-escribir-en>escribir aquí</button>`);
  if (p.tipo === 'propuesta') {
    b.push(p.puede?.consolidar
      ? `<button class="accion" data-consolidar-propuesta>consolidar como ${escapar(identidad)}</button>`
      : '<button class="accion" disabled title="elige quién consolida">consolidar</button>');
  }
  if (p.tipo === 'autorizar' && p.puede?.autorizar) b.push(`<button class="accion" data-autorizar="${escapar(p.evento)}">autorizar como ${escapar(identidad)}</button>`);
  if (p.tipo === 'autorizar' || p.tipo === 'ejecutar') {
    b.push(p.puede?.ejecutar
      ? `<button class="accion" data-ejecutar="${escapar(p.evento)}">ejecutar como ${escapar(identidad)}</button>`
      : `<button class="accion" disabled title="${escapar(p.puede?.motivo ?? '')}">ejecutar</button>`);
  }
  return b.join('');
}

function htmlEfecto(e) {
  if (!e) return '';
  const marcas = [...new Set([...e.decisiones, ...e.decisionesCamino])];
  const marca = marcas.length ? ` <span class="decidir" title="${escapar(marcas.join(' | '))}">[X]</span>` : '';
  const camino = e.enCamino && e.enCamino !== e.nombre ? ` · en el camino: <b>${escapar(e.enCamino)}</b>` : '';
  return `<div class="paso-efecto">efecto: <b>${escapar(e.nombre)}</b> · ${escapar(e.mundoNombre)} (${e.mundo})${camino}${marca}</div>`;
}

/** El panel de una previsualización: lo que se escribiría, sus efectos (render sobrio del catálogo) o por qué no. */
export function htmlPrevia(previa) {
  if (!previa) return '';
  const cab = `<div class="previa-cab">previsualización · ${escapar(previa.operacion)}${previa.como ? ' como ' + escapar(previa.como) : ''} · no se ha escrito nada</div>`;
  const error = previa.error ? `<div class="aviso">el motor lo rechazaría: ${escapar(previa.error)}</div>` : '';
  const lineas = previa.lineas ? `<ul class="previa-efectos">${previa.lineas.split('\n').map((l) => `<li>${escapar(l)}</li>`).join('')}</ul>` : '';
  const ev = previa.evento;
  const evento = ev ? `<div class="previa-evento">se escribiría un registro de <b>${escapar(ev.autor)}</b> sobre ${corto(ev.sobre)} en ${escapar(ev.en)} (su id sale de la hora en que se escriba) · mueve ${escapar(ev.movimientos.map((m) => m.cantidad + ' ' + m.token + (m.escala ? ':' + m.escala : m.denominacion ? ':' + m.denominacion : '') + ' ' + (m.de ?? '∅') + '→' + (m.a ?? '∅')).join(', ') || 'nada')}<pre>${escapar(JSON.stringify(ev.payload))}</pre></div>` : '';
  const nota = previa.nota ? `<div class="pista">${escapar(previa.nota)}</div>` : '';
  return `<div class="previa" role="status">${cab}${error}${lineas}${evento}${nota}</div>`;
}

function tarjeta(p, { identidad, previa, nuevos }) {
  const clases = ['paso-c', 'tipo-' + p.tipo];
  if (p.tipo === 'dado' && p.ejecucion && nuevos.has(p.ejecucion)) clases.push('nuevo');
  const detalle = p.tipo === 'formula' ? `<div class="paso-detalle"><code>${escapar(p.formula)}</code> · ${escapar(p.motivo)}</div>`
    : p.tipo === 'propuesta' ? `<div class="paso-detalle">${p.origenes.map((o) => `${o.posicion} ${escapar(PV[o.posicion])}: ${escapar(recorte(String(o.texto), 40))}`).join(' · ')}</div>`
      : p.tipo === 'autorizar' || p.tipo === 'ejecutar' ? `<div class="paso-detalle"><button class="enlace" data-ir="${escapar(p.evento)}">${corto(p.evento)}</button> de ${escapar(p.autor)}${p.autorizacion ? ' · autorizado por ' + escapar(p.autorizacion.autor) : ''}</div>`
        : p.tipo === 'dado' ? `<div class="paso-detalle">${p.ejecucion ? `<button class="enlace" data-ir="${escapar(p.ejecucion)}">${corto(p.ejecucion)}</button> ` : ''}ejecutado por ${escapar(p.autor)}</div>`
          : `<div class="paso-detalle">celda ${escapar(p.celda)}</div>`;
  const abierta = previa && previa.clave === p.clave ? htmlPrevia(previa) : '';
  return `<li class="${clases.join(' ')}" data-clave="${escapar(p.clave)}"><div class="paso-cab"><span class="paso-n">${p.n ?? '✓'}</span><b>${escapar(p.titulo)}</b><span class="paso-tipo">${NOMBRE_TIPO[p.tipo]}</span></div>`
    + `${detalle}${htmlEfecto(p.efecto)}<div class="paso-acciones">${botonesDe(p, identidad)}</div>${abierta}</li>`;
}

/**
 * La vista del camino: quién mira, la senda (solo en el render animado) y la
 * lista de pasos con sus botones (los dos renders). `identidades` llena el
 * selector de quién; `previa` es una previsualización hecha (previsualizar).
 */
export function htmlCamino(datos, { animado = true, nuevos = new Set(), previa = null, identidades = [] } = {}) {
  const como = identidades.length
    ? `<label class="como">como <select name="identidad">${identidades.map((i) => `<option${i === datos.identidad ? ' selected' : ''}>${escapar(i)}</option>`).join('')}</select></label>`
    : '';
  const hecha = datos.propuestaConsolidada
    ? `<div class="propuesta-hecha">la propuesta del foco ya está consolidada: <button class="enlace" data-ir="${escapar(datos.propuestaConsolidada.evento)}">${corto(datos.propuestaConsolidada.evento)}</button> ${escapar(datos.propuestaConsolidada.titulo)} · ${escapar(datos.propuestaConsolidada.estado.toLowerCase())}; consolidarla otra vez, desde la fábrica <span class="decidir" title="[X] decidir VG: una propuesta ya consolidada no vuelve a salir como paso">[X]</span></div>`
    : '';
  const lista = datos.pasos.length
    ? `<ol class="pasos-camino">${datos.pasos.map((p) => tarjeta(p, { identidad: datos.identidad, previa, nuevos })).join('')}</ol>`
    : '<div class="nada">ningún paso pendiente desde este foco</div>';
  const hechos = datos.dados.length
    ? `<div class="titulo-hechos">junto a la acción · ${datos.totalDados} ejecutada${datos.totalDados === 1 ? '' : 's'}${datos.totalDados > datos.dados.length ? ', las ' + datos.dados.length + ' últimas' : ''}</div><ol class="pasos-camino hechos">${datos.dados.map((p) => tarjeta(p, { identidad: datos.identidad, previa, nuevos })).join('')}</ol>`
    : '';
  return `<section class="camino-vista"><div class="camino-cab"><span class="titulo">desde el foco hacia la acción · ${datos.pasos.length} paso${datos.pasos.length === 1 ? '' : 's'}</span>${como}</div>`
    + (animado ? svgCamino(datos, { nuevos, previsto: previa?.clave ?? null }) : '')
    + hecha + lista + hechos
    + '<div class="pista">«previsualizar» no escribe: corre la operación real sobre una copia del eje. «ejecutar» solo si está autorizado y lo pide su autor.</div></section>';
}
