// La guía del PV9 (solo lectura): preguntar a Claude con el contexto exacto de la pantalla. El 9 es donde se enchufa
// una IA y la carta funciona sin ella; la guía responde «qué estoy viendo, qué significa, qué viene después» y no cambia
// nada. docs/CONTRATO.md §16.
//
// Este módulo es PURO (sin DOM; se prueba en test/guia.test.js) y no lleva escrito nada de lo que dice la guía:
//   · las instrucciones son DATO de la época: el registro «guide» del 9.9 (papel, resumen de AGRAM, normas, preguntas
//     hechas), que da contrato.guia(); y, detrás, lo que haya escrito en el 9 de la plantilla del foco y en el 9 del
//     propio foco, leído en humano: es el CLAUDE.md por tipo y por registro («la guía empieza leyendo en el 9»);
//   · el contexto de cada pregunta lo construye contexto(): lo que la carta de texto (carta/texto.js) y el núcleo dan
//     de lo que hay en pantalla, con un tope y diciendo qué recorta;
//   · la configuración (modelo, vía, historial, tope) es un registro de la plantilla «guide settings» de la época
//     (contrato.configuracionGuia); la clave de la API NUNCA va en el eje, solo en localStorage (CLAVES.ia).
//
// Dos vías de llamada:
//   «server» (preferida)  POST {sync url}/guia con X-Clave-Lectura (la del libro compartido): la clave de Anthropic vive
//                         en el servidor (servidor/supabase/funciones/guia).
//   «direct» (provisional) la carta llama a la API de Anthropic desde el navegador con la clave guardada aquí.

import { contrato, acciones, leer, leerEvento, sincronia, direccion } from '../src/index.js';
import { MEDIDAS } from './carta.js';
import { pintar } from './texto.js';
import { t } from './textos.js';

/** Las claves de localStorage de la guía, por alta: la clave de la API (un secreto: no entra en el eje ni en la copia) y la conversación. */
export const CLAVES = Object.freeze({ ia: (alta) => 'agram.ia.' + alta, historial: (alta) => 'agram.guia.' + alta });
/** La API de mensajes a la que llama la vía directa (la pública del proveedor; se puede cambiar en las opciones). */
export const API_DIRECTA = 'https://api.anthropic.com/v1/messages';
export const VERSION_API = '2023-06-01';
export const MAX_TOKENS = 800;
/** Lo que no viene de la época por si falta el registro de ajustes (el defecto de la época manda). */
const RESPALDO = Object.freeze({ historial: 20, contexto: 6000, via: 'server', modelo: 'claude-sonnet-5-5' });
/** Cuánto de cada mensaje del historial se manda (el servidor admite 2000). */
const MENSAJE_MAXIMO = 1500;
/** El peso de cada bloque del contexto en el reparto del tope (caracteres, a tope 6600; se reescala al tope pedido). */
const PESOS = Object.freeze({ modo: 300, yo: 300, foco: 1800, carta: 1800, camino: 900, aro: 600, diario: 600, config: 300 });

const recortar = (texto, n) => (texto.length <= n ? texto : texto.slice(0, Math.max(0, n - 1)).trimEnd() + '…');
const corto = (id) => String(id ?? '').slice(0, 8);

/** Las posiciones de la plantilla de ajustes de la guía (docs/CONTRATO.md §16): las etiquetas son de la época, las posiciones son el contrato. */
const POSICION = Object.freeze({ modelo: 1, via: 2, historial: 3, contexto: 4 });

/** Los ajustes de la guía de quien mira, con los números como números: { modelo, via, historial, contexto, de }. */
export function ajustes(eje, yo, opciones = {}) {
  const c = contrato.configuracionGuia(eje, yo, opciones);
  const claves = contrato.clavesDeConfiguracionDe(contrato.ajustesDeLaGuia(opciones), opciones);
  const de = (pos) => c[claves.find((x) => x.pv === pos)?.clave];
  const n = (v, defecto) => (typeof v === 'number' && v > 0 ? Math.floor(v) : defecto);
  return {
    modelo: typeof de(POSICION.modelo) === 'string' && de(POSICION.modelo) ? de(POSICION.modelo) : RESPALDO.modelo,
    via: de(POSICION.via) === 'direct' ? 'direct' : 'server',
    historial: n(de(POSICION.historial), RESPALDO.historial),
    contexto: n(de(POSICION.contexto), RESPALDO.contexto),
    de: c.de ?? null,
  };
}

