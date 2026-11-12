// Las acciones del aro (encargo 3c-2a): la mitad de acción del contrato entre el núcleo y la pantalla.
// Principio (VG): nada hardcodeado en la pantalla ni negocio en JavaScript que pueda ser una regla o un dato de la
// época. Cada acción del aro es una PLANTILLA DE TRANSACCIÓN, un registro de la época (epoch.9.6, la lista de
// referencias a datos/epocas/plantillas/<nombre>.json) con el molde de regla adaptado:
//
//   0 nombre (inglés)        1 parámetros que pide (cada uno como una posición de una plantilla de datos: 0 etiqueta,
//                              1 tipo, 2 validación «=…» con it = el valor, 4 qué se hace con él, 5 dónde va en el
//                              registro, 7 required u optional, 9 defectos y ayuda; un defecto «=…» se lee sobre it = X,
//                              me y la candidata ev. Su 4 es «payload», o «key {p}» / «proof {p}»: la clave pública que
//                              el registro declara para la identidad que da el parámetro p y su prueba de posesión,
//                              fuera del payload: así da de alta una cosa con su clave, encargo core-escribe)
//   2 cuándo se ofrece       BQL mínimo con it = X y me = la identidad que mira (el nombre `me` del contexto)
//   3 quién la lanza         (VG 12-11, #71.1: 3.0 quién, «me»; 3.1 su modo de ejecución, si puede lanzarla un agente: «person»
//                              [defecto: solo una persona], «agent» [un agente de AARPIA escribiendo como identidad: una cosa que su
//                              dueño declaró agente, epoch.9.0.4] o
//                              «system» [el sistema solo; exige una revisión del dueño de la época, epoch.9.0.4])
//                            4 lo que mueve (VG 12-11, decisiones 5 a 7 del estudio BQL-transacciones): las sentencias
//                              «=…» del BQL mínimo con los cinco verbos (mint transfer lock release burn), una por
//                              ocupante, evaluadas en orden (bqlm.evaluarPlantilla); «write» si no mueve nada más que el
//                              coste de escribir (la regla de la época «the cost of writing», que transaccion cobra a
//                              toda candidata); «read» si solo lee; «path» si lanza el camino. La lista de antes (un
//                              movimiento por décupla) se retiró al fundir con PV3: las dos vías daban lo mismo
//   5 dónde ancla            el dígito (o camino, con huecos {parámetro}) de X y, si no es X, el registro
//   6 procedencia  7 época  8 [punto de vista, orden] (la primera de cada uno es la acción por defecto)  9 mensaje
//
//   acciones(eje, X, k, yo)                 las plantillas del punto de vista k cuya condición pasa para yo sobre X
//   transaccion(eje, plantilla, params, yo) construye la transacción y la valida en seco: { ok, evento, motivos }
//   camino(eje, X, yo)                      lo que falta: lo del tutorial, lo que derivan las reglas, las sugerencias
//   autoejecutar(eje, X, yo, firmar)        lanza los pasos míos en orden mientras pasen
//   modoDeEjecucion(eje, plantilla)         su modo de ejecución: { declarado, modo, revisado } (system sin revisión se lee agent)
//   esAgente(eje, identidad)                ¿es una cosa que su dueño declaró agente? (no lanza las plantillas «person»)
//   estaciones(eje, X)                      lo anunciado en X por estación (E pagar, P decidir, R atender, T trabajar)
//   ejecuciones(eje, X)                     la fábrica de X para la matriz del 4: cada ejecución con su PV, su posición y su estación
//
// Aquí no se decide nada: si una acción no se ofrece, lo dice su 2; qué mueve, su 4; dónde ancla, su 5. Este módulo
// solo sabe leer el molde y construir el evento. No asienta nada: la carta firma y asienta con lo que ya existe
// (eje.anadir); autoejecutar lo hace con la firma que le pasa la carta. Documentación: docs/CONTRATO.md, «Acciones».

import { EPOCA_0_BTML } from './epocas.js';
import { ContextoEje } from './contexto-eje.js';
import { evaluar, rellenar, nombreDeRegla, evaluarPlantilla } from './bqlm.js';
import { crearEvento } from './evento.js';
import { partirClave, validarMovimiento, ESCALAS_INFORMATIVAS, ANUNCIADO, esAnunciado, claveToken } from './tokens.js';
import { exigido as exigidoDe, tDelCoste } from './escritura.js';
import { direccion, esReferencia, esDecupla } from './btml.js';
import { plantilla as plantillaDeDatos, etiqueta as etiquetaDe, ocupantes as ocupantesDeContrato, nombreDePlantilla, madurez, niveles as nivelesGenericos, configuracion, mensaje, texto as textoDe, claves, motivo as motivoDe, guia as guiaDeLaEpoca, desdeLegible, anclaDeLasOpiniones, celdaDeEjecucion } from './contrato.js';
import { recuento, cerrado as cerradoDe } from './motor.js';
import { pendientes as peticionesPendientes } from './lente.js';

const RE_ID = /^[0-9a-f]{64}$/;

// ---------- la época y sus sitios ----------

