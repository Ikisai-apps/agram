// La salida externa del PV9 y las opiniones como registros (docs/CONTRATO.md §16.6 y §12.7).
//
// Salida externa (VG: «descargo un markdown con el contexto, hablo fuera, vuelvo con un archivo y me enseña lo que
// propone para aceptarlo, rechazarlo o modificarlo»):
//   · exportar(): un markdown con las instrucciones de la guía (la cascada del 9: época, plantilla del foco, foco), el
//     contexto de la pantalla (guia.contexto) y, al final, «Cómo responder», que sale de la época (guide, posición 6);
//   · importar(): lee el archivo que vuelve (un .json, o un .md con un bloque ```json) y guarda las propuestas en
//     localStorage (`agram.propuestas.<alta|ejemplo>`) hasta que se aceptan o se rechazan;
//   · sugerenciasDe(): el gancho `sugerencias` de acciones.camino: cada propuesta entra en el camino como un paso de la
//     tercera fuente con su `porque`; pasa por acciones.transaccion, las reglas y la firma, así que no se asienta nada
//     sin que quien mira lo lance. Lo que no se entiende (acción desconocida, registro que no existe, parámetro que la
//     acción no pide) sale como propuesta inválida con su motivo, no se descarta en silencio.
//
// Opiniones como registros (VG: «que el feedback que yo lance se ancle en el proyecto AGRAM dentro de AGRAM y tú puedas
// leerlo»): con el ajuste «opinions anchor» (guide settings, posición 6), cada opinión guardada se escribe además como
// una transacción «anchor here» sobre ese registro con la décupla de la plantilla «opinion» de la época; si falla, la
// opinión queda solo en local. acciones.opiniones(eje, proyecto) las lee.
//
// Este módulo es PURO (sin DOM) y no lleva escrito ningún nombre de la época: la plantilla de la opinión y la
// transacción que la ancla las dice la guía (contrato.guia: posiciones 7 y 8), qué parámetro va en cada posición lo dice
// la plantilla de transacción (su `posicion`) y las etiquetas de la clasificación, la plantilla de la opinión.

import { contrato, acciones } from '../src/index.js';
import { contexto, instrucciones, ajustes } from './guia.js';
import { t } from './textos.js';

export const CLAVES = Object.freeze({ propuestas: (donde) => 'agram.propuestas.' + donde });
/** El tope del contexto de un archivo exportado (la guía manda 6000 a la IA; fuera de AGRAM cabe más). */
export const TOPE_EXPORTAR = 20000;

const hojas = (x) => (x === undefined || x === null ? [] : Array.isArray(x) ? x : [x]);
const esObjeto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const cadena = (x) => (typeof x === 'string' ? x : x === undefined || x === null ? '' : typeof x === 'object' ? JSON.stringify(x) : String(x));
const idiomaDe = (eje, yo, opciones) => opciones.idioma ?? contrato.configuracion(eje, yo, opciones).language ?? 'en';

// ---------- exportar ----------

/** Las acciones del aro con sus parámetros, para quien responde fuera: «nombre (PV k)» y, debajo, cada parámetro. */
function accionesConParametros(eje, X, yo, o) {
  const idioma = o.idioma;
  const lineas = [];
  for (let pv = 0; pv < 10; pv++) {
    for (const a of acciones.acciones(eje, X, pv, yo, o)) {
      const traducida = contrato.texto(eje, contrato.claves.plantilla(a.nombre), idioma, { original: a.nombre });
      lineas.push(`- ${a.nombre}${traducida !== a.nombre ? ` (${traducida})` : ''} · PV${pv}${a.lectura ? ' · ' + t('externaSoloLee') : ''}`);
      for (const p of a.parametros) lineas.push(`    · ${p.nombre}${p.etiqueta !== p.nombre ? ` (${p.etiqueta})` : ''} [${p.tipo}, ${t(p.requerido ? 'externaRequerido' : 'externaOpcional')}${p.valor !== undefined && p.valor !== null ? ', ' + t('externaPorDefecto') : ''}]${p.ayuda ? ': ' + p.ayuda : ''}`);
    }
  }
  return lineas;
}

/**
 * El archivo a descargar: agram-contexto-<fecha>.md con (1) las instrucciones de la guía (la cascada del 9: época →
 * plantilla del foco → foco, lo mismo que se manda a la IA), (2) el contexto de la pantalla (sin el tope de 6000 de la
 * guía: el de TOPE_EXPORTAR), las acciones con sus parámetros y (3) «Cómo responder», el texto que da la época.
 * `estado`: el de la carta ({ foco: { X, pv }, … }); `opciones`: { ancho, alto, cuenta, ahora, tope, epoca }.
 * → { nombre, tipo, contenido }.
 */