/**
 * La candidata de los ajustes de la guía de `yo` con los valores dados sobre los actuales, para escribirla como un
 * registro más anclado en el 9 de su alta (como carta.preferencias para las preferencias): { payload, sobre, en,
 * campos: [{ clave, etiqueta, ayuda, valor, numero }], cambiado } o null si yo no tiene alta. `cambiado`: los
 * valores dados difieren de los actuales (si no, no hay nada que escribir).
 */
export function ajustesEditables(eje, yo, valores = {}, opciones = {}) {
  const alta = eje?.alta(yo);
  const nombre = contrato.ajustesDeLaGuia(opciones);
  const plantilla = contrato.plantillas(null, opciones).find((p) => p.nombre === nombre);
  if (!alta || !plantilla) return null;
  const idioma = opciones.idioma ?? contrato.configuracion(eje, yo, opciones).language;
  const actual = contrato.configuracionGuia(eje, yo, opciones);
  const claves = contrato.clavesDeConfiguracionDe(nombre, opciones);
  const payload = [[plantilla.nombre]];
  const campos = [];
  let cambiado = false;
  for (const { pv, clave, defecto } of claves) {
    const numero = typeof defecto === 'number';
    const dado = valores[clave] !== undefined ? String(valores[clave]).trim() : undefined;
    let v = dado === undefined || dado === '' ? actual[clave] ?? defecto : numero ? Number(dado) : dado;
    if (numero && !(Number.isFinite(v) && v > 0)) v = actual[clave] ?? defecto;
    if (v !== (actual[clave] ?? defecto)) cambiado = true;
    payload[pv] = [v];
    campos.push({
      pv, clave, numero, valor: v, marcador: defecto,
      etiqueta: contrato.texto(eje, contrato.claves.parametro(plantilla.nombre, clave, 'label'), idioma, { original: clave, ...opciones }),
      ayuda: contrato.texto(eje, contrato.claves.parametro(plantilla.nombre, clave, 'help'), idioma, { original: '', ...opciones }),
    });
  }
  payload[5] = [plantilla.nombre]; // el tipo (B4)
  return { payload, campos, sobre: alta.id, en: direccion([9]), cambiado };
}

/** Las preguntas hechas de la época (los botones rápidos), en el idioma. */
export function preguntasRapidas(eje, idioma, opciones = {}) {
  return contrato.guia(eje, idioma, opciones)?.preguntas ?? [];
}

// ---------- el contexto ----------

const traducir = (eje, idioma, nombre) => contrato.texto(eje, contrato.claves.plantilla(nombre), idioma, { original: nombre });
const nombreDeAccion = (eje, idioma, id) => {
  const p = acciones.plantillaDeTransaccion(id);
  return traducir(eje, idioma, p ? acciones.nombreDeAccion(p) : String(id));
};

/**
 * El contexto de una pregunta: el texto de lo que hay en pantalla, de quién mira y de lo que el núcleo ofrece, con un
 * tope de caracteres (`opciones.tope`, por defecto el de los ajustes: 6000). Cada bloque se recorta por el final y el
 * propio texto dice cuáles se han recortado. `estado`: { foco: { X, pv }, niveles, ... } de la carta; `opciones`:
 * { ancho, alto, cuenta (¿es una cuenta?), tope, epoca }.
 */
