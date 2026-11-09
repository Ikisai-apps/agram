// Las acciones del aro (encargo 3c-2a): la mitad de acción del contrato entre el núcleo y la pantalla.
// Principio (VG): nada hardcodeado en la pantalla ni negocio en JavaScript que pueda ser una regla o un dato de la
// época. Cada acción del aro es una PLANTILLA DE TRANSACCIÓN, un registro de la época (epoch.9.6, la lista de
// referencias a datos/epocas/plantillas/<nombre>.json) con el molde de regla adaptado:
//
//   0 nombre (inglés)        1 parámetros que pide (cada uno como una posición de una plantilla de datos: 0 etiqueta,
//                              1 tipo, 2 validación «=…» con it = el valor, 5 dónde va en el registro, 7 required u
//                              optional, 9 defectos y ayuda; un defecto «=…» se lee sobre it = X, me y la candidata ev)
//   2 cuándo se ofrece       BQL mínimo con it = X y me = la identidad que mira (el nombre `me` del contexto)
//   3 quién la lanza         4 lo que mueve: un movimiento por décupla (0 serie, 1 cuánto, 2 primitiva y su salida,
//                              precio o fecha, 3 [[de], [a]]), «read» si solo lee, «path» si lanza el camino
//   5 dónde ancla            el dígito (o camino, con huecos {parámetro}) de X y, si no es X, el registro
//   6 procedencia  7 época  8 [punto de vista, orden] (la primera de cada uno es la acción por defecto)  9 mensaje
//
//   acciones(eje, X, k, yo)                 las plantillas del punto de vista k cuya condición pasa para yo sobre X
//   transaccion(eje, plantilla, params, yo) construye la transacción y la valida en seco: { ok, evento, motivos }
//   camino(eje, X, yo)                      lo que falta: lo del tutorial, lo que derivan las reglas, las sugerencias
//   autoejecutar(eje, X, yo, firmar)        lanza los pasos míos en orden mientras pasen
//   estaciones(eje, X)                      lo anunciado en X por estación (E pagar, P decidir, R atender, T trabajar)
//
// Aquí no se decide nada: si una acción no se ofrece, lo dice su 2; qué mueve, su 4; dónde ancla, su 5. Este módulo
// solo sabe leer el molde y construir el evento. No asienta nada: la carta firma y asienta con lo que ya existe
// (eje.anadir); autoejecutar lo hace con la firma que le pasa la carta. Documentación: docs/CONTRATO.md, «Acciones».

import { EPOCA_0_BTML } from './epocas.js';
import { ContextoEje } from './contexto-eje.js';
import { evaluar, rellenar, nombreDeRegla } from './bqlm.js';
import { crearEvento } from './evento.js';
import { partirClave, validarMovimiento, ESCALAS_INFORMATIVAS } from './tokens.js';
import { direccion, esReferencia, esDecupla, esTerminal } from './btml.js';
import { plantilla as plantillaDeDatos, madurez, niveles as nivelesGenericos, configuracion, mensaje } from './contrato.js';
import { recuento } from './motor.js';
import { pendientes as peticionesPendientes } from './lente.js';

const RE_ID = /^[0-9a-f]{64}$/;

// ---------- la época y sus sitios ----------

const epocaDe = (opciones) => opciones?.epoca ?? EPOCA_0_BTML;
const raizDe = (epoca) => (Array.isArray(epoca) ? epoca : epoca.registro ?? epoca.payload);
/** Dónde pone la época lo que este módulo lee. */
const SITIO = Object.freeze({
  acciones: [9, 6], // la lista de referencias a las plantillas de transacción
  estaciones: [4, 2], // [[familia], [qué se hace], [la plantilla que cumple un movimiento anunciado]]
  identidad: [3, 0], // la plantilla de identidad: su 9 es el tutorial del alta
  recuentos: [9, 0, 0, 1], // las plantillas de recuento: [[nombre], [fórmula]]
  dia: [7, 0, 3, 1], // los segundos de un día del calendario
});
const en = (raiz, camino) => camino.reduce((n, d) => (Array.isArray(n) ? n[d] : undefined), raiz);
const hoja = (x) => (Array.isArray(x) ? x[0] : x);
const hojas = (x) => (x === undefined || x === null ? [] : Array.isArray(x) ? x : [x]);
const ultima = (x) => (Array.isArray(x) ? x[x.length - 1] : x);
const texto = (x) => (typeof x === 'string' ? x : typeof x === 'number' ? String(x) : undefined);
const esFormula = (x) => typeof x === 'string' && x.startsWith('=') && !x.startsWith('==');

/** El evento de X (su id o el evento), o null. */
function eventoDe(eje, X) {
  if (typeof X === 'string') return eje?.obtener(X) ?? null;
  if (X && typeof X === 'object' && 'payload' in X) return X;
  if (X && typeof X === 'object' && typeof X.id === 'string') return eje?.obtener(X.id) ?? null;
  return null;
}

/** El contexto del BQL mínimo: el eje, la época, la candidata y quien mira. */
const contextoDe = (eje, epoca, { ev, me } = {}) => new ContextoEje(eje, { ev, epoch: epoca, me });