const epocaDe = (opciones) => opciones?.epoca ?? EPOCA_0_BTML;
const raizDe = (epoca) => (Array.isArray(epoca) ? epoca : epoca.registro ?? epoca.payload);
/** Dónde pone la época lo que este módulo lee. */
const SITIO = Object.freeze({
  acciones: [9, 6], // la lista de referencias a las plantillas de transacción
  estaciones: [4, 2], // [[familia], [qué se hace], [la plantilla que cumple un movimiento anunciado]]
  estacionesDelAnuncio: [4, 3], // [[nombre], [lo que la comprueba: una fórmula con it = el anuncio, o epoch.9.0.0]] (VG 12-11, decisión 8)
  identidad: [3, 0], // la plantilla de identidad: su 9 es el tutorial del alta
  recuentos: [9, 0, 0, 1], // las plantillas de recuento: [[nombre], [fórmula]]
  dia: [7, 0, 3, 1], // los segundos de un día del calendario
  revisiones: [9, 0, 4, 1], // las lecturas de revisión del modo de ejecución: [[nombre], [fórmula]] (VG 12-11, #71.1)
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

// ---------- 1b. el modo de ejecución (VG 12-11, #71.1; CONVERGENCIA de AARPIA §2.2) ----------

/**
 * Los tres modos de ejecución de una plantilla (su 3.1), en el canónico (inglés); sus textos, en epoch.9.4 por la clave
 * «launch mode <modo>» (persona, agente, sistema). `person` es el defecto: solo una persona la lanza.
 */
export const MODOS_DE_EJECUCION = Object.freeze(['person', 'agent', 'system']);

/** El modo que una plantilla declara en su 3.1 (`person` si no lo dice o dice un valor que no es uno de los tres). */
export function modoDeclarado(plantilla) {
  const v = texto(hoja(hojas(plantilla?.[3])[1]));
  return MODOS_DE_EJECUCION.includes(v) ? v : 'person';
}

/**
 * Los ids de las plantillas de transacción que el dueño de la época revisó para que las lance el sistema solo: la
 * lectura «reviewed to run by the system» (epoch.9.0.4) con it = el génesis del libro (los registros anclados en su 9.6
 * con «review execution mode» en su 4, escritos por el autor del génesis, y el id de la plantilla en su 2). Solo lee.
 */
export function plantillasRevisadas(eje, opciones = {}) {
  const g = eje?.genesisId;
  const formula = g ? formulaDeEjecucion('reviewed to run by the system', opciones) : null;
  if (!formula) return new Set();
  return new Set((valores(formula, contextoDe(eje, epocaDe(opciones), {}), g).valores ?? []).filter((x) => typeof x === 'string'));
}

/** La fórmula de epoch.9.0.4 que se llama así (null si la época no la trae). */
function formulaDeEjecucion(nombre, opciones) {
  const lectura = hojas(en(raizDe(epocaDe(opciones)), SITIO.revisiones)).filter(Array.isArray).find((c) => texto(hoja(c[0])) === nombre);
  const formula = texto(ultima(lectura?.[1]));
  return esFormula(formula) ? formula : null;
}

/**
 * ¿Es `identidad` un agente? Una cosa (su alta la escribió otra) que su dueño ha declarado agente con un registro anclado en
 * el 9 de su alta que dice «declare agent» en su 4 (la lectura «declared as an agent», epoch.9.0.4). Un agente no lanza las
 * plantillas de modo `person`; una cosa sin declarar (Core, la cocina de los ejemplos) y una persona, sí.
 */
export function esAgente(eje, identidad, opciones = {}) {
  if (typeof identidad !== 'string' || !identidad || eje?.esPersona?.(identidad) !== false) return false;
  const formula = formulaDeEjecucion('declared as an agent', opciones);
  return Boolean(formula) && valores(formula, contextoDe(eje, epocaDe(opciones), {}), identidad).valores?.[0] === true;
}

/**
 * El modo de ejecución de una plantilla (su nombre, su id o su décupla): { declarado, modo, revisado, id }. `declarado`
 * es el que dice su 3.1; `modo`, el que rige: «system» solo rige si el dueño de la época lo revisó (un registro anclado
 * sobre el génesis que nombra el id de la plantilla, `plantillasRevisadas`); sin revisión, una plantilla que declara
 * «system» se lee «agent». Cambiar la plantilla le cambia el id y anula su revisión. null si no hay tal plantilla.
 */
export function modoDeEjecucion(eje, cual, opciones = {}) {
  const plantilla = plantillaDeTransaccion(cual, opciones);
  if (!plantilla) return null;
  const id = plantillasDeTransaccion(opciones).find((p) => p.plantilla === plantilla)?.id ?? null;
  const declarado = modoDeclarado(plantilla);
  const revisado = declarado === 'system' && id !== null && plantillasRevisadas(eje, opciones).has(id);
  return { declarado, modo: declarado === 'system' && !revisado ? 'agent' : declarado, revisado, id };
}

/**
 * Qué se hace con un parámetro (su 4): { que: 'payload' | 'key' | 'proof' | 'file', para } (`para`: en key y proof, la
 * identidad, con huecos {parámetro}; en file, qué del archivo adjunto es: «ref», su referencia archivo:<sha256>, o
 * «format», el formato de la época con que se representa). Un parámetro «file» va al payload como cualquiera: el 4
 * solo le dice a quien lanza la acción que el valor sale de subir un archivo (la carta abre el selector de archivos).
 */
function destinoDe(cuatro) {
  const [que, para] = hojas(cuatro).map(texto);
  if (que === 'key' || que === 'proof') return { que, para: para ?? '' };
  if (que === 'file') return { que, para: para === 'format' ? para : 'ref' };
  return { que: 'payload', para: null };
}

/** Qué del archivo adjunto pide un parámetro (su 4 «file»): 'ref' (su referencia) o 'format' (su formato); null si no pide un archivo. */
export const archivoDe = (p) => (p?.destino?.que === 'file' ? p.destino.para : null);

/**
 * Los parámetros que pide una plantilla, leídos de su 1: [{ nombre, etiqueta, tipo, validacion, posicion, requerido,
 * defectos, ayuda, orden, destino }]. `posicion` es dónde va en el registro que escribe («1.2»; «-» si no va en él);
 * `destino`, qué se hace con él (su 4: el payload, la clave y la prueba de posesión que declara el registro, o un archivo adjunto); `defectos`
 * son las hojas del 9 menos la ayuda (una fórmula «=…» se evalúa sobre it = X, me y la candidata). `nombre` es el
 * canónico (inglés); `etiqueta` y `ayuda`, con `opciones.idioma`, su traducción (epoch.9.4: «template <nombre> param
 * <etiqueta> label | help»).
 */
export function parametros(plantilla, opciones = {}) {
  const nombre = nombreDeAccion(plantilla);
  const t = (clave, original) => textoDe(null, clave, opciones.idioma, { original, epoca: opciones.epoca });
  const lista = Array.isArray(plantilla?.[1]) ? plantilla[1].filter((p) => Array.isArray(p) && esDecupla(p)) : [];
  return lista.map((p) => {
    const k = texto(hoja(p[0]));
    return {
      nombre: k,
      etiqueta: t(claves.parametro(nombre, k, 'label'), k),
      tipo: texto(hoja(p[1])) ?? 'text',
      validacion: esFormula(texto(ultima(p[2]))) ? texto(ultima(p[2])) : null,
      posicion: texto(hoja(p[5])) ?? '-',
      requerido: hoja(p[7]) === 'required',
      defectos: hojas(p[9]).slice(0, -1),
      ayuda: t(claves.parametro(nombre, k, 'help'), texto(ultima(p[9])) ?? ''),
      orden: Number(hoja(p[8])) || 0,
      destino: destinoDe(p[4]),
    };
  }).sort((a, b) => a.orden - b.orden);
}

/** El idioma de quien mira: el que se pide, o el de su configuración (la preferencia «language»); sin él, el canónico. */
const idiomaDe = (eje, yo, opciones) => opciones?.idioma ?? configuracion(eje, yo, opciones).language ?? 'en';

// ---------- la candidata: el registro que la plantilla describe ----------

/** El camino de dígitos de una posición «1.2» (o «-» si no va en el registro). */
const caminoDe = (posicion) => (posicion === '-' ? null : String(posicion).split('.').map(Number));

/** Pone un valor en una posición del payload (creando las décuplas intermedias): una hoja va entre corchetes (forma canónica), una lista tal cual. */
function poner(payload, camino, valor) {
  let nodo = payload;
  for (let k = 0; k < camino.length - 1; k++) {
    if (!Array.isArray(nodo[camino[k]])) nodo[camino[k]] = [];
    nodo = nodo[camino[k]];
  }
  nodo[camino[camino.length - 1]] = Array.isArray(valor) ? valor : [valor];
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
 * parametros, motivos } con los motivos de los parámetros que fallan (cada uno { regla, mensaje }, con la etiqueta y
 * la ayuda del parámetro en el idioma).
 */
function preparar(eje, plantilla, X, yo, params, { t, epoca, idioma }) {
  const nombre = nombreDeAccion(plantilla);
  const lista = parametros(plantilla, { idioma, epoca });
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
  // El registro del ancla, si la plantilla lo dice (su 5): si sale de un parámetro que aún no está (un defecto, como el
  // anuncio que «pay» cumple: VG 12-11, decisión 8), se vuelve a mirar con los defectos puestos.
  let sinAncla = false;
  if (esFormula(formulaRegistro)) {
    const r = valores0(eje, epoca, formulaRegistro, provisional, yo, X);
    if (typeof r !== 'string' || !eje.obtener(r)) sinAncla = true;
    else sobre = r;
  }
  const rutaLlena = conHuecos(ruta ?? '0', valores);
  const digitos = rutaLlena.split('.').map(Number);
  const enDir = digitos.every((d) => Number.isInteger(d) && d >= 0 && d <= 9) && digitos.length <= 10 ? direccion(digitos) : null;
  if (!enDir) motivos.push({ regla: nombre, mensaje: motivoDe('anchor not a position', { name: nombre, path: rutaLlena }, { idioma, epoca }) });
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
  if (sinAncla) {
    const r = valores0(eje, epoca, formulaRegistro, candidata, yo, X);
    if (typeof r !== 'string' || !eje.obtener(r)) motivos.push({ regla: nombre, mensaje: motivoDe('anchor not in ledger', { name: nombre, formula: String(formulaRegistro) }, { idioma, epoca }) });
    else candidata.sobre = r;
  }
  // Validar: lo requerido está, y cada valor cumple su 2.
  const ctx = contextoDe(eje, epoca, { ev: candidata, me: yo });
  for (const p of lista) {
    const v = valores[p.nombre];
    if (v === undefined) {
      if (p.requerido) motivos.push({ regla: p.nombre, mensaje: p.etiqueta + ': ' + p.ayuda, parametro: p.nombre });
      continue;
    }
    if (p.validacion && !cumple(p.validacion, ctx, sujetoDeValor(v))) motivos.push({ regla: p.nombre, mensaje: p.etiqueta + ': ' + p.ayuda, parametro: p.nombre });
  }
  for (const h of huecos(payload)) motivos.push({ regla: nombre, mensaje: motivoDe('position without value', { name: nombre, position: h }, { idioma, epoca }) });
  return { sobre: candidata.sobre, en: candidata.en, payload, valores, parametros: lista, motivos, candidata };
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
 * pasa, en el orden de su 8: [{ nombre, id, etiqueta, plantilla, parametros, porDefecto, lectura, camino }]. `nombre`
 * es el canónico (inglés) e `id` el del registro de la plantilla (los dos la nombran en transaccion); `etiqueta`, el
 * nombre en el idioma de yo (o el de `opciones.idioma`), como la etiqueta y la ayuda de cada parámetro. Cada parámetro
 * lleva su valor por defecto ya resuelto (`valor`) y si falta (`falta`). Nada se decide aquí: si una acción no debe
 * aparecer, lo dice su 2.
 */
export function acciones(eje, X, k, yo, opciones = {}) {
  const ev = eventoDe(eje, X);
  if (!ev || typeof ev.id !== 'string' || !eje?.obtener(ev.id)) return [];
  const epoca = epocaDe(opciones);
  const idioma = idiomaDe(eje, yo, opciones);
  const ctx = contextoDe(eje, epoca, { me: yo });
  const fuera = [];
  for (const { nombre, plantilla, pv, id } of plantillasDeTransaccion(opciones)) {
    if (pv !== Number(k)) continue;
    const condicion = texto(ultima(plantilla[2]));
    if (!esFormula(condicion) || !cumple(condicion, ctx, sujetoDe(ev))) continue;
    const { valores, parametros: lista } = preparar(eje, plantilla, ev, yo, {}, { t: relojDe(eje, opciones), epoca, idioma });
    fuera.push({
      nombre,
      id,
      etiqueta: textoDe(eje, claves.plantilla(nombre), idioma, { original: nombre, epoca }),
      plantilla,
      parametros: lista.map((p) => ({ nombre: p.nombre, etiqueta: p.etiqueta, tipo: p.tipo, requerido: p.requerido, ayuda: p.ayuda, posicion: p.posicion, valor: valores[p.nombre], falta: p.requerido && valores[p.nombre] === undefined, archivo: archivoDe(p) })),
      porDefecto: fuera.length === 0,
      lectura: esLectura(plantilla),
      camino: esCamino(plantilla),
      ...modoParaLanzar(eje, plantilla, yo, opciones),
    });
  }
  return fuera;
}

/**
 * Lo que el modo de ejecución de una plantilla dice de quien la lanza: { modo, puedeLanzar }. Una plantilla «person» no la
 * lanza un agente (una cosa que su dueño declaró agente: `esAgente`); las de modo «agent» y «system», cualquiera.
 */
function modoParaLanzar(eje, plantilla, yo, opciones) {
  const { modo } = modoDeEjecucion(eje, plantilla, opciones);
  return { modo, puedeLanzar: modo !== 'person' || !esAgente(eje, yo, opciones) };
}

/** El reloj con que se fecha una candidata: el que se pide, o el mayor t del libro. */
function relojDe(eje, opciones) {
  if (opciones?.t) return opciones.t;
  const ms = eje?.tMaximo?.();
  return Number.isFinite(ms) ? new Date(ms).toISOString().replace('.000Z', 'Z') : new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// ---------- 3. construir y validar ----------

/** Los campos de una serie para un movimiento, desde su clave (R:ana, T:minuto, E:casa/EUR, P:<ámbito>/<origen>). */
function serieDe(clave) {
  if (typeof clave !== 'string' || !clave.includes(':')) return null;
  const p = partirClave(clave);
  const { token } = p;
  if (token === 'E') return { token, emisor: p.emisor, denominacion: p.denominacion, ...(p.registro ? { registro: p.registro } : {}) };
  if (token === 'P') return { token, ambito: p.ambito, ...(p.origen ? { origen: p.origen } : {}) };
  if (token === 'R') return { token, emisor: p.emisor };
  if (token === 'T') return { token, escala: p.escala };
  return null;
}

/** Las sentencias del 4 (VG 12-11, decisiones 5 y 6): las fórmulas «=…» del BQL mínimo con los verbos, en su orden. */
export const sentenciasDe = (plantilla) => (Array.isArray(plantilla?.[4]) ? plantilla[4] : []).filter(esFormula);

/** ¿Está migrada la plantilla? (VG 12-11, decisión 10): su 4 lleva sentencias, o «write» si no mueve más que el coste. */
export const migrada = (plantilla) => sentenciasDe(plantilla).length > 0 || (Array.isArray(plantilla?.[4]) && plantilla[4].includes('write'));

/**
 * Los movimientos de las sentencias del 4 (VG 12-11, decisiones 5 y 6): bqlm.evaluarPlantilla las evalúa en orden sobre
 * la candidata (it = X, me = yo, memo = su payload) y anota lo que mueven sus verbos; aquí solo se recoge, se redondea
 * y pasa la forma (validarMovimiento, el suelo). Lo que construye una plantilla no concede nada: la candidata la firma
 * quien la lanza y la validan después las reglas, que solo leen; nombrar una serie no da nada: lo que no está en la
 * cartera de quien la mueve, el libro no lo deja salir (saldo insuficiente). `when` en lo que no es T informativo lo
 * anuncia (decisión 8).
 * Devuelve { movimientos, motivos }.
 */
function movimientosBql(eje, epoca, plantilla, candidata, yo, X, idioma) {
  const nombre = nombreDeAccion(plantilla);
  const ctx = contextoDe(eje, epoca, { ev: candidata, me: yo });
  const r = evaluarPlantilla(sentenciasDe(plantilla), ctx, { sujeto: sujetoDe(X) });
  if (r.estado !== 'RESUELTO') return { movimientos: [], motivos: [{ regla: nombre, mensaje: nombre + ': ' + r.estado + ': ' + r.motivo }] };
  const movimientos = [];
  const motivos = [];
  const sinSerie = (cantidad) => motivos.push({ regla: nombre, mensaje: motivoDe('no series', { name: nombre, amount: cantidad }, { idioma, epoca }) });
  for (const v of r.movimientos) {
    const serie = serieDe(v.serie);
    if (!serie) { sinSerie(v.cantidad); continue; }
    const m = { ...serie, cantidad: Math.round(v.cantidad * 1e9) / 1e9 };
    const informativo = serie.token === 'T' && ESCALAS_INFORMATIVAS.includes(serie.escala);
    if (v.verbo === 'mint') {
      Object.assign(m, { de: null, a: v.a });
      const p = v.precio === undefined ? undefined : plano(v.precio, ctx);
      if (serie.token === 'E' && Array.isArray(p) && esDecupla(p)) m.precio = [hoja(p[0]), hoja(p[1])];
    } else if (v.verbo === 'burn') {
      Object.assign(m, { de: v.de, a: null });
      if (informativo && typeof v.cuando === 'string') m.refiere = v.cuando;
    } else if (v.verbo === 'lock' || v.verbo === 'release') {
      Object.assign(m, { de: v.de, a: v.de, estado: v.verbo === 'lock' ? 'bloqueo' : 'liberacion', salida: v.salida });
    } else {
      Object.assign(m, { de: v.de, a: v.a, ...(v.salida === undefined ? {} : { salida: v.salida }) });
    }
    // Lo que lleva fecha y no es T informativo es un movimiento anunciado (VG 12-11, decisión 8): no se mueve todavía.
    if (v.cuando !== undefined && !informativo) Object.assign(m, { estado: ANUNCIADO, refiere: v.cuando });
    const errores = validarMovimiento(m);
    if (errores.length) motivos.push({ regla: nombre, mensaje: nombre + ': ' + errores.join('; ') });
    else movimientos.push(m);
  }
  return { movimientos, motivos };
}

/**
 * El coste de escribir la candidata (VG 12-11, decisión 7): lo que exige la regla de la época «the cost of writing»
 * (por posición) y la T que lo cubre, en la escala pedida (`escala`, una real) o en la menor que lo cubre
 * (escritura.tDelCoste). → { exigido (segundos), movimiento (la quema de T de quien escribe) | null }.
 */
export function costeDe(payload, yo, { epoca, escala, eje } = {}) {
  const segundos = exigidoDe(payload, { epoca, eje });
  const t = tDelCoste(segundos, escala);
  return { exigido: segundos, movimiento: t ? { token: 'T', escala: t.escala, cantidad: t.cantidad, de: yo, a: null } : null };
}

/**
 * El mensaje de una plantilla (su 9) relleno sobre la candidata, X y yo. Con `idioma`, el traducido de epoch.9.4
 * («template <nombre> message», con los mismos huecos); sin él, el canónico, que es lo que se escribe en el 0 del
 * registro (los datos van en inglés, como el 9 de las reglas).
 */
function mensajeDe(eje, epoca, plantilla, candidata, yo, X, idioma) {
  const nombre = nombreDeAccion(plantilla);
  const canonico = texto(ultima(plantilla[9]));
  const m = idioma ? textoDe(eje, claves.mensaje(nombre), idioma, { original: canonico, epoca }) : canonico;
  if (!m) return nombre;
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
 * [{ regla, mensaje }] } con los mensajes en el idioma de la configuración de yo (o el que se pida). Con
 * `opciones.firmar` (async (evento) → evento firmado) la candidata se firma antes de validarse y el evento vuelve
 * firmado (quien tiene clave firma: sin esto, una identidad con clave no pasaría la validación en seco). Si ok, la
 * carta lo asienta con lo que ya existe (eje.anadir); aquí no se asienta nada. Una plantilla que solo lee
 * (read) devuelve ok con `lectura`; una que lanza el camino (path), el paso que lanzaría (o todos, con path all).
 */
export async function transaccion(eje, cual, params = {}, yo, opciones = {}) {
  const plantilla = plantillaDeTransaccion(cual, opciones);
  const modo = plantilla ? modoDeEjecucion(eje, plantilla, opciones) : null;
  // El modo de ejecución (VG 12-11, #71.1): una plantilla «person» no la lanza un agente (una cosa que su dueño declaró agente); lo demás, como antes.
  if (modo && modo.modo === 'person' && esAgente(eje, yo, opciones)) {
    const epoca = epocaDe(opciones);
    const idioma = idiomaDe(eje, yo, opciones);
    const nombre = nombreDeAccion(plantilla);
    return { ok: false, evento: null, modo: modo.modo, motivos: [{ regla: nombre, mensaje: motivoDe('only a person launches', { name: nombre, who: yo, mode: textoDe(eje, claves.modo(modo.modo), idioma, { original: modo.modo, epoca }) }, { idioma, epoca }) }] };
  }
  const r = await construirTransaccion(eje, plantilla, cual, params, yo, opciones);
  return modo ? { ...r, modo: modo.modo } : r;
}

async function construirTransaccion(eje, plantilla, cual, params, yo, opciones) {
  const epoca = epocaDe(opciones);
  const idioma = idiomaDe(eje, yo, opciones);
  if (!plantilla) return { ok: false, evento: null, motivos: [{ regla: null, mensaje: motivoDe('unknown template', { template: String(Array.isArray(cual) ? cual[0] : cual?.ref ?? cual) }, { idioma, epoca }) }] };
  const nombre = nombreDeAccion(plantilla);
  const { X: cualX, ...dados } = params;
  const X = eventoDe(eje, cualX);
  if (!X || !eje?.obtener(X.id)) return { ok: false, evento: null, motivos: [{ regla: nombre, mensaje: motivoDe('X not in ledger', { name: nombre }, { idioma, epoca }) }] };
  if (typeof yo !== 'string' || !yo) return { ok: false, evento: null, motivos: [{ regla: nombre, mensaje: motivoDe('who launches', { name: nombre }, { idioma, epoca }) }] };
  const t = relojDe(eje, opciones);
  if (esLectura(plantilla)) {
    const { motivos, candidata } = preparar(eje, plantilla, X, yo, dados, { t, epoca, idioma });
    return { ok: motivos.length === 0, evento: null, motivos, lectura: { nombre, mensaje: mensajeDe(eje, epoca, plantilla, candidata, yo, X, idioma) } };
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
  const prep = preparar(eje, plantilla, X, yo, dados, { t, epoca, idioma });
  if (prep.motivos.length) return { ok: false, evento: null, motivos: prep.motivos };
  // Lo que mueve (VG 12-11, decisiones 5, 6 y 10): las sentencias del 4 en BQL; «write» no mueve más que el coste.
  const hecha = movimientosBql(eje, epoca, plantilla, prep.candidata, yo, X, idioma);
  const motivos = hecha.motivos;
  const movimientos = [...hecha.movimientos];
  if (motivos.length) return { ok: false, evento: null, motivos };
  const payload = prep.payload;
  // La representación del registro: el mensaje de la plantilla, salvo que un parámetro ocupe el 0.
  // Se rellena sobre la candidata sin movimientos: así el 1 y el 3 del payload no colisionan con D-META.
  if (!prep.parametros.some((p) => p.posicion === '0' && prep.valores[p.nombre] !== undefined)) payload[0] = mensajeDe(eje, epoca, plantilla, prep.candidata, yo, X);
  // El coste de escribir (VG 12-11, decisión 7): una regla de la época para toda candidata, por posición; va delante,
  // donde iba el minuto copiado. La escala, la pedida (opciones.escala) o la menor que lo cubre.
  let coste;
  try {
    coste = costeDe(payload, yo, { epoca, escala: opciones.escala, eje });
  } catch (e) {
    return { ok: false, evento: null, motivos: [{ regla: nombre, mensaje: nombre + ': ' + e.message }] };
  }
  if (coste.movimiento) movimientos.unshift(coste.movimiento);
  // Las claves que el registro declara y sus pruebas de posesión (un parámetro con «key {p}» o «proof {p}» en su 4): la
  // clave va en el contexto (el 5 del evento, dentro del cuerpo), la prueba fuera del cuerpo, como la firma; así una
  // persona da de alta una cosa con la clave de la cosa (la prueba la firma la cosa sobre el id de este registro).
  const claves = {};
  const posesion = {};
  for (const p of prep.parametros) {
    const v = prep.valores[p.nombre];
    if ((p.destino.que !== 'key' && p.destino.que !== 'proof') || v === undefined) continue; // payload y file van en el payload
    const quien = conHuecos(p.destino.para, prep.valores);
    if (!quien) return { ok: false, evento: null, motivos: [{ regla: p.nombre, mensaje: p.etiqueta + ': ' + p.ayuda, parametro: p.nombre }] };
    (p.destino.que === 'key' ? claves : posesion)[quien] = String(v);
  }
  let evento;
  try {
    evento = await crearEvento({ autor: yo, sobre: prep.sobre, en: prep.en, t, movimientos, payload, ...(Object.keys(claves).length ? { contexto: { claves } } : {}) });
    if (Object.keys(posesion).length) evento = Object.freeze({ ...evento, posesion });
    // Quien tiene clave firma (R9): la candidata se valida ya firmada, con lo que la carta sepa firmar (opciones.firmar,
    // async (evento) → evento firmado); si no, una identidad con clave vería siempre «who has a key signs».
    if (typeof opciones.firmar === 'function') evento = (await opciones.firmar(evento)) ?? evento;
  } catch (e) {
    return { ok: false, evento: null, motivos: [{ regla: nombre, mensaje: nombre + ': ' + e.message }] };
  }
  const textos = await eje.validar(evento);
  const delEje = motivosDelEje(eje, textos, evento, idioma, opciones);
  return { ok: delEje.length === 0, evento, motivos: delEje, exigido: coste.exigido };
}

// ---------- 3b. las opiniones como registros ----------

/**
 * El registro que nombra un texto: su id entero, los primeros caracteres de un id (ocho o más, si solo uno empieza así)
 * o su 0 (lo que dice contrato.desdeLegible para una referencia). null si no es ninguno.
 */
export function registroDe(eje, cual, opciones = {}) {
  const s = String(cual ?? '').trim();
  if (!s || !eje) return null;
  if (RE_ID.test(s) && eje.obtener(s)) return s;
  if (/^[0-9a-f]{8,63}$/.test(s)) {
    const a = eje.orden.filter((id) => id.startsWith(s));
    if (a.length === 1) return a[0];
  }
  const r = desdeLegible(s, 'ref', { eje, ...opciones });
  return typeof r.valor === 'string' ? r.valor : null;
}

/** El registro del proyecto donde `yo` ancla sus opiniones (su ajuste «opinions anchor», resuelto con registroDe), o null. */
export function proyectoDeOpiniones(eje, yo, opciones = {}) {
  const v = yo ? anclaDeLasOpiniones(eje, yo, opciones) : null;
  return v ? registroDe(eje, v, opciones) : null;
}

/**
 * Las opiniones ancladas en un registro (el proyecto AGRAM): los registros anclados bajo él cuya plantilla es la de
 * opinión (el nombre lo da la guía de la época, su 7), con sus respuestas (los registros anclados debajo de cada una, en
 * hilo). → [{ id, autor, t, texto, clasificacion: [«etiqueta: valor»], sobre (el id del registro opinado o null), ruta,
 * respuestas: [{ id, autor, t, texto, respuestas }] }], en el orden del libro. Lo lee la carta para listarlas en el 6 y
 * lo lee quien lea el eje desde fuera: sin código especial.
 */
export function opiniones(eje, proyecto, opciones = {}) {
  const P = eventoDe(eje, proyecto);
  const tipo = guiaDeLaEpoca(null, 'en', opciones)?.opinion;
  if (!P || !eje?.obtener(P.id) || !tipo) return [];
  const textoDe0 = (e) => String(hojas(e.payload?.[0]).find((x) => typeof x === 'string' || typeof x === 'number') ?? '');
  const hilo = (e, hondo) => eje.sobre(e.id).map((h) => ({ id: h.id, autor: h.autor, t: h.t, texto: textoDe0(h), respuestas: hondo < 12 ? hilo(h, hondo + 1) : [] }));
  const orden = new Map(eje.orden.map((id, i) => [id, i]));
  return eje.sobre(P.id)
    .filter((h) => nombreDePlantilla(plantillaDeDatos(eje, h, opciones)) === tipo)
    .sort((a, b) => orden.get(a.id) - orden.get(b.id))
    .map((h) => ({
      id: h.id, autor: h.autor, t: h.t, texto: textoDe0(h),
      clasificacion: hojas(h.payload?.[1]).filter((x) => typeof x === 'string'),
      sobre: hojas(h.payload?.[6]).find((x) => esReferencia(x))?.ref ?? null,
      ruta: hojas(h.payload?.[9]).filter((x) => typeof x === 'string'),
      respuestas: hilo(h, 0),
    }));
}

// ---------- 4. las estaciones ----------

/**
 * Las estaciones de la fábrica (epoch.4.2): [{ familia, estacion, plantilla, autoriza }]. `autoriza` (encargo «datos2»,
 * issue #11) es la cuarta posición de la estación, lo que autoriza un anuncio pendiente (la estación intermedia
 * «autorizada»): `epoch.9.0.0`, el recuento del anuncio con el criterio de su dueño; null si la época no dice nada.
 */
export function estacionesDeLaEpoca(opciones = {}) {
  const raiz = raizDe(epocaDe(opciones));
  return hojas(en(raiz, SITIO.estaciones)).filter((x) => Array.isArray(x) && esDecupla(x)).map((x) => {
    const autoriza = texto(hoja(x[3]));
    return { familia: hoja(x[0]), estacion: hoja(x[1]), plantilla: hoja(x[2]), autoriza: autoriza && autoriza !== '-' ? autoriza : null };
  });
}

/** Lo que una estación sabe leer como autorización (epoch.4.2, su cuarta posición): el recuento del anuncio (motor.recuento). */
const AUTORIZA = Object.freeze({ recuento: 'epoch.9.0.0' });

/** ¿Pasa el recuento de un anuncio (el de su dueño, motor.recuento) su umbral? Lo que autoriza un anuncio pendiente. */
function recuentoPasa(eje, id) {
  try { return recuento(eje, id).pasa === true; } catch { return false; }
}

/**
 * Las estaciones por las que pasa un movimiento anunciado (VG 12-11, decisión 8; #50): datos de la época (epoch.4.3),
 * en su orden, [{ nombre, comprueba }]: `comprueba` es una fórmula del BQL mínimo con it = el anuncio, o `epoch.9.0.0`
 * (el recuento del anuncio con el criterio de su dueño, motor.recuento). Hoy: propuesta, autorizada, ejecutada y
 * verificada. Sin ellas en la época, las tres de antes (propuesta, autorizada por el recuento, ejecutada si no está en
 * la lectura «stage» de su registro).
 */
export function estacionesDelAnuncio(opciones = {}) {
  const filas = hojas(en(raizDe(epocaDe(opciones)), SITIO.estacionesDelAnuncio)).filter((x) => Array.isArray(x) && esDecupla(x));
  const de = filas.map((x) => ({ nombre: texto(hoja(x[0])), comprueba: texto(ultima(x[1])) })).filter((x) => x.nombre && x.comprueba);
  return de.length ? de : [
    { nombre: 'propuesta', comprueba: '=count it.5 > 0' },
    { nombre: 'autorizada', comprueba: AUTORIZA.recuento },
    { nombre: 'ejecutada', comprueba: '=not (it in (first (first (up it)).4).8)' },
  ];
}

/**
 * La estación de un anuncio (VG 12-11, decisión 8): la última de epoch.4.3 que se cumple, comprobada sobre el anuncio
 * (el motor solo comprueba: los nombres y las condiciones son de la época). null si no es un registro del eje.
 */
export function estacionDeAnuncio(eje, id, opciones = {}) {
  if (!eje?.obtener(id)) return null;
  const ctx = contextoDe(eje, epocaDe(opciones), {});
  let fuera = null;
  for (const { nombre, comprueba } of estacionesDelAnuncio(opciones)) {
    const cumple_ = comprueba === AUTORIZA.recuento ? recuentoPasa(eje, id) : esFormula(comprueba) && cumple(comprueba, ctx, id);
    if (cumple_) fuera = nombre;
  }
  return fuera;
}

/**
 * Lo anunciado en X por estación (la lectura «stage», X.4.8, y los anuncios de su 4.1): [{ familia, estacion,
 * plantilla, autoriza, anunciados, hechos, pendientes, autorizados }], cada lista con los ids de los anuncios. La
 * familia de un anuncio se lee buscando su serie por su valor en las del libro (before.4). `autorizados` (encargo
 * «datos2», issue #11) son los pendientes que la estación da por autorizados (su `autoriza`): siguen pendientes.
 */
export function estaciones(eje, X, opciones = {}) {
  const ev = eventoDe(eje, X);
  if (!ev || !eje?.obtener(ev.id)) return [];
  const epoca = epocaDe(opciones);
  const ctx = contextoDe(eje, epoca, {});
  const s = '("' + ev.id + '")';
  // Los anuncios de X: los registros que su dueño ancla en su 4.1 (como los lee la plantilla de cerrado, por `down`:
  // lo anclado en el 4 de X no se confunde con ellos); los pendientes, la lectura «stage».
  const anuncios = '((down ' + s + ') where last (first it.6).5 = "4100000000" and first it.3 = first ' + s + '.3)';
  // La familia de un anuncio: la de su movimiento anunciado (VG 12-11, decisión 8: D-MOV 0.0.0) o, en la forma de antes
  // (un payload que imita un movimiento), la de la serie que nombra, buscada por su valor en las del libro (before.4).
  const familia = (f) => f + ' in (first (moves it where "anunciado" in it2.2)).0.0.0 or count (moves it where "anunciado" in it2.2) = 0 and ' + f + ' in (before.4.(first it.0)).0.0';
  return estacionesDeLaEpoca(opciones).map((e) => {
    const de = (expr) => (valores('((' + expr + ' where count it.5 > 0) where ' + familia(e.familia) + ') each 5', ctx).valores ?? []).filter((x) => typeof x === 'string');
    const anunciados = [...new Set(de(anuncios))];
    const pendientes = [...new Set(de(s + '.4.8'))];
    // La estación de cada anuncio (epoch.4.3); «autorizada» solo si la estación de su familia autoriza (su 4 de epoch.4.2).
    const estacion = new Map(anunciados.map((id) => { const x = estacionDeAnuncio(eje, id, opciones); return [id, x === 'autorizada' && !e.autoriza ? 'propuesta' : x]; }));
    return {
      ...e, anunciados, pendientes, hechos: anunciados.filter((id) => !pendientes.includes(id)),
      autorizados: pendientes.filter((id) => estacion.get(id) === 'autorizada'),
      verificados: anunciados.filter((id) => estacion.get(id) === 'verificada'),
      estacionDe: Object.fromEntries(estacion),
    };
  });
}

/**
 * Las ejecuciones de la fábrica de X, para la matriz del 4 (encargo «datos2», issue #11; Core, pendiente de revisar VG):
 * lo propio del 4 de X y cada registro anclado en X (en cualquier posición: registrar ya es ejecutar, docs/MOTOR.md),
 * por llegada: [{ ocupante, pv, posicion, accion, estacion }]. `posicion` es la que modifica (el primer dígito del `en`
 * del registro); `pv`, el tipo de interacción: el de la plantilla de transacción que el registro nombra en su 4 (la
 * acción que lo escribió) o, si es un anuncio del 4.1, el de la plantilla de su estación (pay, deliver); `estacion`,
 * la de un anuncio: «ejecutada» (hecho), «autorizada» (pendiente y autorizado) o «propuesta» (pendiente). Lo que no se
 * sabe va a null (lo propio del payload no tiene ni lo uno ni lo otro): la carta lo pone aparte, sin inventar celda.
 * Encargo «el4» (VG 12-11, #41): cada una lleva además su celda de la matriz del 4 (contrato.celdaDeEjecucion):
 * `oficio` (la fila, el tipo de acción), `ejecucion` (la columna, lo que mueve) y `por` (de dónde sale cada uno).
 */
export function ejecuciones(eje, X, opciones = {}) {
  const ev = eventoDe(eje, X);
  if (!ev || !eje?.obtener(ev.id)) return [];
  const plantillas = plantillasDeTransaccion(opciones);
  const porNombre = new Map(plantillas.map((p) => [p.nombre, p]));
  const estacionDe = new Map();
  const plantillaDe = new Map();
  for (const e of estaciones(eje, ev.id, opciones)) {
    for (const id of e.anunciados) plantillaDe.set(id, e.plantilla);
    // La estación de cada anuncio la dice la época (epoch.4.3; VG 12-11, decisión 8): el motor solo comprueba.
    for (const id of e.anunciados) estacionDe.set(id, e.estacionDe[id] ?? (e.pendientes.includes(id) ? (e.autorizados.includes(id) ? 'autorizada' : 'propuesta') : 'ejecutada'));
  }
  const anclados = eje.sobre(ev.id);
  const deX = new Set(anclados.map((h) => h.id));
  const total = ocupantesDeContrato(eje, ev.id, 4, 0, 0, opciones).total;
  const propios = ocupantesDeContrato(eje, ev.id, 4, 0, total, opciones).ocupantes
    .filter((o) => !(esReferencia(o) && deX.has(o.ref)))
    .map((o) => ({ ocupante: o, pv: null, posicion: null, accion: null, estacion: null, oficio: null, ejecucion: null, por: null }));
  return [...propios, ...anclados.map((h) => {
    const accion = hojas(h.payload?.[4]).find((x) => typeof x === 'string' && porNombre.has(x)) ?? plantillaDe.get(h.id) ?? null;
    const posicion = Number(String(h.en ?? '0')[0]);
    const celda = celdaDeEjecucion(eje, h.id, opciones);
    return {
      ocupante: { ref: h.id }, pv: accion && porNombre.has(accion) ? porNombre.get(accion).pv : null, posicion: Number.isInteger(posicion) ? posicion : null, accion, estacion: estacionDe.get(h.id) ?? null,
      oficio: celda?.oficio ?? null, ejecucion: celda?.ejecucion ?? null, por: celda?.por ?? null,
    };
  })];
}

// ---------- 5. el camino ----------

/**
 * Un movimiento anunciado (un registro en el 4.1 de X): { serie, cantidad, que, de, a }, o null. El anuncio es un
 * movimiento anunciado del libro (VG 12-11, decisión 8; para qué, el 0 del registro); mientras los ejemplos lo escriban
 * como antes, también un payload que imita un movimiento.
 */
function anuncioDe(registro) {
  const anunciados = (Array.isArray(registro?.movimientos) ? registro.movimientos : []).filter(esAnunciado);
  if (anunciados.length) {
    const que = typeof registro.payload === 'string' ? registro.payload : hojas(registro.payload?.[0]).find((x) => typeof x === 'string') ?? '';
    const movimientos = anunciados.map((m) => ({ serie: claveToken(m), cantidad: m.cantidad, de: m.de, a: m.a, ...(m.refiere ? { cuando: m.refiere } : {}) }));
    return { ...movimientos[0], que, movimientos };
  }
  const p = registro?.payload;
  const h = (x) => (Array.isArray(x) ? x[x.length - 1] : x);
  const serie = h(p?.[0]);
  const cantidad = h(p?.[1]);
  const de = h(p?.[3]?.[0]);
  const a = h(p?.[3]?.[1]);
  if (typeof serie !== 'string' || typeof cantidad !== 'number' || typeof de !== 'string' || typeof a !== 'string') return null;
  return { serie, cantidad, que: h(p?.[2]), de, a, movimientos: [{ serie, cantidad, de, a }] };
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
 * (eje, X, yo) → [{ plantilla, parametros, sobre?, porque?, id?, invalida? }]) cuyos pasos van marcados como sugerencia
 * y pasan por las mismas reglas (`pasa`, `motivos`); `sobre` es otro registro que X, `porque` se enseña con el paso, y
 * una con `invalida` (el motivo) no se construye: sale como paso inválido. `falta` se lee en humano con el 9 de la regla o de la plantilla, en el idioma de yo. Si la
 * madurez de X es 0 o desconocida, devuelve además `niveles` (los de su plantilla o los genéricos) para que la persona
 * se ubique. Orden: primero lo que nombra el criterio del dueño (X.2.3), luego lo que nombra el mío (el 2.3 de mi alta).
 */
export async function camino(eje, X, yo, opciones = {}) {
  const ev = eventoDe(eje, X);
  if (!ev || !eje?.obtener(ev.id)) return { pasos: [] };
  const epoca = epocaDe(opciones);
  const raiz = raizDe(epoca);
  const idioma = idiomaDe(eje, yo, opciones);
  const ctx = contextoDe(eje, epoca, { me: yo });
  const t = relojDe(eje, opciones);
  const plantillas = plantillasDeTransaccion(opciones);
  const porNombre = new Map(plantillas.map((p) => [p.nombre, p.plantilla]));
  const reglas = (epoca.reglasConId ?? []).map((x) => x.regla);
  const pasos = [];

  /** Un paso mío con una plantilla: sus parámetros por defecto y si ya está hecho (un registro mío en su ancla); `falta` se lee con su 9 en el idioma. */
  const mio = (nombre, extra = {}, sobre = ev) => {
    const plantilla = porNombre.get(nombre);
    if (!plantilla) return null;
    const prep = preparar(eje, plantilla, sobre, yo, extra, { t, epoca, idioma });
    const hecho = eje.sobreDe(prep.sobre, prep.en, new Set([yo])).length > 0;
    return { hacer: { plantilla: nombre, X: sobre.id, parametros: { ...Object.fromEntries(Object.entries(prep.valores)), ...extra }, lectura: esLectura(plantilla) }, hecho, falta: mensajeDe(eje, epoca, plantilla, prep.candidata, yo, sobre, idioma) };
  };

  // (1) El tutorial: el 9 de la plantilla de X (la de datos, o la de identidad si X es un alta) y el 9 del propio X.
  const esAlta = [...eje.identidades()].some((id) => eje.alta(id)?.id === ev.id);
  // El tutorial del alta (el 9 de la plantilla de identidad) es de quien la escribió: su dueño.
  const deIdentidad = esAlta && ev.autor === yo ? nombresDel9(en(raiz, SITIO.identidad)) : [];
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
  // Un proceso cerrado con error o caducado (VG 12-11, #71.2) no pide pasos: lo anunciado que quedó pendiente ya no se espera.
  const sinPasos = ['error', 'caducado'].includes(cerradoDe(eje, ev.id).fin);
  const pendientes = sinPasos ? [] : (valores('("' + ev.id + '").4.8', ctx).valores ?? []).filter((x) => typeof x === 'string').map((id) => eje.obtener(id)).filter(Boolean);
  for (const anuncio of pendientes) {
    const a = anuncioDe(anuncio);
    if (!a) continue;
    // Un anuncio puede llevar varios movimientos (VG 12-11, decisión 8: las noches de una reserva): un paso por quien los
    // mueve, con todos los suyos; el mío, con la plantilla de la estación de su familia.
    const porQuien = new Map();
    for (const m of a.movimientos) porQuien.set(m.de, [...(porQuien.get(m.de) ?? []), m]);
    for (const [de, ms] of porQuien) {
      const que = (mensaje(eje, 'stage', idioma, opciones) ?? 'stage') + ' · ' + (a.que ?? '') + ' ' + ms.map((m) => m.cantidad + ' ' + m.serie + ' ' + m.de + ' → ' + m.a).join('; ');
      const estacion = estacionDe.get(partirClave(ms[0].serie).token);
      if (de === yo && estacion) {
        const paso = mio(estacion.plantilla, { announcement: { ref: anuncio.id } });
        if (paso) { pasos.push({ fuente: 'reglas', regla: 'stage', ...paso, falta: que, hecho: false, espera: null, anuncio: anuncio.id }); continue; }
      }
      pasos.push({ fuente: 'reglas', regla: 'stage', falta: que, hacer: null, espera: de, hecho: false, anuncio: anuncio.id });
    }
  }
  // El recuento del dueño, si lo declara y no pasa.
  const recuentos = hojas(en(raiz, SITIO.recuentos)).filter(Array.isArray).map((x) => hoja(x[0]));
  const criterio = (valores('(("' + ev.id + '").2 where count it.5 = 0)', ctx).valores ?? []).concat(valores('(("' + ev.id + '").2.2 where count it.5 = 0)', ctx).valores ?? []);
  if (!sinPasos && criterio.some((x) => recuentos.includes(x))) {
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
  const reloj = Date.parse(t);
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
      // Lo que la sugerencia dice de sí misma, para quien la enseña: por qué (`porque`) y su identidad (`propuesta`).
      const suya = { ...(typeof s?.porque === 'string' && s.porque ? { porque: s.porque } : {}), ...(s?.id !== undefined ? { propuesta: s.id } : {}) };
      // Una sugerencia que no se entiende se enseña con su motivo (`invalida`), no se descarta en silencio.
      if (s && typeof s === 'object' && s.invalida) {
        pasos.push({ fuente: 'sugerencia', falta: String(nombre ?? ''), hacer: null, hecho: false, espera: null, pasa: false, motivos: [{ regla: null, mensaje: String(s.invalida) }], invalida: String(s.invalida), ...suya });
        continue;
      }
      if (!porNombre.has(nombre)) continue;
      // Una sugerencia puede tratar de otro registro (`sobre`): por defecto, el de X.
      const sobre = (s?.sobre !== undefined && eventoDe(eje, s.sobre)) || ev;
      // Una sugerencia puede traer su instante (`t`): la que lleva una prueba de posesión firmada sobre el id solo pasa con él.
      const r = await transaccion(eje, nombre, { X: sobre.id, ...(s?.parametros ?? {}) }, yo, typeof s?.t === 'string' && s.t ? { ...opciones, t: s.t } : opciones);
      const paso = mio(nombre, s?.parametros ?? {}, sobre);
      pasos.push({ fuente: 'sugerencia', ...paso, hecho: false, espera: null, pasa: r.ok, motivos: r.motivos, ...suya });
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
    fuera.niveles = (propios.length ? propios : nivelesGenericos(opciones)).map((n) => textoDe(eje, claves.nivel(n), idioma, { original: n, epoca }));
  }
  return fuera;
}

/**
 * Construye y lanza los pasos míos del camino, en orden, mientras pasen: cada uno se construye y se firma con
 * `transaccion` y `firmar(evento)` (lo que la carta sepa firmar; sin ella, el evento tal cual) y se asienta con eje.anadir.
 * Se detiene en el primero que no pasa. Devuelve { hechos: [{ paso, evento }], parado: { paso, motivos } | null }.
 */
export async function autoejecutar(eje, X, yo, firmar, opciones = {}) {
  const { pasos } = await camino(eje, X, yo, opciones);
  const hechos = [];
  for (const paso of pasos) {
    if (!paso.hacer || paso.espera || paso.hecho || paso.hacer.lectura) continue;
    const r = await transaccion(eje, paso.hacer.plantilla, { X: paso.hacer.X ?? X, ...paso.hacer.parametros }, yo, { ...opciones, firmar });
    if (!r.ok || !r.evento) return { hechos, parado: { paso, motivos: r.motivos } };
    let evento = r.evento; // ya firmado por transaccion con `firmar`: se valida y se asienta lo mismo
    try {
      evento = await eje.anadir(evento);
    } catch (e) {
      return { hechos, parado: { paso, motivos: [{ regla: null, mensaje: e.message }] } };
    }
    hechos.push({ paso, evento });
  }
  return { hechos, parado: null };
}

// ---------- 6. el personaje del sitio: la cruceta del propio nodo (encargo pv3, VG 12-11, issue #38) ----------

/** Un camino de anclaje de plantilla («3.{box}.1», «{place}.{position}») contra unos dígitos: los parámetros que lo dan, o null. */
function encajarRuta(ruta, digitos) {
  const trozos = String(ruta).split('.');
  const ir = (i, j, dados) => {
    if (i === trozos.length) return j === digitos.length ? dados : null;
    const m = /^\{([^{}]+)\}$/.exec(trozos[i]);
    if (!m) return Number(trozos[i]) === digitos[j] ? ir(i + 1, j + 1, dados) : null;
    // Un hueco toma uno o más dígitos, los más que pueda (lo de detrás, un dígito por trozo).
    for (let k = digitos.length - (trozos.length - i - 1); k >= j + 1; k--) {
      const r = ir(i + 1, k, { ...dados, [m[1]]: digitos.slice(j, k) });
      if (r) return r;
    }
    return null;
  };
  return ir(0, 0, {});
}

/**
 * El personaje de un sitio (VG, 12-11, issue #38: «el personaje es la configuración del sitio»): el sitio es un nodo,
 * X.<lugar> (un PV o un sub-PV: 3, 3.4), con sus diez posiciones, y pulsar su interrogante (o su muñeco, en animado)
 * abre la cruceta de ese nodo como menú de configuración. → { X, lugar, direccion, dueno, posiciones: [{ posicion,
 * nombre, ayuda?, valor, de, accion: { id, nombre, etiqueta, valores } | null }] }: el nombre de cada posición es la
 * regla corta de la época (0 qué es, 1 cuánto… 9 cómo); el valor, lo último que el dueño ancló exactamente ahí; la
 * acción, la primera plantilla de configuración (PV 0, no está en el aro) cuya ancla llega a X.<lugar>.<posición> y
 * cuya condición pasa para quien mira, con los parámetros que el sitio ya da (la caja, el lugar, la posición).
 */
export function sitio(eje, X, lugar, yo, opciones = {}) {
  const ev = eventoDe(eje, X);
  const digitos = (Array.isArray(lugar) ? lugar : String(lugar ?? '').split('.')).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 9);
  if (!ev || typeof ev.id !== 'string' || !eje?.obtener(ev.id) || !digitos.length || digitos.length >= 9) return null;
  const epoca = epocaDe(opciones);
  const idioma = idiomaDe(eje, yo, opciones);
  const ctx = contextoDe(eje, epoca, { me: yo });
  const configurar = plantillasDeTransaccion(opciones).filter((p) => p.pv === 0).filter((p) => {
    const condicion = texto(ultima(p.plantilla[2]));
    return yo && esFormula(condicion) && cumple(condicion, ctx, sujetoDe(ev));
  });
  const dueno = ev.autor;
  const posiciones = [];
  for (let k = 0; k <= 9; k++) {
    const camino = [...digitos, k];
    const escritos = typeof eje.sobreDe === 'function' ? eje.sobreDe(ev.id, direccion(camino), new Set([dueno])) : eje.sobre(ev.id, direccion(camino)).filter((e) => e.autor === dueno);
    const ultimo = escritos[escritos.length - 1];
    const valor = ultimo ? (Array.isArray(ultimo.payload) ? ultimo.payload.flat(2).filter((x) => typeof x === 'string' || typeof x === 'number') : [ultimo.payload]) : [];
    let accion = null;
    for (const p of configurar) {
      const ruta = hojas(p.plantilla[5])[0];
      const dados = typeof ruta === 'string' ? encajarRuta(ruta, camino) : null;
      if (!dados) continue;
      const lista = parametros(p.plantilla, { idioma, epoca });
      const valores = {};
      for (const [nombre, ds] of Object.entries(dados)) {
        const prm = lista.find((x) => x.nombre === nombre);
        if (!prm) continue;
        valores[nombre] = prm.tipo === 'number' && ds.length === 1 ? ds[0] : ds.join('.');
      }
      accion = { id: p.id, nombre: p.nombre, etiqueta: textoDe(eje, claves.plantilla(p.nombre), idioma, { original: p.nombre, epoca }), valores };
      break;
    }
    posiciones.push({ posicion: k, nombre: etiquetaDe(eje, null, camino, { idioma, epoca }), valor, de: ultimo?.id ?? null, accion });
  }
  return { X: ev.id, lugar: digitos, direccion: digitos.join('.'), dueno, posiciones };
}