export async function contexto(estado, eje, yo, opciones = {}) {
  const X = typeof estado?.foco === 'string' ? estado.foco : estado?.foco?.X;
  if (!eje || !X || !eje.obtener(X)) return t('noHayFoco');
  const idioma = contrato.configuracion(eje, yo, opciones).language ?? 'en';
  const o = { ...opciones, idioma };
  const tope = opciones.tope ?? ajustes(eje, yo, opciones).contexto;
  const ancho = Math.max(240, opciones.ancho ?? MEDIDAS.ancho);
  const alto = Math.max(320, opciones.alto ?? MEDIDAS.alto);
  const bloques = {};

  // El modo (cómo se disponen los puntos de vista) lo da la época por la forma del hueco, igual que la carta.
  const capacidad = Math.max(1, Math.floor(ancho / MEDIDAS.hueco) * Math.floor(alto / MEDIDAS.hueco));
  const d = contrato.division(eje, X, { datos: capacidad, forma: { ancho, alto }, ...o });
  const minimo = contrato.division(eje, X, { datos: 1, forma: { ancho: 1, alto: 1 }, ...o }).disposicion;
  const conf = contrato.configuracion(eje, yo, o);
  const defectos = contrato.configuracion(eje, null, o);
  const render = conf.render !== undefined && conf.render !== defectos.render ? conf.render : defectos.render;
  bloques.modo = t('ctxModo', { ancho, alto, modo: d.disposicion, forma: t(d.disposicion !== minimo ? 'ctxApilada' : 'ctxMapa'), render, idioma });

  const persona = yo && eje.esPersona?.(yo);
  bloques.yo = t('ctxYo', { quien: yo ?? t('ctxCosa'), tipo: t(persona ? 'ctxPersona' : 'ctxCosa'), donde: t(opciones.cuenta ? 'ctxCuenta' : 'ctxEjemplo') });

  // El foco: su lectura humana, su madurez y el punto de vista abierto.
  const m = contrato.madurez(eje, X, o);
  const foco = [t('ctxFoco', { id: corto(X), pv: estado?.foco?.pv ?? 0 })];
  if (m?.nombre) foco.push(t('ctxMadurez', { nivel: m.nivel, de: m.de, nombre: m.nombre }));
  foco.push(t('ctxLectura'), leerEvento(eje, X, { epoca: opciones.epoca }));
  bloques.foco = foco.join('\n');

  // La carta de texto del foco en la pantalla (el tamaño 3).
  bloques.carta = t('ctxCartaDeTexto') + '\n' + pintar(eje, X, 3, o);

  // El camino: mis pasos, los de espera y los niveles.
  if (yo) {
    const c = await acciones.camino(eje, X, yo, o);
    const lineas = [t('ctxCamino', { cuantos: c.pasos.length })];
    if (c.niveles) lineas.push(t('ctxNiveles', { niveles: c.niveles.join(' → ') }));
    for (const p of c.pasos) {
      const quien = p.hecho ? t('ctxPasoHecho') : p.espera ? t('ctxPasoEspera', { quien: p.espera }) : t('ctxPasoMio');
      lineas.push('- ' + p.fuente + ' · ' + quien + (p.hacer ? ' · ' + nombreDeAccion(eje, idioma, p.hacer.plantilla) : '') + ' · ' + (p.falta ?? ''));
    }
    bloques.camino = lineas.join('\n');
    // Las acciones del aro por punto de vista, con su nombre traducido.
    const aro = [t('ctxAro')];
    for (const pv of d.pvs) {
      const lista = acciones.acciones(eje, X, pv, yo, o);
      if (lista.length) aro.push('PV' + pv + ': ' + lista.map((a) => traducir(eje, idioma, a.nombre) + (a.porDefecto ? '*' : '')).join(' · '));
    }
    bloques.aro = aro.join('\n');
  }

  // Las últimas cinco entradas del diario, leídas.
  const total = contrato.diario(eje, X, 0, 1, o).total;
  const ultimas = contrato.diario(eje, X, Math.max(0, total - 5), 5, o).entradas;
  bloques.diario = [t('ctxDiario'), ...(ultimas.length ? ultimas.map((e) => '- ' + e.t + ' · ' + recortar(leerEvento(eje, e.id, { epoca: opciones.epoca }).replace(/\s*\n\s*/g, ' / '), 260)) : [t('ctxNada')])].join('\n');

  // Lo relevante de la configuración: el idioma y el render (nada de dónde se comparte el eje ni de claves).
  bloques.config = Object.entries({ language: conf.language, render }).filter(([, v]) => v !== undefined).map(([k, v]) => k + ': ' + v).join(' · ');

  // El reparto del tope: cada bloque, su parte; lo que sobra de unos no se da a otros (el recorte es por bloque).
  const presentes = Object.keys(bloques);
  const suma = presentes.reduce((n, k) => n + PESOS[k], 0);
  const reserva = 120; // la línea que dice qué se ha recortado
  const cortados = [];
  const partes = presentes.map((k) => {
    const cupo = Math.max(40, Math.floor(((tope - reserva) * PESOS[k]) / suma));
    if (bloques[k].length > cupo) cortados.push(k);
    return recortar(bloques[k], cupo);
  });
  let texto = partes.join('\n\n');
  if (cortados.length) texto += '\n\n' + t('ctxRecortado', { tope, cuales: cortados.join(', ') });
  return recortar(texto, tope);
}