/** Un ocupante del BQL mínimo como dato plano: número, texto, símbolo, el valor de un nodo (un id, una clave) o la décupla de un nodo del payload. */
function plano(o, ctx) {
  if (typeof o === 'number' || typeof o === 'string' || typeof o === 'boolean') return o;
  if (o && typeof o === 'object' && typeof o.simbolo === 'string') return o.simbolo;
  if (o && typeof o === 'object' && o.k === 'dec') return o.v;
  const v = ctx.valor(o);
  return v !== undefined ? v : undefined;
}

/** Lo que vale una expresión con it = sujeto: la lista plana, o null si no se resuelve (y por qué). */
function valores(expr, ctx, sujeto) {
  const r = evaluar(expr, ctx, sujeto === undefined ? {} : { sujeto });
  if (r.estado !== 'RESUELTO') return { valores: null, motivo: r.motivo, estado: r.estado };
  return { valores: r.valor.map((o) => plano(o, ctx)).filter((x) => x !== undefined), estado: 'RESUELTO' };
}

/** ¿Da verdadero una condición con it = sujeto? */
function cumple(expr, ctx, sujeto) {
  const r = evaluar(expr, ctx, { sujeto });
  return r.estado === 'RESUELTO' && r.valor.length === 1 && r.valor[0] === true;
}

/** El sujeto `it` de una evaluación sobre X: su id en el eje. */
const sujetoDe = (ev) => ev.id;

// ---------- 1. las plantillas de transacción ----------

/** El nombre de una plantilla de transacción: su 0.0. */
export const nombreDeAccion = (p) => texto(hoja(p?.[0]));
/** ¿Solo lee? (su 4 dice «read»). */
export const esLectura = (p) => Array.isArray(p?.[4]) && p[4].length >= 1 && p[4][0] === 'read';
/** ¿Lanza el camino? (su 4 dice «path», y «path all» si lo recorre entero). */
export const esCamino = (p) => Array.isArray(p?.[4]) && p[4].length >= 1 && p[4][0] === 'path';

/**
 * Las plantillas de transacción de la época (epoch.9.6), en su orden: [{ nombre, plantilla, id, pv, orden }]. Son
 * las acciones del aro; su 8 es [punto de vista, orden].
 */
export function plantillasDeTransaccion(opciones = {}) {
  const epoca = epocaDe(opciones);
  const lista = Array.isArray(epoca.transacciones) ? epoca.transacciones : [];
  return lista.map(({ id, plantilla }) => ({ nombre: nombreDeAccion(plantilla), plantilla, id, pv: Number(hojas(plantilla[8])[0]), orden: Number(hojas(plantilla[8])[1]) }));
}

/** Una plantilla de transacción por su nombre, su décupla o la referencia a su registro; null si no la hay. */
export function plantillaDeTransaccion(cual, opciones = {}) {
  if (Array.isArray(cual)) return cual;
  const todas = plantillasDeTransaccion(opciones);
  if (esReferencia(cual)) return todas.find((p) => p.id === cual.ref)?.plantilla ?? null;
  if (typeof cual === 'string') return todas.find((p) => p.nombre === cual || p.id === cual)?.plantilla ?? null;
  return null;
}

/**
 * Los parámetros que pide una plantilla, leídos de su 1: [{ nombre, tipo, validacion, posicion, requerido, defectos,
 * ayuda, orden }]. `posicion` es dónde va en el registro que escribe («1.2»; «-» si no va en él); `defectos` son las
 * hojas del 9 menos la ayuda (una fórmula «=…» se evalúa sobre it = X, me y la candidata).
 */
export function parametros(plantilla) {
  const lista = Array.isArray(plantilla?.[1]) ? plantilla[1].filter((p) => Array.isArray(p) && esDecupla(p)) : [];
  return lista.map((p) => ({
    nombre: texto(hoja(p[0])),
    tipo: texto(hoja(p[1])) ?? 'text',
    validacion: esFormula(texto(ultima(p[2]))) ? texto(ultima(p[2])) : null,
    posicion: texto(hoja(p[5])) ?? '-',
    requerido: hoja(p[7]) === 'required',
    defectos: hojas(p[9]).slice(0, -1),
    ayuda: texto(ultima(p[9])) ?? '',
    orden: Number(hoja(p[8])) || 0,
  })).sort((a, b) => a.orden - b.orden);
}

// ---------- la candidata: el registro que la plantilla describe ----------

/** El camino de dígitos de una posición «1.2» (o «-» si no va en el registro). */
const caminoDe = (posicion) => (posicion === '-' ? null : String(posicion).split('.').map(Number));

/** Pone un valor en una posición del payload (creando las décuplas intermedias): una hoja va entre corchetes, una lista tal cual. */
function poner(payload, camino, valor) {
  let nodo = payload;
  for (let k = 0; k < camino.length - 1; k++) {
    if (!Array.isArray(nodo[camino[k]])) nodo[camino[k]] = [];
    nodo = nodo[camino[k]];
  }
  const d = camino[camino.length - 1];
  if (camino.length === 1 && d === 0 && !Array.isArray(valor)) nodo[0] = valor; // la representación: una hoja suelta
  else nodo[d] = Array.isArray(valor) ? valor : [valor];
}