export async function exportar(estado, eje, yo, opciones = {}) {
  const X = typeof estado?.foco === 'string' ? estado.foco : estado?.foco?.X;
  const idioma = idiomaDe(eje, yo, opciones);
  const o = { ...opciones, idioma };
  const ahora = new Date(opciones.ahora ?? Date.now());
  const dia = ahora.toISOString().slice(0, 10);
  const base = contrato.guia(eje, idioma, o);
  const partes = [`# ${t('externaTitulo')} · ${dia}`, t('externaIntro', { foco: X ?? '' })];
  partes.push(`## ${t('externaInstrucciones')}`, instrucciones(eje, X, yo, o));
  partes.push(`## ${t('externaContexto')}`, await contexto(estado, eje, yo, { ...o, tope: opciones.tope ?? TOPE_EXPORTAR }));
  if (X && yo) {
    const lista = accionesConParametros(eje, X, yo, o);
    if (lista.length) partes.push(`## ${t('externaAcciones')}`, lista.join('\n'));
  }
  partes.push(`## ${t('externaComoResponder')}`, base?.respuesta ?? '');
  return { nombre: `agram-contexto-${dia}.md`, tipo: 'text/markdown', contenido: partes.filter((p) => p !== '').join('\n\n') + '\n' };
}

// ---------- importar ----------

/** El JSON de un texto: el texto entero, un bloque ```json (o ```) o lo que hay entre la primera llave y la última. → valor o undefined. */
function jsonDe(texto) {
  const probar = (s) => { try { return JSON.parse(s); } catch { return undefined; } };
  const entero = probar(texto.trim());
  if (entero !== undefined) return entero;
  for (const m of texto.matchAll(/```[ \t]*(?:json)?[ \t]*\r?\n([\s\S]*?)```/gi)) {
    const v = probar(m[1].trim());
    if (v !== undefined) return v;
  }
  const a = texto.indexOf('{');
  const b = texto.lastIndexOf('}');
  return a >= 0 && b > a ? probar(texto.slice(a, b + 1)) : undefined;
}

/**
 * Lee el archivo que vuelve de fuera: { "propuestas": [ { accion, sobre, parametros, porque } ] } (en un .json o en un
 * bloque json de un .md; también vale la lista sola). → { ok: true, propuestas: [{ id, accion, sobre, parametros,
 * porque, importada }] } con cada una tal como llegó (se entiende o no se decide al evaluarla), o { ok: false, motivo }.
 */
export function importar(texto, { ahora = Date.now() } = {}) {
  const v = jsonDe(String(texto ?? ''));
  const lista = Array.isArray(v) ? v : esObjeto(v) && Array.isArray(v.propuestas) ? v.propuestas : null;
  if (!lista) return { ok: false, motivo: t(v === undefined ? 'externaNoJson' : 'externaSinPropuestas') };
  const marca = new Date(ahora).toISOString();
  const base = Math.floor(ahora).toString(36);
  return {
    ok: true,
    propuestas: lista.map((p, i) => (esObjeto(p)
      ? { id: `${base}-${i}`, accion: p.accion, sobre: p.sobre, parametros: esObjeto(p.parametros) ? p.parametros : p.parametros === undefined ? {} : p.parametros, porque: typeof p.porque === 'string' ? p.porque : '', importada: marca }
      : { id: `${base}-${i}`, accion: undefined, sobre: undefined, parametros: {}, porque: '', crudo: cadena(p), importada: marca })),
  };
}

// ---------- el almacén (localStorage o algo igual; sin él, no se guarda) ----------

/** Las propuestas pendientes guardadas para una cuenta (su alta) o para el ejemplo. */
export function leerPropuestas(almacen, donde) {
  try {
    const l = JSON.parse(almacen?.getItem(CLAVES.propuestas(donde)) ?? '[]');
    return Array.isArray(l) ? l.filter(esObjeto) : [];
  } catch { return []; }
}
function escribir(almacen, donde, lista) {
  try {
    if (lista.length) almacen.setItem(CLAVES.propuestas(donde), JSON.stringify(lista));
    else almacen.removeItem(CLAVES.propuestas(donde));
    return true;
  } catch { return false; }
}
/** Añade propuestas a las pendientes; true si se pudo guardar. */
export const anadirPropuestas = (almacen, donde, nuevas) => escribir(almacen, donde, [...leerPropuestas(almacen, donde), ...nuevas]);
/** Quita una (aceptada o rechazada); true si se pudo guardar. */
export const quitarPropuesta = (almacen, donde, id) => escribir(almacen, donde, leerPropuestas(almacen, donde).filter((p) => p.id !== id));

// ---------- evaluar una propuesta ----------