// ---------- las instrucciones ----------

/** Lo escrito en el 9 de un registro, en humano (lo que anclaron ahí y lo de su propio 9): los registros de configuración no se mandan. */
function delNueve(eje, X, o) {
  const ev = eje.obtener(X);
  const trozos = [];
  const propio = Array.isArray(ev?.payload) ? ev.payload[9] : undefined;
  if (propio !== undefined) trozos.push(leer(propio, { eje, epoca: o.epoca }));
  for (const h of eje.sobre(X, '9000000000') ?? []) {
    if (!h || contrato.esDeConfiguracion(eje, h.id, o)) continue;
    trozos.push(leer(h.payload, { eje, epoca: o.epoca }));
  }
  return trozos.map((x) => String(x).trim()).filter(Boolean).join('\n');
}

/**
 * Las instrucciones de una pregunta: el texto base de la época (el registro «guide» del 9.9: papel, resumen, normas) y,
 * detrás, lo que escriban en el 9 de la plantilla del foco y en el 9 del foco («la guía empieza leyendo en el 9»: 9 de la
 * época → 9 de la plantilla → 9 del registro). → texto, o '' si la época no trae guía.
 */
export function instrucciones(eje, X, yo, opciones = {}) {
  const idioma = contrato.configuracion(eje, yo, opciones).language ?? 'en';
  const base = contrato.guia(eje, idioma, opciones);
  if (!base) return '';
  const partes = [base.papel, base.resumen, base.normas];
  if (eje && X && eje.obtener(X)) {
    const p = contrato.plantilla(eje, X, opciones);
    if (Array.isArray(p) && p[9] !== undefined) {
      const x = leer(p[9], { eje, epoca: opciones.epoca }).trim();
      if (x) partes.push(t('guiaDeLaPlantilla') + '\n' + x);
    }
    const r = delNueve(eje, X, opciones);
    if (r) partes.push(t('guiaDelRegistro') + '\n' + r);
  }
  return partes.filter(Boolean).join('\n\n');
}

// ---------- la conversación ----------

/** La conversación guardada (los últimos `max` turnos, cada uno { role, content }); vacía si no hay o está rota. `almacen`: tipo localStorage. */
export function cargarHistorial(almacen, alta, max = RESPALDO.historial) {
  try {
    const v = JSON.parse(almacen?.getItem(CLAVES.historial(alta)) ?? 'null');
    return Array.isArray(v) ? v.filter((x) => x && (x.role === 'user' || x.role === 'assistant') && typeof x.content === 'string').slice(-max) : [];
  } catch {
    return [];
  }
}

/** Guarda solo los últimos `max` turnos. */
export function guardarHistorial(almacen, alta, historial, max = RESPALDO.historial) {
  try {
    almacen?.setItem(CLAVES.historial(alta), JSON.stringify(historial.slice(-max)));
    return true;
  } catch {
    return false;
  }
}

/** Vacía la conversación de una cuenta. */
export function vaciarHistorial(almacen, alta) {
  try { almacen?.removeItem(CLAVES.historial(alta)); } catch { /* sin almacenamiento */ }
}