/** Las posiciones sin valor de un payload (huecos), como caminos «1.2». */
function huecos(payload, camino = []) {
  const fuera = [];
  if (!Array.isArray(payload)) return fuera;
  for (let i = 0; i < payload.length; i++) {
    if (payload[i] === undefined || payload[i] === null) fuera.push([...camino, i].join('.'));
    else if (Array.isArray(payload[i]) && payload[i].some(Array.isArray)) fuera.push(...huecos(payload[i], [...camino, i]));
  }
  return fuera;
}

/** Un valor de tipo `ref`: un id (o una lista de ids) se vuelve referencia. */
function comoTipo(valor, tipo) {
  if (tipo !== 'ref') return valor;
  const ref = (x) => (typeof x === 'string' && RE_ID.test(x) ? { ref: x } : x);
  return Array.isArray(valor) ? valor.map(ref) : ref(valor);
}

/** El nodo que hace de sujeto para validar un valor: una décupla del payload envuelta, lo demás tal cual (un id se despliega solo). */
const sujetoDeValor = (v) => (Array.isArray(v) ? { k: 'dec', id: null, camino: [], v } : esReferencia(v) ? v.ref : v);

/** Rellena los huecos {nombre} de un camino de anclaje con los parámetros. */
const conHuecos = (ruta, valores) => String(ruta).replace(/\{([^{}]+)\}/g, (_, n) => String(valores[n] ?? ''));

/**
 * Prepara la candidata de una plantilla sobre X para `yo`: el ancla (su 5), el payload con los parámetros dados y
 * los defectos de los que faltan (en su orden), y los parámetros resueltos. Devuelve { sobre, en, payload, valores,
 * parametros, motivos } con los motivos de los parámetros que fallan (cada uno { regla, mensaje }).
 */
function preparar(eje, plantilla, X, yo, params, { t, epoca }) {
  const nombre = nombreDeAccion(plantilla);
  const lista = parametros(plantilla);
  const valores = {};
  const motivos = [];
  for (const p of lista) if (params[p.nombre] !== undefined) valores[p.nombre] = comoTipo(params[p.nombre], p.tipo);
  const payload = [];
  const colocar = () => {
    payload.length = 0;
    for (const p of lista) {
      const camino = caminoDe(p.posicion);
      if (camino && valores[p.nombre] !== undefined) poner(payload, camino, valores[p.nombre]);
    }
    if (payload[0] === undefined) payload[0] = nombre;
  };
  colocar();
  // El ancla: el dígito (o camino, con huecos {parámetro}) de X y, si la plantilla lo dice, otro registro.
  const [ruta, formulaRegistro] = hojas(plantilla[5]);
  let sobre = X.id;
  const provisional = { autor: yo, sobre, en: '0000000000', t, movimientos: [], payload };
  if (esFormula(formulaRegistro)) {
    const r = valores0(eje, epoca, formulaRegistro, provisional, yo, X);
    if (typeof r !== 'string' || !eje.obtener(r)) motivos.push({ regla: nombre, mensaje: nombre + ': the record it anchors on is not in the ledger (' + String(formulaRegistro) + ')' });
    else sobre = r;
  }
  const rutaLlena = conHuecos(ruta ?? '0', valores);
  const digitos = rutaLlena.split('.').map(Number);
  const enDir = digitos.every((d) => Number.isInteger(d) && d >= 0 && d <= 9) && digitos.length <= 10 ? direccion(digitos) : null;
  if (!enDir) motivos.push({ regla: nombre, mensaje: nombre + ': the anchor is not a position (' + rutaLlena + ')' });
  const candidata = { autor: yo, sobre, en: enDir ?? '0000000000', t, movimientos: [], payload };
  // Los defectos de lo que falta, en su orden, con lo ya puesto a la vista (ev).
  for (const p of lista) {
    if (valores[p.nombre] !== undefined || !p.defectos.length) continue;
    const v = p.defectos.map((d) => (esFormula(d) ? valoresDe(eje, epoca, d, candidata, yo, X) : [d])).flat();
    if (v.length) {
      valores[p.nombre] = comoTipo(v.length === 1 ? v[0] : v, p.tipo);
      colocar();
    }
  }
  // Validar: lo requerido está, y cada valor cumple su 2.
  const ctx = contextoDe(eje, epoca, { ev: candidata, me: yo });
  for (const p of lista) {
    const v = valores[p.nombre];
    if (v === undefined) {
      if (p.requerido) motivos.push({ regla: p.nombre, mensaje: p.nombre + ': ' + p.ayuda, parametro: p.nombre });
      continue;
    }
    if (p.validacion && !cumple(p.validacion, ctx, sujetoDeValor(v))) motivos.push({ regla: p.nombre, mensaje: p.nombre + ': ' + p.ayuda, parametro: p.nombre });
  }
  for (const h of huecos(payload)) motivos.push({ regla: nombre, mensaje: nombre + ': position ' + h + ' of the record has no value' });
  return { sobre, en: candidata.en, payload, valores, parametros: lista, motivos, candidata };
}