/** La plantilla de transacción que nombra una propuesta: por su nombre canónico o por el de la persona (en su idioma), sin mayúsculas. */
function plantillaPorNombre(eje, nombre, o) {
  const buscado = cadena(nombre).trim().toLowerCase();
  if (!buscado) return null;
  return acciones.plantillasDeTransaccion(o).find((p) => p.nombre.toLowerCase() === buscado
    || contrato.texto(eje, contrato.claves.plantilla(p.nombre), o.idioma, { original: p.nombre }).toLowerCase() === buscado) ?? null;
}

/**
 * Lo que una propuesta quiere decir sobre este eje, para quien mira: { id, porque, valida, motivo, accion (el nombre
 * canónico, o lo que dijo), nombre (en el idioma), sobre (el id del registro o null), parametros (por su nombre
 * canónico, con los valores ya leídos), crudo }. Es inválida, con su motivo, si la acción no existe, el registro no está
 * en el libro, un parámetro no es de la acción o su valor no se lee con su tipo. No valida contra las reglas: eso lo hace
 * el camino con acciones.transaccion.
 */
export function evaluar(eje, yo, propuesta, opciones = {}) {
  const idioma = idiomaDe(eje, yo, opciones);
  const o = { ...opciones, idioma };
  const sobre = propuesta.sobre === undefined || propuesta.sobre === null ? null : acciones.registroDe(eje, cadena(propuesta.sobre), o);
  const base = { id: propuesta.id, porque: propuesta.porque ?? '', accion: cadena(propuesta.accion), nombre: cadena(propuesta.accion), sobre, parametros: {}, crudo: propuesta.crudo };
  const invalida = (motivo) => ({ ...base, valida: false, motivo });
  if (propuesta.crudo !== undefined) return invalida(t('externaNoEsUnaPropuesta', { que: propuesta.crudo }));
  const plantilla = plantillaPorNombre(eje, propuesta.accion, o);
  if (!plantilla) return invalida(t('externaAccionDesconocida', { accion: cadena(propuesta.accion) }));
  const canonico = plantilla.nombre;
  const dato = { ...base, accion: canonico, nombre: contrato.texto(eje, contrato.claves.plantilla(canonico), idioma, { original: canonico }) };
  if (propuesta.sobre === undefined || propuesta.sobre === null || propuesta.sobre === '') return { ...dato, valida: false, motivo: t('externaSinSobre') };
  if (!sobre) return { ...dato, valida: false, motivo: t('externaRegistroDesconocido', { sobre: cadena(propuesta.sobre) }) };
  const pedidos = acciones.parametros(plantilla.plantilla, o);
  const dados = esObjeto(propuesta.parametros) ? propuesta.parametros : {};
  const parametros = {};
  for (const [clave, valor] of Object.entries(dados)) {
    const k = clave.trim().toLowerCase();
    const p = pedidos.find((x) => x.nombre.toLowerCase() === k || x.etiqueta.toLowerCase() === k);
    if (!p) return { ...dato, valida: false, motivo: t('externaParametroDesconocido', { parametro: clave, accion: dato.nombre }) };
    if (typeof valor === 'string' && contrato.esTipoSimple(p.tipo, o)) {
      // Lo lee el núcleo con su tipo, como un formulario; un registro dicho por los primeros caracteres de su id también vale.
      let r = contrato.desdeLegible(valor, p.tipo, { eje, idioma, ...opciones });
      if (r.motivo) {
        const id = acciones.registroDe(eje, valor, o);
        const porId = id ? contrato.desdeLegible(id, p.tipo, { eje, idioma, ...opciones }) : null;
        if (porId && !porId.motivo) r = porId;
      }
      if (r.motivo) return { ...dato, valida: false, motivo: p.etiqueta + ': ' + r.motivo };
      if (r.valor !== undefined) parametros[p.nombre] = r.valor;
    } else parametros[p.nombre] = valor;
  }
  return { ...dato, valida: true, motivo: null, parametros };
}

/** Todas las propuestas pendientes, evaluadas. */
export const evaluarTodas = (eje, yo, propuestas, opciones = {}) => propuestas.map((p) => evaluar(eje, yo, p, opciones));

/**
 * El gancho `sugerencias` de acciones.camino: las propuestas pendientes que tratan del registro que se mira, como pasos
 * de la tercera fuente: { plantilla, sobre, parametros, porque, id } o, si no se entienden pero tratan de él,
 * { invalida: <motivo>, plantilla: <lo que dijo>, porque, id }. Las que tratan de otro registro (o de ninguno que exista)
 * no salen aquí: la carta las enseña en el panel de la guía.
 */
export function sugerenciasDe(propuestas, opciones = {}) {
  return (eje, ev, yo) => evaluarTodas(eje, yo, propuestas, opciones)
    .filter((e) => e.sobre === ev.id)
    .map((e) => (e.valida
      ? { plantilla: e.accion, sobre: e.sobre, parametros: e.parametros, porque: e.porque, id: e.id }
      : { invalida: e.motivo, plantilla: e.nombre, sobre: e.sobre, porque: e.porque, id: e.id }));
}