/** La clave de la API guardada en este navegador para esa alta (o null). Nunca entra en el eje ni en la copia. */
export function claveIa(almacen, alta) {
  try {
    const v = almacen?.getItem(CLAVES.ia(alta));
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

/** Guarda la clave de la API de esa alta; vacía, la borra. */
export function guardarClaveIa(almacen, alta, clave) {
  try {
    const v = typeof clave === 'string' ? clave.trim() : '';
    if (v) almacen?.setItem(CLAVES.ia(alta), v);
    else almacen?.removeItem(CLAVES.ia(alta));
    return true;
  } catch {
    return false;
  }
}

/** Los mensajes de una petición: el historial recortado (empieza por el usuario, alterna, cada uno de hasta MENSAJE_MAXIMO) y la pregunta. */
export function mensajesDe(historial, pregunta, max = RESPALDO.historial) {
  let h = (historial ?? []).slice(-max).map((m) => ({ role: m.role, content: recortar(String(m.content), MENSAJE_MAXIMO) }));
  while (h.length && h[0].role !== 'user') h = h.slice(1);
  // Alternancia: lo que no alterna (restos de un fallo) se descarta.
  const limpio = [];
  for (const m of h) if (m.role !== limpio[limpio.length - 1]?.role) limpio.push(m);
  if (limpio[limpio.length - 1]?.role === 'user') limpio.pop();
  return [...limpio, { role: 'user', content: recortar(String(pregunta), MENSAJE_MAXIMO) }];
}

// ---------- la llamada ----------

/**
 * El cuerpo de la petición a la guía. `via` «server»: { eje, modelo, mensajes, contexto, instrucciones } (lo que
 * espera POST {sync url}/guia); «direct»: el de la API de mensajes del proveedor ({ model, max_tokens, system,
 * messages }), con las instrucciones y el contexto como `system`.
 */
export function cuerpoDe({ via, eje, modelo, instrucciones: texto = '', contexto: ctx = '', historial = [], pregunta, maximo }) {
  const mensajes = mensajesDe(historial, pregunta, maximo);
  if (via === 'direct') return { model: modelo, max_tokens: MAX_TOKENS, system: [texto, ctx].filter(Boolean).join('\n\n'), messages: mensajes };
  return { eje, modelo, mensajes, contexto: ctx, instrucciones: texto };
}

/** El motivo de un estado HTTP, en la interfaz. */
function motivoDe(estado, via, detalle) {
  if (estado === 401) return t(via === 'direct' ? 'guiaError401Directo' : 'guiaError401Servidor');
  if (estado === 429) return t('guiaErrorCuota');
  return t('guiaError', { estado, motivo: detalle || '' });
}

/**
 * Pregunta a la guía. Elige la vía de los ajustes (`via`):
 *   server  necesita `url` y `ejeCompartido` (los de sincronia.destino) y `claveLectura`; sin ellos no llama.
 *   direct  necesita `claveIa` (guardada en este navegador); sin ella no llama.
 * → { ok: true, texto, uso } o { ok: false, motivo, estado? }. `fetch` y `urlDirecta` se pueden cambiar (pruebas).
 */
export async function preguntar({ via, url, ejeCompartido, claveLectura, claveIa: clave, modelo, instrucciones: texto, contexto: ctx, historial, pregunta, maximo, fetch = globalThis.fetch?.bind(globalThis), urlDirecta = API_DIRECTA }) {
  if (!pregunta || !String(pregunta).trim()) return { ok: false, motivo: '' };
  let peticion;
  if (via === 'direct') {
    if (!clave) return { ok: false, motivo: t('guiaSinClave') };
    peticion = { url: urlDirecta, cabeceras: { 'content-type': 'application/json', 'x-api-key': clave, 'anthropic-version': VERSION_API, 'anthropic-dangerous-direct-browser-access': 'true' } };
  } else {
    if (!url || !ejeCompartido || !claveLectura) return { ok: false, motivo: t('guiaSinServidor') };
    peticion = { url: url.replace(/\/+$/, '') + '/guia', cabeceras: { 'content-type': 'application/json', 'x-clave-lectura': claveLectura } };
  }
  const cuerpo = cuerpoDe({ via, eje: ejeCompartido, modelo, instrucciones: texto, contexto: ctx, historial, pregunta, maximo });
  let r;
  try {
    r = await fetch(peticion.url, { method: 'POST', headers: peticion.cabeceras, body: JSON.stringify(cuerpo) });
  } catch {
    return { ok: false, motivo: t('guiaSinRed') };
  }
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, estado: r.status, motivo: motivoDe(r.status, via, datos?.error?.message ?? datos?.error) };
  if (via === 'direct') {
    const texto2 = (datos.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    return texto2 ? { ok: true, texto: texto2, uso: { entrada: datos.usage?.input_tokens ?? 0, salida: datos.usage?.output_tokens ?? 0 } } : { ok: false, motivo: t('guiaRespuestaVacia') };
  }
  return typeof datos.texto === 'string' && datos.texto ? { ok: true, texto: datos.texto, uso: datos.uso ?? { entrada: 0, salida: 0 } } : { ok: false, motivo: t('guiaRespuestaVacia') };
}

/** Dónde está el libro compartido de quien mira, para la vía servidor: { url, eje } o null (sincronia.destino). */
export const destinoDe = (eje, yo) => sincronia.destino(eje, yo);