/** Lo que vale una fórmula sobre it = X, me = yo y la candidata, como lista plana (vacía si no se resuelve). */
function valoresDe(eje, epoca, formula, candidata, yo, X) {
  const ctx = contextoDe(eje, epoca, { ev: candidata, me: yo });
  return valores(formula, ctx, sujetoDe(X)).valores ?? [];
}
const valores0 = (...args) => valoresDe(...args)[0];

// ---------- 2. acciones ----------

/**
 * Las acciones del aro: las plantillas de transacción del punto de vista k cuya condición (su 2, con it = X y me = yo)
 * pasa, en el orden de su 8: [{ nombre, plantilla, parametros, porDefecto, lectura, camino }]. Cada parámetro lleva su
 * valor por defecto ya resuelto (`valor`) y si falta (`falta`). Nada se decide aquí: si una acción no debe aparecer,
 * lo dice su 2.
 */
export function acciones(eje, X, k, yo, opciones = {}) {
  const ev = eventoDe(eje, X);
  if (!ev || typeof ev.id !== 'string' || !eje?.obtener(ev.id)) return [];
  const epoca = epocaDe(opciones);
  const ctx = contextoDe(eje, epoca, { me: yo });
  const fuera = [];
  for (const { nombre, plantilla, pv } of plantillasDeTransaccion(opciones)) {
    if (pv !== Number(k)) continue;
    const condicion = texto(ultima(plantilla[2]));
    if (!esFormula(condicion) || !cumple(condicion, ctx, sujetoDe(ev))) continue;
    const { valores, parametros: lista } = preparar(eje, plantilla, ev, yo, {}, { t: relojDe(eje, opciones), epoca });
    fuera.push({
      nombre,
      plantilla,
      parametros: lista.map((p) => ({ nombre: p.nombre, tipo: p.tipo, requerido: p.requerido, ayuda: p.ayuda, posicion: p.posicion, valor: valores[p.nombre], falta: p.requerido && valores[p.nombre] === undefined })),
      porDefecto: fuera.length === 0,
      lectura: esLectura(plantilla),
      camino: esCamino(plantilla),
    });
  }
  return fuera;
}