// ---------- las opiniones como registros ----------

/** Lo que de la opinión va a cada etiqueta de la clasificación de la plantilla, en su orden (type, pv, d, size, representation, mode, width, render). */
const CLASIFICACION = [
  (o) => o.nodo?.tipo, (o) => o.nodo?.pv, (o) => o.nodo?.d, (o) => o.nodo?.tamano, (o) => o.nodo?.representacion,
  (o) => o.modo, (o) => o.ancho, (o) => o.render,
];

/**
 * La décupla de la plantilla «opinion» para una opinión guardada (carta/opinar.js, nuevaOpinion), como los parámetros de
 * la transacción que la ancla: cada parámetro va por su posición (la de la plantilla: 0 el texto, 1 la clasificación
 * como ocupantes «etiqueta: valor», 5 el tipo, 6 la referencia al registro opinado, 7 la versión de la carta, 8 lo que
 * enseñaba lo tocado, 9 la ruta de ancestros). El registro opinado es el que se tocó o, si no era un registro, el que
 * estaba en foco. Una posición nunca queda vacía: la ruta (9) pide la 6, la 7 y la 8, y se rellenan con «-» las que
 * falten salvo la 6, sin la cual no se escribe lo de detrás. → { accion, parametros } o null si la época no trae la plantilla.
 */
export function parametrosDeOpinion(eje, opinion, opciones = {}) {
  const g = contrato.guia(null, 'en', opciones);
  const plantilla = g?.opinion && contrato.plantillas(eje, opciones).find((p) => p.nombre === g.opinion);
  const ancla = g?.ancla && acciones.plantillaDeTransaccion(g.ancla, opciones);
  if (!plantilla || !ancla) return null;
  const etiquetas = hojas(plantilla.registro[1]?.[9]).slice(0, -1).map(String);
  const clasificacion = etiquetas.map((e, i) => [e, CLASIFICACION[i]?.(opinion)]).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([e, v]) => `${e}: ${v}`);
  const porPosicion = new Map(acciones.parametros(ancla, opciones).map((p) => [p.posicion, p.nombre]));
  const sobre = [opinion.nodo?.X, opinion.foco?.X].find((x) => typeof x === 'string' && eje?.obtener(x));
  const ruta = (opinion.nodo?.ruta ?? []).filter((x) => typeof x === 'string' && x);
  const v = { 0: opinion.texto, 1: clasificacion, 5: plantilla.nombre, 6: sobre };
  if (sobre) {
    const visto = cadena(opinion.nodo?.texto);
    v[7] = cadena(opinion.version) || (visto || ruta.length ? '-' : undefined);
    v[8] = visto || (ruta.length ? '-' : undefined);
    v[9] = ruta.length ? ruta : undefined;
  }
  const parametros = {};
  for (const [pos, valor] of Object.entries(v)) {
    const nombre = porPosicion.get(pos);
    if (nombre && valor !== undefined && !(Array.isArray(valor) && !valor.length)) parametros[nombre] = valor;
  }
  return { accion: g.ancla, parametros };
}

/**
 * Escribe una opinión guardada como un registro anclado en el proyecto de `yo` (su ajuste «opinions anchor»), con
 * acciones.transaccion (las reglas), la firma de `firmar` y eje.anadir, como cualquier escritura (quema su T de minuto).
 * → { ok: true, id } si se asentó; { ok: false, sinAncla: true } si no hay ajuste (todo sigue como siempre: solo local);
 * { ok: false, motivo } si lo hay y no se pudo (sin T, reglas, el registro no existe): la opinión queda solo en local.
 */
export async function anclarOpinion(eje, yo, opinion, { firmar, ...opciones } = {}) {
  if (!eje || !yo) return { ok: false, sinAncla: true };
  const dicho = ajustes(eje, yo, opciones).ancla;
  if (!dicho) return { ok: false, sinAncla: true };
  const X = acciones.registroDe(eje, dicho, opciones);
  if (!X) return { ok: false, motivo: t('opinarAnclaNoExiste', { ancla: dicho }) };
  const p = parametrosDeOpinion(eje, opinion, opciones);
  if (!p) return { ok: false, motivo: t('opinarSinPlantilla') };
  try {
    const r = await acciones.transaccion(eje, p.accion, { X, ...p.parametros }, yo, { ...opciones, ...(typeof firmar === 'function' ? { firmar } : {}) });
    if (!r.ok || !r.evento) return { ok: false, motivo: r.motivos.map((m) => m.mensaje).join('; ') || t('opinarNoSePudo') };
    const asentado = await eje.anadir(r.evento);
    return { ok: true, id: asentado.id };
  } catch (e) {
    return { ok: false, motivo: String(e?.message ?? e).replace(/^evento (rechazado|mal formado): /, '') };
  }
}