/** El reloj con que se fecha una candidata: el que se pide, o el mayor t del libro. */
function relojDe(eje, opciones) {
  if (opciones?.t) return opciones.t;
  const ms = eje?.tMaximo?.();
  return Number.isFinite(ms) ? new Date(ms).toISOString().replace('.000Z', 'Z') : new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// ---------- 3. construir y validar ----------

/** Los campos de una serie para un movimiento, desde sus partes [familia, emisor|escala|ámbito, denominación|origen, registro] o desde su clave. */
function serieDe(partes) {
  if (partes.length === 1) {
    const clave = partes[0];
    if (typeof clave !== 'string' || !clave.includes(':')) return null;
    const p = partirClave(clave);
    const { token } = p;
    if (token === 'E') return { token, emisor: p.emisor, denominacion: p.denominacion, ...(p.registro ? { registro: p.registro } : {}) };
    if (token === 'P') return { token, ambito: p.ambito, ...(p.origen ? { origen: p.origen } : {}) };
    if (token === 'R') return { token, emisor: p.emisor };
    if (token === 'T') return { token, escala: p.escala };
    return null;
  }
  const [familia, a, b, c] = partes;
  if (familia === 'E') return { token: 'E', emisor: a, denominacion: b, ...(c ? { registro: c } : {}) };
  if (familia === 'P') return { token: 'P', ambito: a, ...(b ? { origen: b } : {}) };
  if (familia === 'R') return { token: 'R', emisor: a };
  if (familia === 'T') return { token: 'T', escala: a };
  return null;
}

/**
 * Los movimientos que describe el 4 de la plantilla, evaluados sobre la candidata: cada décupla da un movimiento (o
 * ninguno, si su cuánto es cero o nada). Devuelve { movimientos, motivos }.
 */
function movimientosDe(eje, epoca, plantilla, candidata, yo, X) {
  const nombre = nombreDeAccion(plantilla);
  const ctx = contextoDe(eje, epoca, { ev: candidata, me: yo });
  const vale = (h) => (esFormula(h) ? valores(h, ctx, sujetoDe(X)).valores ?? [] : h === undefined ? [] : [h]);
  const quien = (h) => {
    const v = vale(h)[0];
    return v === 'nobody' || v === undefined ? null : v;
  };
  const movimientos = [];
  const motivos = [];
  for (const receta of Array.isArray(plantilla[4]) ? plantilla[4] : []) {
    if (!Array.isArray(receta) || !esDecupla(receta)) continue;
    const cuanto = vale(hoja(receta[1]))[0];
    if (!(typeof cuanto === 'number' && cuanto > 1e-12)) continue; // lo que da cero o nada no se mueve
    const partes = hojas(receta[0]).map((h) => vale(h)[0]);
    const serie = partes.every((x) => x !== undefined) ? serieDe(partes) : null;
    if (!serie) { motivos.push({ regla: nombre, mensaje: nombre + ': no series for a movement of ' + cuanto }); continue; }
    const [primitiva, extra] = hojas(receta[2]);
    const [de, a] = hojas(receta[3]).map((x) => quien(hoja(x)));
    const m = { ...serie, cantidad: Math.round(cuanto * 1e9) / 1e9 };
    const extraV = extra === undefined ? undefined : vale(extra)[0];
    if (primitiva === 'mint') {
      Object.assign(m, { de: null, a });
      if (serie.token === 'E' && Array.isArray(extraV) && esDecupla(extraV)) m.precio = [hoja(extraV[0]), hoja(extraV[1])];
    } else if (primitiva === 'burn') {
      Object.assign(m, { de, a: null });
      if (serie.token === 'T' && ESCALAS_INFORMATIVAS.includes(serie.escala) && typeof extraV === 'string') m.refiere = extraV;
    } else if (primitiva === 'lock' || primitiva === 'release') {
      Object.assign(m, { de, a: de, estado: primitiva === 'lock' ? 'bloqueo' : 'liberacion', salida: extraV === undefined ? undefined : String(extraV) });
    } else {
      Object.assign(m, { de, a, ...(extraV === undefined ? {} : { salida: String(extraV) }) });
    }
    const errores = validarMovimiento(m);
    if (errores.length) motivos.push({ regla: nombre, mensaje: nombre + ': ' + errores.join('; ') });
    else movimientos.push(m);
  }
  return { movimientos, motivos };
}

/** El mensaje de una plantilla (su 9) relleno sobre la candidata, X y yo. */
function mensajeDe(eje, epoca, plantilla, candidata, yo, X) {
  const m = texto(ultima(plantilla[9]));
  if (!m) return nombreDeAccion(plantilla);
  return rellenar(m, contextoDe(eje, epoca, { ev: candidata, me: yo }), { sujeto: sujetoDe(X) });
}

/** Los motivos con que el eje rechaza, como { regla, mensaje } en el idioma: una regla de la época, por su nombre y su 9; lo demás, su texto. */
function motivosDelEje(eje, textos, ev, idioma, opciones) {
  const epoca = epocaDe(opciones);
  const reglas = (epoca.reglasConId ?? []).map((x) => x.regla);
  return textos.map((t) => {
    const regla = reglas.find((r) => t.startsWith(nombreDeRegla(r) + ': '));
    if (!regla) return { regla: null, mensaje: t };
    return { regla: nombreDeRegla(regla), mensaje: mensaje(eje, regla, idioma, { ev, ...opciones }) ?? t };
  });
}

/**
 * Construye la transacción de una plantilla sobre X (params.X: el registro) con los parámetros, para `yo`, y la
 * valida en seco: primero los parámetros con su 2 (motivos por parámetro), después la transacción entera contra las
 * reglas del eje (eje.validar: las condiciones sobre el libro de antes, sin asentar). Devuelve { ok, evento, motivos:
 * [{ regla, mensaje }] } con los mensajes en el idioma de la configuración de yo (o el que se pida). Si ok, la carta
 * lo firma y lo asienta con lo que ya existe (eje.anadir); aquí no se asienta nada. Una plantilla que solo lee
 * (read) devuelve ok con `lectura`; una que lanza el camino (path), el paso que lanzaría (o todos, con path all).
 */
export async function transaccion(eje, cual, params = {}, yo, opciones = {}) {
  const epoca = epocaDe(opciones);
  const plantilla = plantillaDeTransaccion(cual, opciones);
  if (!plantilla) return { ok: false, evento: null, motivos: [{ regla: null, mensaje: 'unknown transaction template: ' + String(Array.isArray(cual) ? cual[0] : cual?.ref ?? cual) }] };
  const nombre = nombreDeAccion(plantilla);
  const { X: cualX, ...dados } = params;
  const X = eventoDe(eje, cualX);
  if (!X || !eje?.obtener(X.id)) return { ok: false, evento: null, motivos: [{ regla: nombre, mensaje: nombre + ': X is not a record of the ledger' }] };
  if (typeof yo !== 'string' || !yo) return { ok: false, evento: null, motivos: [{ regla: nombre, mensaje: nombre + ': who launches it (yo) is an identity' }] };
  const idioma = opciones.idioma ?? configuracion(eje, yo, opciones).language ?? 'en';
  const t = relojDe(eje, opciones);
  if (esLectura(plantilla)) {
    const { motivos, candidata } = preparar(eje, plantilla, X, yo, dados, { t, epoca });
    return { ok: motivos.length === 0, evento: null, motivos, lectura: { nombre, mensaje: mensajeDe(eje, epoca, plantilla, candidata, yo, X) } };
  }
  if (esCamino(plantilla)) {
    const todo = hojas(plantilla[4]).includes('all');
    const { pasos } = await camino(eje, X, yo, opciones);
    const mios = pasos.filter((p) => p.hacer && !p.espera && !p.hecho);
    if (todo) return { ok: true, evento: null, motivos: [], pasos: mios };
    const primero = mios[0];
    if (!primero) return { ok: true, evento: null, motivos: [], paso: null };
    const r = await transaccion(eje, primero.hacer.plantilla, { X: primero.hacer.X ?? X.id, ...primero.hacer.parametros }, yo, opciones);
    return { ...r, paso: primero };
  }
  const prep = preparar(eje, plantilla, X, yo, dados, { t, epoca });
  if (prep.motivos.length) return { ok: false, evento: null, motivos: prep.motivos };
  const { movimientos, motivos } = movimientosDe(eje, epoca, plantilla, prep.candidata, yo, X);
  if (motivos.length) return { ok: false, evento: null, motivos };
  const payload = prep.payload;
  // La representación del registro: el mensaje de la plantilla, salvo que un parámetro ocupe el 0.
  if (!prep.parametros.some((p) => p.posicion === '0' && prep.valores[p.nombre] !== undefined)) payload[0] = mensajeDe(eje, epoca, plantilla, { ...prep.candidata, movimientos }, yo, X);
  let evento;
  try {
    evento = await crearEvento({ autor: yo, sobre: prep.sobre, en: prep.en, t, movimientos, payload });
  } catch (e) {
    return { ok: false, evento: null, motivos: [{ regla: nombre, mensaje: nombre + ': ' + e.message }] };
  }
  const textos = await eje.validar(evento);
  const delEje = motivosDelEje(eje, textos, evento, idioma, opciones);
  return { ok: delEje.length === 0, evento, motivos: delEje };
}

// ---------- 4. las estaciones ----------

/** Las estaciones de la fábrica (epoch.4.2): [{ familia, estacion, plantilla }]. */
export function estacionesDeLaEpoca(opciones = {}) {
  const raiz = raizDe(epocaDe(opciones));
  return hojas(en(raiz, SITIO.estaciones)).filter((x) => Array.isArray(x) && esDecupla(x)).map((x) => ({ familia: hoja(x[0]), estacion: hoja(x[1]), plantilla: hoja(x[2]) }));
}

/**
 * Lo anunciado en X por estación (la lectura «stage», X.4.8, y los anuncios de su 4.1): [{ familia, estacion,
 * plantilla, anunciados, hechos, pendientes }], cada lista con los ids de los anuncios. La familia de un anuncio se
 * lee buscando su serie por su valor en las del libro (before.4).
 */
export function estaciones(eje, X, opciones = {}) {
  const ev = eventoDe(eje, X);
  if (!ev || !eje?.obtener(ev.id)) return [];
  const epoca = epocaDe(opciones);
  const ctx = contextoDe(eje, epoca, {});
  const s = '("' + ev.id + '")';
  return estacionesDeLaEpoca(opciones).map((e) => {
    const de = (expr) => (valores('((' + expr + ' where count it.5 > 0) where ' + e.familia + ' in (before.4.(first it.0)).0.0) each 5', ctx).valores ?? []).filter((x) => typeof x === 'string');
    const anunciados = [...new Set(de(s + '.4.1'))];
    const pendientes = [...new Set(de(s + '.4.8'))];
    return { ...e, anunciados, pendientes, hechos: anunciados.filter((id) => !pendientes.includes(id)) };
  });
}

// ---------- 5. el camino ----------

/** Un movimiento anunciado (un registro en el 4.1 de X): { serie, cantidad, que, de, a }, o null. */
function anuncioDe(registro) {
  const p = registro?.payload;
  const h = (x) => (Array.isArray(x) ? x[x.length - 1] : x);
  const serie = h(p?.[0]);
  const cantidad = h(p?.[1]);
  const de = h(p?.[3]?.[0]);
  const a = h(p?.[3]?.[1]);
  if (typeof serie !== 'string' || typeof cantidad !== 'number' || typeof de !== 'string' || typeof a !== 'string') return null;
  return { serie, cantidad, que: h(p?.[2]), de, a };
}

/** Los nombres que un registro o una plantilla escriben en su 9 (hojas de texto). */
const nombresDel9 = (decupla) => hojas(Array.isArray(decupla) ? decupla[9] : undefined).filter((x) => typeof x === 'string' && !esFormula(x));

/**
 * El camino de X para `yo`: lo que falta, de tres fuentes y en este orden, cada paso { fuente, falta, hacer, espera,
 * hecho }: (1) el tutorial fijo, los nombres de plantillas de transacción (o de reglas) escritos en el 9 de la
 * plantilla de X (la de datos, o la de identidad si X es un alta) o del propio X; (2) lo que derivan las reglas:
 * los movimientos anunciados y pendientes (la lectura «stage», X.4.8, con la plantilla de su estación), el recuento
 * del dueño sin alcanzar («commit P»), las peticiones de atención sin atender («attend») y las caducidades próximas
 * («expire something mine»); si lo puede lanzar yo es un paso mío (`hacer`: la plantilla y sus parámetros), si lo
 * tiene que dar otro es un paso de espera (`espera`: de quién); (3) `sugerencias`, un gancho opcional (función
 * (eje, X, yo) → [{ plantilla, parametros }]) cuyos pasos van marcados como sugerencia y pasan por las mismas reglas
 * (`pasa`, `motivos`). `falta` se lee en humano con el 9 de la regla o de la plantilla, en el idioma de yo. Si la
 * madurez de X es 0 o desconocida, devuelve además `niveles` (los de su plantilla o los genéricos) para que la persona
 * se ubique. Orden: primero lo que nombra el criterio del dueño (X.2.3), luego lo que nombra el mío (el 2.3 de mi alta).
 */
export async function camino(eje, X, yo, opciones = {}) {
  const ev = eventoDe(eje, X);
  if (!ev || !eje?.obtener(ev.id)) return { pasos: [] };
  const epoca = epocaDe(opciones);
  const raiz = raizDe(epoca);
  const idioma = opciones.idioma ?? configuracion(eje, yo, opciones).language ?? 'en';
  const ctx = contextoDe(eje, epoca, { me: yo });
  const t = relojDe(eje, opciones);
  const plantillas = plantillasDeTransaccion(opciones);
  const porNombre = new Map(plantillas.map((p) => [p.nombre, p.plantilla]));
  const reglas = (epoca.reglasConId ?? []).map((x) => x.regla);
  const pasos = [];

  /** Un paso mío con una plantilla: sus parámetros por defecto y si ya está hecho (un registro mío en su ancla). */
  const mio = (nombre, extra = {}, sobre = ev) => {
    const plantilla = porNombre.get(nombre);
    if (!plantilla) return null;
    const prep = preparar(eje, plantilla, sobre, yo, extra, { t, epoca });
    const hecho = eje.sobreDe(prep.sobre, prep.en, new Set([yo])).length > 0;
    return { hacer: { plantilla: nombre, X: sobre.id, parametros: { ...Object.fromEntries(Object.entries(prep.valores)), ...extra }, lectura: esLectura(plantilla) }, hecho, falta: mensajeDe(eje, epoca, plantilla, prep.candidata, yo, sobre) };
  };

  // (1) El tutorial: el 9 de la plantilla de X (la de datos, o la de identidad si X es un alta) y el 9 del propio X.
  const esAlta = [...eje.identidades()].some((id) => eje.alta(id)?.id === ev.id);
  const deIdentidad = esAlta ? nombresDel9(en(raiz, SITIO.identidad)) : [];
  const nombres = [...nombresDel9(plantillaDeDatos(eje, ev, opciones)), ...deIdentidad, ...nombresDel9(ev.payload)];
  for (const n of nombres) {
    if (porNombre.has(n)) {
      const paso = mio(n);
      if (paso) pasos.push({ fuente: 'tutorial', ...paso, espera: null });
      continue;
    }
    const regla = reglas.find((r) => nombreDeRegla(r) === n);
    if (regla) {
      // Una regla en el tutorial: no se lanza, se cumple o no (la clave se declara en el alta misma).
      const hecho = n === 'a key is declared at its alta' ? Boolean(eje.clave(ev.autor)) : null;
      pasos.push({ fuente: 'tutorial', falta: mensaje(eje, regla, idioma, { ev, ...opciones }), hacer: null, espera: null, hecho, regla: n });
    }
  }

  // (2) Las reglas: lo anunciado y pendiente, por estación.
  const estacionDe = new Map(estacionesDeLaEpoca(opciones).map((e) => [e.familia, e]));
  const pendientes = (valores('("' + ev.id + '").4.8', ctx).valores ?? []).filter((x) => typeof x === 'string').map((id) => eje.obtener(id)).filter(Boolean);
  for (const anuncio of pendientes) {
    const m = anuncioDe(anuncio);
    if (!m) continue;
    const estacion = estacionDe.get(partirClave(m.serie).token);
    const que = (mensaje(eje, 'stage', idioma, opciones) ?? 'stage') + ' · ' + (m.que ?? '') + ' ' + m.cantidad + ' ' + m.serie + ' ' + m.de + ' → ' + m.a;
    if (m.de === yo && estacion) {
      const paso = mio(estacion.plantilla, { announcement: { ref: anuncio.id } });
      if (paso) { pasos.push({ fuente: 'reglas', regla: 'stage', ...paso, falta: que, hecho: false, espera: null, anuncio: anuncio.id }); continue; }
    }
    pasos.push({ fuente: 'reglas', regla: 'stage', falta: que, hacer: null, espera: m.de, hecho: false, anuncio: anuncio.id });
  }
  // El recuento del dueño, si lo declara y no pasa.
  const recuentos = hojas(en(raiz, SITIO.recuentos)).filter(Array.isArray).map((x) => hoja(x[0]));
  const criterio = (valores('(("' + ev.id + '").2 where count it.5 = 0)', ctx).valores ?? []).concat(valores('(("' + ev.id + '").2.2 where count it.5 = 0)', ctx).valores ?? []);
  if (criterio.some((x) => recuentos.includes(x))) {
    const c = recuento(eje, ev.id);
    if (c.pasa === false) {
      const que = 'the tally of ' + ev.autor + ' (' + c.plantilla + ') gives ' + c.valor + ' and asks above ' + c.umbral;
      const ofrecida = acciones(eje, ev, 2, yo, opciones).find((a) => a.nombre === 'commit P');
      if (ofrecida) { const paso = mio('commit P'); if (paso) pasos.push({ fuente: 'reglas', regla: 'weight', ...paso, falta: que, hecho: false, espera: null }); } else pasos.push({ fuente: 'reglas', regla: 'weight', falta: que, hacer: null, espera: ev.autor, hecho: false });
    }
  }
  // Las peticiones de atención sin atender: si X es un alta, las de su dueño.
  if (esAlta) {
    for (const id of peticionesPendientes(eje, ev.autor)) {
      const peticion = eje.obtener(id);
      if (!peticion) continue;
      const que = (mensaje(eje, 'attended', idioma, opciones) ?? 'attended') + ' · ' + String(peticion.payload?.[0] ?? peticion.payload);
      if (ev.autor === yo) { const paso = mio('attend', {}, peticion); if (paso) pasos.push({ fuente: 'reglas', regla: 'attended', ...paso, falta: que, espera: null }); } else pasos.push({ fuente: 'reglas', regla: 'attended', falta: que, hacer: null, espera: ev.autor, hecho: false, peticion: id });
    }
  }
  // Las caducidades próximas: las series vivas del subárbol (X.7.1) que caducan antes de un día del calendario.
  const dia = Number(hoja(en(raiz, SITIO.dia))) || 86400;
  const reloj = Number.isFinite(eje.tMaximo()) ? eje.tMaximo() : Date.now();
  const vivas = valores('("' + ev.id + '").7.1 each 0', ctx).valores ?? [];
  const caducan = valores('("' + ev.id + '").7.1 each 7', ctx).valores ?? [];
  vivas.forEach((clave, i) => {
    const caduca = caducan[i];
    if (typeof caduca !== 'string' || !(Date.parse(caduca) <= reloj + dia * 1000)) return;
    const emisor = partirClave(clave).emisor;
    const que = clave + ' expires at ' + caduca;
    if (emisor === yo) { const paso = mio('expire something mine', { series: clave }); if (paso) pasos.push({ fuente: 'reglas', regla: 'E is tied to a record that exists', ...paso, falta: que, hecho: false, espera: null }); } else pasos.push({ fuente: 'reglas', falta: que, hacer: null, espera: emisor, hecho: false });
  });

  // (3) Las sugerencias: un gancho sin LLM aquí; cada una pasa por las mismas reglas.
  if (typeof opciones.sugerencias === 'function') {
    for (const s of (await opciones.sugerencias(eje, ev, yo)) ?? []) {
      const nombre = typeof s === 'string' ? s : s?.plantilla;
      if (!porNombre.has(nombre)) continue;
      const r = await transaccion(eje, nombre, { X: ev.id, ...(s?.parametros ?? {}) }, yo, opciones);
      const paso = mio(nombre, s?.parametros ?? {});
      pasos.push({ fuente: 'sugerencia', ...paso, hecho: false, espera: null, pasa: r.ok, motivos: r.motivos });
    }
  }

  // Orden: lo que nombra el criterio del dueño (X.2.3) primero, luego lo que nombra el mío (el 2.3 de mi alta).
  const nombrados = (expr) => (valores(expr, ctx).valores ?? []).filter((x) => typeof x === 'string');
  const delDueno = nombrados('(("' + ev.id + '").2.3 where count it.5 = 0)');
  const mios = yo && eje.alta(yo) ? nombrados('("' + yo + '").2.3') : [];
  const rango = (p) => (p.hacer && delDueno.includes(p.hacer.plantilla) ? 0 : p.hacer && mios.includes(p.hacer.plantilla) ? 1 : 2);
  pasos.sort((a, b) => rango(a) - rango(b));

  const fuera = { pasos };
  const m = madurez(eje, ev, opciones);
  if (!m || !m.nivel) {
    const propios = hojas(plantillaDeDatos(eje, ev, opciones)?.[8]?.[8]).filter((x) => typeof x === 'string');
    fuera.niveles = propios.length ? propios : nivelesGenericos(opciones);
  }
  return fuera;
}

/**
 * Construye y lanza los pasos míos del camino, en orden, mientras pasen: cada uno se construye con `transaccion`, se
 * firma con `firmar(evento)` (lo que la carta sepa firmar; sin ella, el evento tal cual) y se asienta con eje.anadir.
 * Se detiene en el primero que no pasa. Devuelve { hechos: [{ paso, evento }], parado: { paso, motivos } | null }.
 */
export async function autoejecutar(eje, X, yo, firmar, opciones = {}) {
  const { pasos } = await camino(eje, X, yo, opciones);
  const hechos = [];
  for (const paso of pasos) {
    if (!paso.hacer || paso.espera || paso.hecho || paso.hacer.lectura) continue;
    const r = await transaccion(eje, paso.hacer.plantilla, { X: paso.hacer.X ?? X, ...paso.hacer.parametros }, yo, opciones);
    if (!r.ok || !r.evento) return { hechos, parado: { paso, motivos: r.motivos } };
    let evento = r.evento;
    try {
      if (typeof firmar === 'function') evento = (await firmar(evento)) ?? evento;
      evento = await eje.anadir(evento);
    } catch (e) {
      return { hechos, parado: { paso, motivos: [{ regla: null, mensaje: e.message }] } };
    }
    hechos.push({ paso, evento });
  }
  return { hechos, parado: null };
}
