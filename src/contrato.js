// El contrato entre el núcleo y la pantalla, la mitad de datos (encargo 3c-1).
// Principio (VG): la pantalla, «la carta», pinta un registro X con un tamaño,
// en un punto de vista k, SIN LÓGICA PROPIA: todo lo que decide algo viene del
// núcleo como posición, vista o regla. Aquí no hay etiquetas, órdenes,
// divisiones ni niveles escritos: todo se lee de la época (`epoch`), de sus
// plantillas y de sus reglas; este módulo solo sabe dónde mira la época cada
// cosa y cómo se recorre un registro. Documentación: docs/CONTRATO.md.
//
//   plantilla(eje, X)                      el registro plantilla de X (lo nombra su 5) o null
//   etiqueta / ayuda / marcador / tipo     lo que dice la plantilla de una posición, y si calla, la regla corta de la época
//   validar(eje, X)                        [{ posicion, motivo }] con las validaciones «=…» de la plantilla (it = X)
//   representaciones(eje, X)               los ocupantes del 0 como representaciones, normalizadas y por tamaño mínimo
//   ocupantes(eje, X, d, desde, cuantos)   los ocupantes de una posición, en el orden que dice la época, paginados
//                                          (con `orden`, el de las listas verticales de un mundo: divisionDelMundo(…).orden)
//   division(eje, ruta, { datos, forma })  qué puntos de vista caben y cómo se disponen (epoch.8.3)
//   divisionDelMundo(eje, pv, { nivel })   la división de un mundo a pantalla completa: hijos, profundidad, forma, bandas, hilos, estilo, orden (epoch.8.7)
//   hijosDe(eje, X, pv, { nivel })         los hijos de X en un mundo: [{ digito, nombre, ocupantes, vacio }]
//                                          (con `direccion`, además lo derivado de cada hijo: leerRuta con la dirección entera)
//   leer(eje, N, d, { yo })                lo que el PV d lee de N: lo anclado en N.d y lo que deriva del libro (epoch.2, «point of view»)
//   leerRuta(eje, N, [d1, d2, …])          las lecturas encadenadas por los dígitos de una dirección (N.d1.d2…)
//   estilo(eje, X, { de })                 el estilo propio (X.0.9) o el de los de abajo (X.5.0) con su cascada: { css, origen }
//   cssSeguro(texto)                       un estilo saneado (solo declaraciones corrientes, sin recursos ni código) o ""
//   madurez(eje, X)                        el nivel de X (la lectura «maturity», X.8.1) y su medida (X.8.6)
//   diario(eje, X, desde, cuantos)         las transacciones del subárbol de X por llegada (o en el `orden` que se nombre), con sus asientos,
//                                          el PV de X del que cuelga cada una (`pv`) y el estado de su futuro (`estado`)
//   pvDeEntrada(eje, X, id)                el PV de X del que cuelga un registro de su subárbol (el hilo de las franjas)
//   estadoDeEntrada(eje, id)               el estado del futuro de un registro: previsto, bloqueado hasta, liberado, caduca, caducado (con su fecha)
//   franjaDeEntrada(eje, id, pv)           la franja de una entrada en el 6 o el 7 (el primer paso de la fila que da valor) y si es incongruente
//   cohorteDe(eje, X, { cohorte })         la cohorte del 8: contra quién se compara X, sus comparables por caja y quién escribió la base
//   yo(eje, identidad)                     mi alta y sus posiciones: cartera, criterio, atención, tiempo
//   configuracion(eje, yo)                 mis preferencias (el registro en el 9 de mi alta) o los defectos de la plantilla
//   mensaje(eje, regla, idioma, { ev })    el 9 de una regla en un idioma (epoch.9.4), con los huecos resueltos
//   texto(eje, clave, idioma, { original }) un texto de la época por su clave («template <nombre>», «level <nombre>»…)
//                                          en un idioma (epoch.9.4), o el canónico (en) o el original si falta
//   legible(eje, valor, tipo, { idioma })  un valor de una posición o un parámetro en texto legible, con sus partes
//   desdeLegible(texto, tipo, { eje })     la inversa mínima para editar los tipos simples: { valor } o { motivo }
//   opciones(eje, X, pv, { yo, idioma })   lo que se puede escribir en una posición, de los datos: [{ valor, texto }] (issue #5)
//
// Solo lee: nada de aquí escribe en el eje. Las entradas de acción son del encargo 3c-2: las plantillas de
// transacción, transaccion() y el camino (3c-2a); el libro local (src/local.js), los pasos (src/pasos.js) y los
// modelos de visualización (src/modelos.js) (3c-2b).

import { EPOCA_0_BTML } from './epocas.js';
import { ContextoEje } from './contexto-eje.js';
import { evaluar, rellenar, nombreDeRegla } from './bqlm.js';
import { esReferencia, esLista, esTerminal, esDecupla, indicesDe, resolver, direccion, ARIDAD } from './btml.js';
import { ocupantes as ocupantesDe } from './encaje.js';
import { ESCALAS_T, ESCALAS_INFORMATIVAS, partirClave, franjaDe, capacidadDe, claveToken } from './tokens.js';
import { esInstante, msUTC, msDeGuardado } from './instante.js';
import { HITOS, cajaDeCuota, confluir, situar, SIN_BASE_ESCRITA } from './bases.js';
import { pasoDe } from './pasos.js';
import { recuento, miradasDe } from './motor.js';
import { estadoDePaquete } from './lente.js';

const RE_ID = /^[0-9a-f]{64}$/;
const RE_SERIE = /^[EPRT]:.+/;
const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;
const RAIZ = '0000000000';
/** El separador de las partes de un texto legible (puntuación, no idioma). */
const SEPARADOR = ' · ';
/** Los tipos de dato de las plantillas que este módulo sabe leer y escribir (los de epoch.9.2.0.1 y los parámetros del aro); lo demás es texto. */
const TIPO = Object.freeze({ numero: 'number', referencia: 'ref', identidad: 'identity', instante: 'instant', nivel: 'level' });
/** Las claves de traducción (epoch.9.4): «template <nombre>», «template <nombre> param <etiqueta> label | help | placeholder», «template <nombre> message», «level <nombre>», «order <nombre>», «size <nombre>», «legible <qué>», «reason <qué>». */
const CLAVE = Object.freeze({
  plantilla: (nombre) => 'template ' + nombre,
  parametro: (nombre, etiqueta, que) => 'template ' + nombre + ' param ' + etiqueta + ' ' + que,
  mensaje: (nombre) => 'template ' + nombre + ' message',
  nivel: (nombre) => 'level ' + nombre,
  orden: (nombre) => 'order ' + nombre,
  tamano: (nombre) => 'size ' + nombre,
  legible: (que) => 'legible ' + que,
  motivo: (que) => 'reason ' + que,
  oficio: (nombre) => 'office ' + nombre,
  ejecucion: (nombre) => 'execution ' + nombre,
});
/** Los motivos con que una acción rechaza que no son de una regla de la época (src/acciones.js): su clave «reason <qué>» (epoch.9.4; el canónico, en el registro «en»; los huecos {…} los rellena `motivo`). */
export const MOTIVOS = Object.freeze(['anchor not in ledger', 'anchor not a position', 'position without value', 'no series', 'unknown template', 'X not in ledger', 'who launches']);

// ---------- la época y sus sitios ----------

/** La época que se lee: la que se pasa en las opciones (un objeto de cargarEpocaBtml) o la 0. */
const epocaDe = (opciones) => opciones?.epoca ?? EPOCA_0_BTML;
/** La décupla de la época. */
const raizDe = (epoca) => (Array.isArray(epoca) ? epoca : epoca.registro ?? epoca.payload);

/** Dónde pone la época cada cosa (los únicos caminos que este módulo conoce). */
const SITIO = Object.freeze({
  cortas: [5], // 5.p.d: la regla corta del dígito d en la profundidad p: [[nombre], [significado], [ejemplo]]
  familias: [1], // 1.3.1.e: las escalas de T
  modos: [8, 2], // [[nombre], [mínimo], [máximo]]
  bloque: [8, 3], // el espacio de bloque: 1 la tabla datos → PV, 2 la disposición por la forma del hueco, 3 el paso
  madurez: [8, 4], // 1 umbrales por posición, 2 sus nombres, 3 techos de los órdenes, 4 sus nombres
  ordenes: [8, 5], // 1 los órdenes: [[nombre], [mecanismo, …], [qué]]
  divisionDelMundo: [8, 7], // 1 la división de cada mundo a pantalla completa: [[pv], [hijos], [profundidad], [formas], [lo que mide], [estilo de los de abajo], [nota], [hilos]]
  pasosDeTamano: [8, 6], // 1 los pasos de tamaño de un PV en Mapped: [[nombre], [fracción en una esquina], [fracción en un lado], [datos que caben]]
  cerrados: [9, 0, 1, 1], // las plantillas de cerrado: [[nombre], [fórmula]]
  plantillas: [9, 2], // 0 la cabecera (0.1 el tipo genérico por dígito), 1… las plantillas de dominio
  preferencias: [9, 3], // la plantilla «preferences»
  guia: [9, 9], // 0 la cabecera, 1… las referencias a los registros de la guía del PV9 (leer: docs/CONTRATO.md §16)
  mensajes: [9, 4], // 0 la cabecera, 1… un registro por idioma: [[código, nombre], [«regla: texto», …]]
  representacion: [9, 5], // 1 los formatos (el primero, el de una hoja), 2 los tamaños: [[tamaño], [nombre], [datos]]
});

const en = (raiz, camino) => camino.reduce((n, d) => (Array.isArray(n) ? n[d] : undefined), raiz);
/** La primera hoja de una posición en forma canónica (la lista de uno se lee como su ocupante). */
const hoja = (x) => (Array.isArray(x) ? x[0] : x);
/** Las hojas de una posición: una lista, sus elementos; una hoja, ella sola; nada, ninguna. */
const hojas = (x) => (x === undefined || x === null ? [] : Array.isArray(x) ? x : [x]);
const ultima = (x) => (Array.isArray(x) ? x[x.length - 1] : x);
const texto = (x) => (typeof x === 'string' ? x : typeof x === 'number' ? String(x) : undefined);

/** Un camino de dígitos a partir de un dígito, un texto «1.2» o una lista. */
function caminoDe(d) {
  if (Array.isArray(d)) return d.map(Number);
  if (typeof d === 'number') return [d];
  if (typeof d === 'string') return d.includes('.') ? d.split('.').map(Number) : /^[0-9]{10}$/.test(d) ? indicesDe(d) : [Number(d)];
  throw new TypeError('una posición es un dígito, un camino «1.2» o una lista de dígitos');
}

/** El evento de X: su id, el evento mismo, o null. */
function eventoDe(eje, X) {
  if (typeof X === 'string') return eje?.obtener(X) ?? null;
  if (X && typeof X === 'object' && 'payload' in X) return X;
  return null;
}

/** El contexto del BQL mínimo sobre el eje, con la época que se lee y, si hace falta, una candidata. */
const contextoDe = (eje, epoca, ev) => new ContextoEje(eje, { ev, epoch: epoca });

/** El sujeto de una lectura o una validación: el id de un registro del eje, o la candidata del contexto. */
function sujetoDe(ctx, eje, ev) {
  if (typeof ev.id === 'string' && eje?.obtener(ev.id)) return ev.id;
  return ctx.nombre('ev');
}

/** Lo que vale una expresión del BQL mínimo en un contexto: la lista de ocupantes, o null si no se resuelve. */
function vale(expr, ctx, opciones) {
  const r = evaluar(expr, ctx, opciones);
  return r.estado === 'RESUELTO' ? r.valor : null;
}

/** Un ocupante del BQL mínimo como dato plano: su número, texto, símbolo (su nombre) o el valor del nodo (un id). */
function plano(o, ctx) {
  if (typeof o === 'number' || typeof o === 'string' || typeof o === 'boolean') return o;
  if (o && typeof o === 'object' && typeof o.simbolo === 'string') return o.simbolo;
  const v = ctx.valor(o);
  return v !== undefined ? v : ctx.texto(o);
}

/** Lo que vale una expresión, como datos planos; [] si no se resuelve. */
const planos = (expr, ctx) => (vale(expr, ctx) ?? []).map((o) => plano(o, ctx));
/** El primer valor plano de una expresión, o undefined. */
const uno = (expr, ctx) => planos(expr, ctx)[0];
/** Un sujeto como expresión del BQL mínimo: un id entre comillas, o `ev`. */
const expresion = (sujeto) => (typeof sujeto === 'string' ? '("' + sujeto + '")' : 'ev');

// ---------- 1. plantillas ----------

/**
 * ¿Es `r` una plantilla? Un registro cuya posición 4 lleva `template`: en su 4 mismo (una lista) o, si su 4 describe
 * el 4 de los datos (una décupla), en su 4.4 (qué se hace con lo que se hace). Como las reglas llevan read, put o las
 * primitivas en su 4.
 */
export function esPlantilla(r) {
  if (!Array.isArray(r) || !Array.isArray(r[4])) return false;
  const cuatro = r[4];
  if (esLista(cuatro)) return cuatro.includes('template');
  return Array.isArray(cuatro[4]) && cuatro[4].includes('template');
}

/** El nombre de una plantilla: la etiqueta de su 0 (el 0.0), que es el nombre del tipo. */
export const nombreDePlantilla = (p) => texto(hoja(hoja(p?.[0])));

/**
 * Las plantillas que hay: las de dominio de la época (epoch.9.2, detrás de su cabecera), la de preferencias
 * (epoch.9.3) y las escritas en el eje como registros (un registro con `template` en su 4). Cada una { nombre, registro,
 * donde }: `donde` es su dirección en la época o el id del registro del eje.
 */
export function plantillas(eje, opciones = {}) {
  const raiz = raizDe(epocaDe(opciones));
  const fuera = [];
  const dominio = en(raiz, SITIO.plantillas);
  (Array.isArray(dominio) ? dominio : []).forEach((p, k) => {
    if (k > 0 && esPlantilla(p)) fuera.push({ nombre: nombreDePlantilla(p), registro: p, donde: direccion([...SITIO.plantillas, k]) });
  });
  const preferencias = en(raiz, SITIO.preferencias);
  if (esPlantilla(preferencias)) fuera.push({ nombre: nombreDePlantilla(preferencias), registro: preferencias, donde: direccion(SITIO.preferencias) });
  for (const id of eje?.orden ?? []) {
    const e = eje.obtener(id);
    if (e && esPlantilla(e.payload)) fuera.push({ nombre: nombreDePlantilla(e.payload), registro: e.payload, donde: id });
  }
  return fuera;
}

/**
 * La plantilla de X: lo que nombra su 5 (dónde encaja: su tipo), por nombre (una de la época o del eje) o por
 * referencia (a una posición de la época, o a un registro del eje que sea una plantilla). Lo que no resuelve a una
 * plantilla no lo es: en un alta el 5 lleva su clave y su id (B4), y ni una clave ni un id de un registro corriente
 * son una plantilla. Devuelve la décupla de la plantilla, o null.
 */
export function plantilla(eje, X, opciones = {}) {
  const ev = eventoDe(eje, X);
  if (!ev || !Array.isArray(ev.payload)) return null;
  const epoca = epocaDe(opciones);
  const raiz = raizDe(epoca);
  const todas = () => plantillas(eje, opciones);
  for (const h of hojas(ev.payload[5])) {
    if (esReferencia(h)) {
      let destino = null;
      if (h.ref === epoca.id) destino = h.dir ? resolver(raiz, h.dir) : raiz;
      else destino = eje?.obtener(h.ref)?.payload ?? null;
      if (esPlantilla(destino)) return destino;
      continue;
    }
    if (typeof h !== 'string') continue;
    if (RE_ID.test(h)) {
      const e = eje?.obtener(h);
      if (e && esPlantilla(e.payload)) return e.payload;
      continue;
    }
    const nombrada = todas().find((p) => p.nombre === h);
    if (nombrada) return nombrada.registro;
  }
  return null;
}

/** Lo que una plantilla dice de la posición d (su décupla), o undefined si calla. Solo describe las posiciones de la profundidad 0. */
function descripcion(p, camino) {
  if (!p || camino.length !== 1) return undefined;
  const d = p[camino[0]];
  return Array.isArray(d) && esDecupla(d) ? d : undefined;
}

/** La regla corta de la época para un camino: la del último dígito en su profundidad (undefined fuera de las diez). */
function corta(raiz, camino) {
  const p = camino.length - 1;
  if (p < 0 || p >= ARIDAD) return undefined;
  return en(raiz, [...SITIO.cortas, p, camino[p]]);
}

/**
 * La etiqueta legible de la posición d de X: la de su plantilla (d.0) o la regla corta de la época (su nombre). Con
 * `idioma`, la de la plantilla se traduce por su clave («template <nombre> param <etiqueta> label», epoch.9.4).
 */
export function etiqueta(eje, X, d, opciones = {}) {
  const camino = caminoDe(d);
  const raiz = raizDe(epocaDe(opciones));
  const p = plantilla(eje, X, opciones);
  const desc = descripcion(p, camino);
  const propia = texto(hoja(desc?.[0]));
  if (propia !== undefined) return texto_(eje, CLAVE.parametro(nombreDePlantilla(p), propia, 'label'), opciones.idioma, { original: propia, epoca: opciones.epoca });
  return texto(hoja(corta(raiz, camino)?.[0])) ?? null;
}

/** La ayuda de la posición d de X: la última hoja del d.9 de su plantilla (traducida, con `idioma`), o el significado de la regla corta. */
export function ayuda(eje, X, d, opciones = {}) {
  const camino = caminoDe(d);
  const raiz = raizDe(epocaDe(opciones));
  const p = plantilla(eje, X, opciones);
  const desc = descripcion(p, camino);
  const propia = texto(ultima(desc?.[9]));
  if (propia !== undefined) return texto_(eje, CLAVE.parametro(nombreDePlantilla(p), texto(hoja(desc[0])), 'help'), opciones.idioma, { original: propia, epoca: opciones.epoca });
  return texto(hoja(corta(raiz, camino)?.[1])) ?? null;
}

/**
 * El marcador (placeholder, lo que se espera) de la posición d de X: las hojas del d.9 de la plantilla menos la ayuda
 * (con `idioma`, la traducción «… placeholder» si la hay, como una sola hoja); si calla, el ejemplo de la regla corta.
 */
export function marcador(eje, X, d, opciones = {}) {
  const camino = caminoDe(d);
  const raiz = raizDe(epocaDe(opciones));
  const p = plantilla(eje, X, opciones);
  const desc = descripcion(p, camino);
  const nueve = hojas(desc?.[9]);
  if (nueve.length > 1) {
    const traducido = opciones.idioma ? texto_(eje, CLAVE.parametro(nombreDePlantilla(p), texto(hoja(desc[0])), 'placeholder'), opciones.idioma, { epoca: opciones.epoca }) : null;
    return traducido === null ? nueve.slice(0, -1) : [traducido];
  }
  const ejemplo = texto(hoja(corta(raiz, camino)?.[2]));
  return ejemplo === undefined ? [] : [ejemplo];
}

/** El tipo de dato (y unidad o formatos) de la posición d de X: las hojas del d.1 de su plantilla, o el tipo genérico del dígito (epoch.9.2.0.1). */
export function tipo(eje, X, d, opciones = {}) {
  const camino = caminoDe(d);
  const raiz = raizDe(epocaDe(opciones));
  const desc = descripcion(plantilla(eje, X, opciones), camino);
  if (desc && hojas(desc[1]).length) return hojas(desc[1]).slice();
  const generico = hojas(en(raiz, [...SITIO.plantillas, 0, 1]))[camino[camino.length - 1]];
  return generico === undefined ? [] : [generico];
}

/**
 * Valida X con su plantilla: cada posición d cuya descripción lleva una fórmula «=…» en su d.2 se evalúa con `it` = X;
 * lo que no da verdadero sale como { posicion, motivo }, con el motivo que da la plantilla (la etiqueta y la ayuda de
 * la posición, en inglés o, con `idioma`, traducidas) o, si la fórmula no se resuelve, su estado. Vacía si todo pasa o
 * X no tiene plantilla.
 */
export function validar(eje, X, opciones = {}) {
  const ev = eventoDe(eje, X);
  const p = ev ? plantilla(eje, ev, opciones) : null;
  if (!p) return [];
  const epoca = epocaDe(opciones);
  const ctx = contextoDe(eje, epoca, ev);
  const sujeto = sujetoDe(ctx, eje, ev);
  const nombrePlantilla = nombreDePlantilla(p);
  const t = (clave, original) => texto_(eje, clave, opciones.idioma, { original, epoca: opciones.epoca });
  const fuera = [];
  for (let d = 0; d < ARIDAD; d++) {
    const desc = descripcion(p, [d]);
    const formula = texto(ultima(desc?.[2]));
    if (!formula || !formula.startsWith('=') || formula.startsWith('==')) continue;
    const r = evaluar(formula, ctx, { sujeto });
    const propio = texto(hoja(desc[0]));
    const nombre = propio === undefined ? String(d) : t(CLAVE.parametro(nombrePlantilla, propio, 'label'), propio);
    if (r.estado !== 'RESUELTO') fuera.push({ posicion: d, motivo: nombre + ': ' + r.estado + ': ' + r.motivo });
    else if (!(r.valor.length === 1 && r.valor[0] === true)) {
      const ayudaPropia = texto(ultima(desc[9]));
      const porque = ayudaPropia === undefined ? plano_(t(CLAVE.legible('does not satisfy'), null), { formula }) : t(CLAVE.parametro(nombrePlantilla, propio, 'help'), ayudaPropia);
      fuera.push({ posicion: d, motivo: nombre + ': ' + porque });
    }
  }
  return fuera;
}

// ---------- 2. representaciones ----------

/** Los formatos de las representaciones de la época (epoch.9.5.1), en su orden (el primero, el de una hoja: texto). */
export function formatos(opciones = {}) {
  return hojas(en(raizDe(epocaDe(opciones)), [...SITIO.representacion, 1])).filter((f) => typeof f === 'string');
}

/** Los tamaños de la época (epoch.9.5.2): [{ tamano, nombre, datos }], por tamaño. */
export function tamanos(opciones = {}) {
  const raiz = raizDe(epocaDe(opciones));
  return hojas(en(raiz, [...SITIO.representacion, 2])).filter(Array.isArray).map((t) => ({ tamano: hoja(t[0]), nombre: hoja(t[1]), datos: hoja(t[2]) })).sort((a, b) => a.tamano - b.tamano);
}

/**
 * Los colores de los puntos de vista de la época (epoch.9.5.4): { [pv]: '#rrggbb' }, uno por dígito del 0 al 9. Solo
 * entra lo que es un hex de seis cifras; si la época no trae paleta, el objeto sale vacío (la carta no pinta color).
 */
export function colores(opciones = {}) {
  const raiz = raizDe(epocaDe(opciones));
  const fuera = {};
  for (const c of hojas(en(raiz, [...SITIO.representacion, 4])).filter(Array.isArray)) {
    const pv = hoja(c[0]);
    const hex = hoja(c[1]);
    if (Number.isInteger(pv) && pv >= 0 && pv <= 9 && typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex)) fuera[pv] = hex.toUpperCase();
  }
  return fuera;
}

/**
 * Las representaciones de X: los ocupantes de su 0, normalizados [{ texto, tamano, formato, recurso }] y ordenados
 * por tamaño mínimo. Una hoja es una representación de texto sin tamaño mínimo (0; el formato es el primero de la
 * lista de la época); una décupla (en el 0, o un registro anclado en la raíz, que colisiona con el 0) es una
 * representación rica: su 0 el texto alternativo, su 1 [tamaño mínimo, formato], su 5 el recurso. Lo que no es de un
 * formato que la plantilla admite en su 0.1 (o la época en 9.5.1), o no tiene un tamaño de la época, se omite.
 */
export function representaciones(eje, X, opciones = {}) {
  const ev = eventoDe(eje, X);
  if (!ev) return [];
  const raiz = raizDe(epocaDe(opciones));
  const formatos = hojas(en(raiz, [...SITIO.representacion, 1]));
  const deHoja = formatos[0];
  const p = plantilla(eje, ev, opciones);
  const admite = (() => {
    const propios = hojas(descripcion(p, [0])?.[1]).filter((f) => formatos.includes(f));
    return new Set(propios.length ? propios : formatos);
  })();
  const medidas = new Set(tamanos(opciones).map((t) => t.tamano));
  const fuera = [];
  const deTexto = (h) => {
    if (!admite.has(deHoja)) return;
    if (esReferencia(h)) fuera.push({ texto: null, tamano: 0, formato: formatos.includes('ref') && admite.has('ref') ? 'ref' : deHoja, recurso: h });
    else fuera.push({ texto: String(h), tamano: 0, formato: deHoja, recurso: null });
  };
  const rica = (dec) => {
    const [tamano, formato] = hojas(dec[1]).map(hoja); // [tamaño, formato], o la décupla [[tamaño], [formato]] (1.0 y 1.1: lo que escribe una plantilla)
    if (!medidas.has(tamano) || !admite.has(formato)) return;
    fuera.push({ texto: texto(hoja(dec[0])) ?? null, tamano, formato, recurso: hoja(dec[5]) ?? null });
  };
  if (esTerminal(ev.payload)) deTexto(ev.payload);
  else if (Array.isArray(ev.payload) && ev.payload[0] !== undefined) {
    const cero = ev.payload[0];
    if (esTerminal(cero)) deTexto(cero);
    else if (esLista(cero)) cero.forEach(deTexto);
    else if (esDecupla(cero)) rica(cero);
  }
  if (typeof ev.id === 'string' && eje?.obtener(ev.id)) {
    for (const h of eje.sobre(ev.id, RAIZ)) if (Array.isArray(h.payload) && esDecupla(h.payload)) rica(h.payload);
  }
  return fuera.sort((a, b) => a.tamano - b.tamano);
}

// ---------- 3. ocupantes ordenados y paginados ----------

/** Los órdenes de la época (epoch.8.5.1): [{ nombre, mecanismo: [palabra, …], que }]; el primero es el defecto. */
export function ordenes(opciones = {}) {
  const raiz = raizDe(epocaDe(opciones));
  return hojas(en(raiz, [...SITIO.ordenes, 1])).filter(Array.isArray).map((o) => ({ nombre: hoja(o[0]), mecanismo: hojas(o[1]), que: hoja(o[2]) }));
}

/** El paso de la paginación que fija la época (epoch.8.3.3): «cargar más» de tantos en tantos. */
export function paso(opciones = {}) {
  const raiz = raizDe(epocaDe(opciones));
  return hoja(en(raiz, [...SITIO.bloque, 3, 1]));
}

/**
 * El orden que rige una posición de X: el d.8 de su plantilla, lo que el dueño nombra en el 2.3 de X, el que se pide en
 * `opciones.orden` (el de las listas verticales de un mundo, epoch.8.7: divisionDelMundo(…).orden) o el primero de la época.
 */
function ordenDe(eje, ev, camino, opciones) {
  const conocidos = ordenes(opciones);
  const nombres = new Set(conocidos.map((o) => o.nombre));
  const desc = descripcion(plantilla(eje, ev, opciones), camino);
  const propio = texto(ultima(desc?.[8]));
  if (propio && nombres.has(propio)) return conocidos.find((o) => o.nombre === propio);
  // El criterio del dueño, 2.3 (con quién: los nombres que cuentan; B2): un ocupante que se llame como un orden.
  const dos = Array.isArray(ev.payload) ? ev.payload[2] : undefined;
  const nombrados = Array.isArray(dos) && esDecupla(dos) ? hojas(dos[3]) : [];
  if (typeof ev.id === 'string' && eje?.obtener(ev.id)) {
    for (const h of eje.sobre(ev.id, direccion([2, 3]))) if (h.autor === ev.autor) nombrados.push(...(esTerminal(h.payload) ? [h.payload] : hojas(h.payload[0])));
  }
  const elegido = nombrados.filter((n) => typeof n === 'string' && nombres.has(n)).pop();
  return conocidos.find((o) => o.nombre === elegido) ?? conocidos.find((o) => o.nombre === opciones.orden) ?? conocidos[0];
}

/** Un orden de la época por su nombre (epoch.8.5.1), o null. */
const ordenPorNombre = (nombre, opciones) => (typeof nombre === 'string' ? ordenes(opciones).find((o) => o.nombre === nombre) ?? null : null);

/**
 * El mecanismo «instante» de un orden (epoch.8.5.1): por el t de cada uno, del más antiguo al más reciente, y a igual t
 * por llegada (la ordenación es estable). `tDe` da el t de cada elemento; sin t, va con el de su registro (`tPorDefecto`).
 */
function porInstante(lista, tDe, tPorDefecto) {
  const ms = (x) => { const v = msDeGuardado(tDe(x) ?? tPorDefecto); return Number.isNaN(v) ? Infinity : v; };
  return lista.map((x, i) => ({ x, i, ms: ms(x) })).sort((a, b) => a.ms - b.ms || a.i - b.i).map((e) => e.x);
}

/**
 * Los ocupantes de la posición `d` de X, tal cual (hojas, décuplas o referencias por su id; un registro anclado, la
 * referencia a su id), en el orden que dice la época y paginados: { total, desde, cuantos, orden, ocupantes }. La carta
 * nunca ordena ni filtra: el orden es el del d.8 de la plantilla de X, el que el dueño nombra en el 2.3 de X, el que se
 * pide en `opciones.orden` (las listas verticales del 6 y el 7: divisionDelMundo(…).orden) o, por defecto, el primero
 * de epoch.8.5 (por llegada). Con el mecanismo «instante», por el t de cada uno (el del registro referenciado; lo
 * propio, el de X). `cuantos` por defecto es el paso de la época.
 */
export function ocupantes(eje, X, d, desde = 0, cuantos, opciones = {}) {
  const ev = eventoDe(eje, X);
  if (!ev) return { total: 0, desde: 0, cuantos: 0, orden: null, ocupantes: [] };
  const camino = caminoDe(d);
  const orden = ordenDe(eje, ev, camino, opciones);
  const [mecanismo, ...marcas] = orden?.mecanismo ?? [];
  let lista;
  if (typeof ev.id === 'string' && eje?.obtener(ev.id)) {
    lista = ocupantesDe(eje, ev.id, camino, { orden: mecanismo === 'instante' ? 'llegada' : mecanismo, exacto: true })
      .filter((o) => o.tipo !== 'referencia')
      .map((o) => (o.tipo === 'escrito' ? { ref: o.evento } : o.contenido));
  } else {
    // Una candidata que aún no está en el eje: solo lo propio de su payload.
    const nodo = camino.reduce((n, k) => (Array.isArray(n) && !(n !== ev.payload && esLista(n)) ? n[k] : undefined), ev.payload);
    lista = nodo === undefined ? [] : esLista(nodo) ? [...nodo] : [nodo];
  }
  if (mecanismo === 'instante') lista = porInstante(lista, (x) => (esReferencia(x) ? eje?.obtener(x.ref)?.t : undefined), ev.t);
  if (marcas.includes('reverse')) lista.reverse();
  const n = cuantos ?? paso(opciones);
  return { total: lista.length, desde, cuantos: n, orden: orden?.nombre ?? null, ocupantes: lista.slice(desde, desde + n) };
}

// ---------- 4. el modelo de división ----------

/** Los modos de la época (epoch.8.2): [{ nombre, minimo, maximo }]; «todos» es sin tope. */
export function modos(opciones = {}) {
  const raiz = raizDe(epocaDe(opciones));
  return hojas(en(raiz, SITIO.modos)).filter(Array.isArray).map((m) => ({ nombre: hoja(m[0]), minimo: hoja(m[1]), maximo: typeof hoja(m[2]) === 'number' ? hoja(m[2]) : Infinity }));
}

/**
 * El modelo de división del espacio de bloque: cuántos datos caben → qué puntos de vista se enseñan y cómo. Lee la
 * tabla de epoch.8.3 (o la que la plantilla del registro en foco trae en su 9.9), la disposición por la forma del
 * hueco (lista si es más alto que ancho, matriz si es cuadrado: el umbral es de la época) y el paso de «cargar más».
 * `ruta` es el registro en foco (su id o el evento); `datos`, los que caben; `forma`, la del hueco: { ancho, alto }, el
 * cociente alto/ancho, o el nombre de una disposición de la época; `modo`, si se da, acota los datos a su máximo.
 * → { pvs, disposicion, paso, datos, maximo, cargarMas }.
 */
export function division(eje, ruta, { datos = 1, forma, modo, ...opciones } = {}) {
  const raiz = raizDe(epocaDe(opciones));
  const ev = eventoDe(eje, typeof ruta === 'object' && ruta && 'id' in ruta && !('payload' in ruta) ? ruta.id : ruta);
  const p = ev ? plantilla(eje, ev, opciones) : null;
  const propia = p?.[9]?.[9];
  const tabla = Array.isArray(propia) && esDecupla(propia) ? propia : en(raiz, [...SITIO.bloque, 1]);
  const filas = hojas(tabla).filter(Array.isArray).map((f) => ({ datos: hoja(f[0]), pvs: hojas(f[1]), condicion: texto(ultima(f[2])), alternativa: hojas(f[3]) }));
  const maximoTabla = Math.max(...filas.map((f) => f.datos));
  const elModo = modo ? modos(opciones).find((m) => String(m.nombre).toLowerCase() === String(modo).toLowerCase()) : undefined;
  const maximo = elModo ? elModo.maximo : Infinity;
  const pedidos = Math.max(1, Math.min(Math.floor(datos), maximo));
  const n = Math.min(pedidos, maximoTabla);
  const cargarMas = pedidos > maximoTabla;
  const candidatas = filas.filter((f) => f.datos === n);
  let pvs = [];
  for (const f of candidatas) {
    if (f.condicion && f.condicion.startsWith('=') && !f.condicion.startsWith('==')) {
      const ctx = ev ? contextoDe(eje, epocaDe(opciones), ev) : null;
      const r = ev ? evaluar(f.condicion, ctx, { sujeto: sujetoDe(ctx, eje, ev) }) : { estado: 'PENDIENTE' };
      const cumple = r.estado === 'RESUELTO' && r.valor.length === 1 && r.valor[0] === true;
      pvs = cumple || !f.alternativa.length ? f.pvs : f.alternativa;
      if (cumple || f.alternativa.length) break;
      continue;
    }
    pvs = f.pvs;
    break;
  }
  // La disposición: las de la época, con su umbral del cociente alto/ancho; la primera es la del hueco alto.
  const disposiciones = hojas(en(raiz, [...SITIO.bloque, 2])).filter(Array.isArray).map((x) => ({ nombre: hoja(x[0]), umbral: hoja(x[2]) }));
  let disposicion = disposiciones[0]?.nombre ?? null;
  if (typeof forma === 'string' && disposiciones.some((x) => x.nombre === forma)) disposicion = forma;
  else {
    const cociente = typeof forma === 'number' ? forma : forma && typeof forma === 'object' && forma.ancho > 0 ? forma.alto / forma.ancho : Infinity;
    disposicion = (cociente > disposiciones[0]?.umbral ? disposiciones[0] : disposiciones[1] ?? disposiciones[0])?.nombre ?? null;
  }
  return { pvs: pvs.slice(), disposicion, paso: paso(opciones), datos: n, maximo, cargarMas };
}

/** Una fracción de la época: un número, o dos hojas [numerador, denominador]; lo que no se lee, 0. */
function fraccion(x) {
  const h = hojas(x).filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (h.length >= 2) return h[1] > 0 ? h[0] / h[1] : 0;
  return h.length ? h[0] : 0;
}

/**
 * Los pasos de tamaño de un punto de vista en una pantalla ancha (Mapped; epoch.8.6, VG 10-11), de menor a mayor:
 * [{ indice, nombre, esquina, lado, datos }], con `esquina` y `lado` la fracción de pantalla que ocupa un PV de la X
 * (1-4) o de la cruz (6-9) en ese paso y `datos` los que caben (lo que se pide a la división de 8.3). Con `idioma`,
 * cada uno trae además `texto`, su nombre traducido («size <nombre>»). La carta no lleva ninguno escrito: cambiar la
 * tabla en una copia de la época cambia los pasos, las fracciones y lo que cabe (docs/CONTRATO.md §4.1).
 */
export function pasosDeTamano(opciones = {}) {
  const raiz = raizDe(epocaDe(opciones));
  return hojas(en(raiz, [...SITIO.pasosDeTamano, 1])).filter(Array.isArray).map((p, indice) => {
    const nombre = texto(hoja(p[0]));
    const paso = { indice, nombre, esquina: fraccion(p[1]), lado: fraccion(p[2]), datos: Number(hoja(p[3])) || 0 };
    return opciones.idioma ? { ...paso, texto: texto_(null, CLAVE.tamano(nombre), opciones.idioma, { original: nombre, epoca: opciones.epoca }) } : paso;
  });
}

/**
 * Las escalas de T que el calendario mide (epoch.1.3 con epoch.7): las escalas de epoch.1.3.1 (cada una con su dígito,
 * 0-9) cuyo nombre está en el calendario de epoch.7, de la más fina a la más gruesa: [{ indice, escala, nombre }].
 */
function escalasDelCalendario(raiz) {
  const medidas = new Set(hojas(en(raiz, [7, 0])).filter(Array.isArray).map((r) => texto(hoja(r[0]))));
  return hojas(en(raiz, [1, 3, 1])).filter(Array.isArray).map((f, escala) => ({ escala, nombre: texto(hoja(f[0])) }))
    .filter((e) => medidas.has(e.nombre)).map((e, indice) => ({ indice, ...e }));
}

/**
 * Las diez cajas nivel.grado de los hitos de las bases (src/bases.js): [{ indice, nivel, grado, nombre, direccion? }];
 * `direccion`, la de su peldaño de la escalera dulce (escalera(), el enlace de la fila del 8), si la época la da.
 */
function cajasDeHitos(opciones = {}) {
  const pasos = escalera(opciones);
  return HITOS.map((h) => {
    const [nivel, grado] = String(h.nivel).split('.').map(Number);
    return { indice: h.indice, nivel, grado, nombre: h.nombre, ...(pasos[h.indice] ? { direccion: pasos[h.indice].direccion } : {}) };
  });
}

// ---------- 4.2 bis: la matriz del 4, la escalera dulce y el rango (encargo «el4», VG 12-11, issues #39, #40, #41) ----------

/** Las filas de epoch.8.7, la división de cada mundo. */
const filasDeDivision = (raiz) => hojas(en(raiz, [...SITIO.divisionDelMundo, 1])).filter(Array.isArray);
/** Lo que mide una fila de epoch.8.7: sus referencias, sin «-». */
const mideDeFila = (fila) => hojas(fila?.[4]).filter((s) => typeof s === 'string' && s !== '-');
/** Una dirección de la escalera: los diez dígitos de un punto del cubo [0..9]^10. */
const RE_DIRECCION = /^\d{10}$/;

/**
 * Los dos ejes de la matriz del 4 (VG 12-11, #41): el enlace de la fila de epoch.8.7 que mide «execution», dos listas,
 * [[los oficios], [[la ejecución, sus criterios…], …]]. → { filas: [{ indice, nombre, texto? }], columnas: [{ indice,
 * nombre, criterios, texto? }] } o null si la época no los da. Las filas son los oficios (el tipo de acción: 0 mostrar,
 * 1 gestionar, 2 administrar, 3 coordinar, 4 hacer, 5 verificar, 6 registrar, 7 planear, 8 medir, 9 guiar); las
 * columnas, la ejecución (lo que se mueve: 0 contenido que se muestra, 1 E, 2 P, 3 R, 4 T, 5 verificación sin token
 * propio, 6 adjudicación al pasado, 7 proyección al futuro, 8 crecimiento que genera rangos, 9 contenido que guía), cada
 * una con lo que la elige (celdaDeEjecucion). Con `idioma`, el `texto` de cada nombre («office <nombre>», «execution
 * <nombre>» de epoch.9.4; si falta, el nombre). Las filas van 0 … 9 y las columnas 1 … 9 y el 0 al final (VG 12-11: así la
 * escalera baja por la diagonal visual, de mostrar · E, 0.3, a guiar · contenido, 5.3); el `indice` de cada una es su dígito.
 */
export function ejesDeLaMatriz({ idioma, ...opciones } = {}) {
  const raiz = raizDe(epocaDe(opciones));
  const fila = filasDeDivision(raiz).find((r) => mideDeFila(r).includes(MIDE.ejecucion));
  const [oficios, ejecucion] = hojas(fila?.[8]).filter(Array.isArray);
  if (!oficios || !ejecucion) return null;
  const traducir = (clave, nombre) => (idioma ? { texto: texto_(null, clave, idioma, { original: nombre, ...opciones }) } : {});
  // El orden de pintado de las columnas (VG 12-11): 1 … 9 y el 0 (contenido que se muestra) al final; el `indice` sigue siendo el dígito. Las filas, 0 … 9.
  const al0Final = (a, b) => (a.indice === 0) - (b.indice === 0) || a.indice - b.indice;
  return {
    filas: hojas(oficios).filter((s) => typeof s === 'string').map((nombre, indice) => ({ indice, nombre, ...traducir(CLAVE.oficio(nombre), nombre) })),
    columnas: hojas(ejecucion).filter(Array.isArray).map((c, indice) => {
      const [nombre, ...criterios] = hojas(c).filter((s) => typeof s === 'string');
      return { indice, nombre, criterios, ...traducir(CLAVE.ejecucion(nombre), nombre) };
    }).sort(al0Final),
  };
}

/**
 * La escalera dulce (VG 12-11, #41): el enlace de la fila de epoch.8.7 que mide «rank» (el cielo del 8), una dirección
 * por caja, en el orden de las cajas: la fila k ↔ el dígito k+1 repetido k+1 veces con ceros detrás (la fila es el tipo
 * de acción y la dirección el intercambio hecho, un dígito más porque cambiar es más que ver; la fila 9 ↔ diez ceros, el
 * ciclo da la vuelta). → [{ indice, direccion, digito, profundidad, fila, columna, nivel, grado, nombre }]: `fila` es el
 * oficio (el índice) y `columna` la ejecución (el dígito) de su celda en la matriz del 4; `profundidad`, cuántas veces se
 * repite el dígito (diez ceros, diez); `nivel`, `grado` y `nombre`, los del hito de esa caja (src/bases.js, HITOS).
 */
export function escalera(opciones = {}) {
  const raiz = raizDe(epocaDe(opciones));
  const fila = filasDeDivision(raiz).find((r) => mideDeFila(r).includes(MIDE.rango) && hojas(r[8]).some((s) => RE_DIRECCION.test(String(s))));
  const direcciones = hojas(fila?.[8]).filter((s) => typeof s === 'string' && RE_DIRECCION.test(s));
  return direcciones.map((direccion, indice) => {
    const digito = Number(direccion[0]);
    const profundidad = direccion.length - direccion.replace(new RegExp('^' + direccion[0] + '+'), '').length;
    const h = HITOS[indice];
    const [nivel, grado] = h ? String(h.nivel).split('.').map(Number) : [null, null];
    return { indice, direccion, digito, profundidad, fila: indice, columna: digito, nivel, grado, nombre: h?.nombre ?? null };
  });
}

/** Lo que no es lo que una ejecución mueve: la asignación del día y el P que dan las reglas al escribir o al recibir. */
const NO_MUEVE = new Set(['asignacion', 'obtencion']);
/** La familia (E, P, R, T) de una serie «E:casa/EUR», o null. */
const familiaDeSerie = (serie) => (typeof serie === 'string' && /^[EPRT]:/.test(serie) ? serie[0] : null);

/**
 * La celda de una ejecución en la matriz del 4 (VG 12-11, #41; Core, pendiente de revisar VG): el registro `id`, anclado
 * en su padre. → { oficio, ejecucion, por: { oficio, ejecucion } } o null (sin registro o sin ejes en la época); `oficio`
 * o `ejecucion` a null si no se sabe (la carta lo pone aparte, sin inventar celda).
 *
 * - El **oficio** (la fila, el tipo de acción) es el PV de la plantilla de transacción que el registro nombra en su 4 (la
 *   acción que lo escribió por el aro, `por.oficio` «plantilla»); en un movimiento anunciado (lo anclado en el 4.1), el
 *   de la plantilla de la estación de su familia (epoch.4.2, «estacion»); si no, la posición que modifica, el primer
 *   dígito de su «en» (el PV k ↔ el oficio k, «posicion»).
 * - La **ejecución** (la columna) es lo que mueve, por los criterios de cada columna (ejesDeLaMatriz), en este orden: el
 *   tiempo (`scale <escala>`, el T de una escala informativa de epoch.1.3.1, pasado o futuro; `dated`, lo que tiene un
 *   estado con fecha, estadoDeEntrada); lo que mueve (`token <familia>`, por el orden de sus movimientos; en un anuncio,
 *   la serie anunciada); y si no mueve nada, la posición en que escribe (`content at <k>`) o el contenido (`content`).
 *   No cuentan como lo que se mueve la asignación del día, el P que dan las reglas ni el T propio que se quema al
 *   escribir (el coste de escribir, no un intercambio). En cada paso gana la primera columna que lo nombra.
 */
export function celdaDeEjecucion(eje, id, opciones = {}) {
  const h = eje?.obtener?.(esReferencia(id) ? id.ref : id);
  const ejes = h ? ejesDeLaMatriz(opciones) : null;
  if (!ejes) return null;
  const epoca = epocaDe(opciones);
  const anclaje = String(h.en ?? RAIZ);
  const posicion = Number(anclaje[0]);
  const plantillas = (Array.isArray(epoca.transacciones) ? epoca.transacciones : []).map((x) => x.plantilla);
  const pvDe = (nombre) => {
    const p = plantillas.find((q) => texto(hoja(q?.[0])) === nombre);
    const pv = p ? Number(hoja(p[8])) : NaN;
    return Number.isInteger(pv) ? pv : null;
  };
  const anunciada = anclaje.startsWith('41') ? texto(ultima(h.payload?.[0])) ?? null : null;
  const familiaAnunciada = familiaDeSerie(anunciada);
  let oficio = null;
  let porOficio = null;
  const nombrada = hojas(h.payload?.[4]).find((x) => typeof x === 'string' && pvDe(x) !== null);
  if (nombrada) { oficio = pvDe(nombrada); porOficio = 'plantilla'; }
  else if (familiaAnunciada) {
    const estacion = hojas(en(raizDe(epoca), [4, 2])).filter((x) => Array.isArray(x) && esDecupla(x)).find((x) => hoja(x[0]) === familiaAnunciada);
    const pv = estacion ? pvDe(texto(hoja(estacion[2]))) : null;
    if (pv !== null) { oficio = pv; porOficio = 'estacion'; }
  }
  if (oficio === null && Number.isInteger(posicion)) { oficio = posicion; porOficio = 'posicion'; }
  if (oficio !== null && oficio >= ejes.filas.length) oficio = null;
  // Lo que mueve: las familias por orden y las escalas informativas de T.
  const familias = [];
  const escalas = new Set();
  const anotar = (serie) => {
    const f = familiaDeSerie(serie);
    if (!f) return;
    const escala = f === 'T' ? serie.slice(2) : null;
    if (escala && ESCALAS_INFORMATIVAS.includes(escala)) escalas.add(escala);
    else if (!familias.includes(f)) familias.push(f);
  };
  if (familiaAnunciada) anotar(anunciada);
  else {
    const asientos = (h.sobre ? eje.libro.asientos({ registro: h.sobre }) : eje.libro.asientos()).filter((a) => a.tx?.id === h.id);
    for (const a of asientos) {
      if (NO_MUEVE.has(a.clase)) continue;
      const escala = familiaDeSerie(a.serie) === 'T' ? a.serie.slice(2) : null;
      const coste = a.primitiva === 'quemar' && escala && !ESCALAS_INFORMATIVAS.includes(escala) && a.de === h.autor && !a.a && !a.clase;
      if (!coste) anotar(a.serie);
    }
  }
  const fechado = Boolean(estadoDeEntrada(eje, h.id, opciones)?.fecha);
  const nada = !familias.length && !escalas.size && !fechado;
  let ejecucion = null;
  let porEjecucion = null;
  const elegir = (cumple) => {
    // En cada paso gana la primera columna por su dígito (0, 1 … 9), no por el orden en que se pintan.
    for (const c of [...ejes.columnas].sort((a, b) => a.indice - b.indice)) {
      const criterio = c.criterios.find(cumple);
      if (criterio) { ejecucion = c.indice; porEjecucion = criterio; return true; }
    }
    return false;
  };
  if (!elegir((k) => (k.startsWith('scale ') && escalas.has(k.slice(6))) || (k === 'dated' && fechado))) {
    if (!familias.some((f) => elegir((k) => k === 'token ' + f)) && nada) {
      if (!elegir((k) => k === 'content at ' + posicion)) elegir((k) => k === 'content');
    }
  }
  return { oficio, ejecucion, por: { oficio: oficio === null ? null : porOficio, ejecucion: porEjecucion } };
}

/**
 * El rango de X (VG 12-11, #39 y #41; Core, pendiente de revisar VG): uno solo, el del 8, el peldaño de la escalera dulce
 * (escalera()) que ha alcanzado. Cada peldaño k es una celda de su matriz del 4, la fila k con la columna de su dígito
 * (k+1; la fila 9 con la 0), y su profundidad (k+1); X cubre esa celda a profundidad n si hay una cadena de n
 * ejecuciones anidadas en ella, la primera anclada en X y cada una en la anterior (la dirección, el dígito repetido n
 * veces). Un desajuste puntúa hacia arriba: una celda cubierta a menos profundidad que la de su peldaño llega a ese
 * peldaño (su dirección cae entre el anterior y él), y a más profundidad, al siguiente; sin nada cubierto, el primero
 * (el vacío también sube: 0.3, la idea). El rango es el mayor. Sin rango declarado: las posiciones en que X se puede
 * situar (el 9) son las que deja, del primer peldaño al suyo (`disponibles`).
 * → { peldano, nivel, grado, nombre, direccion, medida: { fila, columna, profundidad, direccion, cadena } | null,
 *     exacto, celdas: [{ peldano, fila, columna, profundidad, direccion, cadena, alcanza }], disponibles } o null.
 */
export function rango(eje, X, { tope = TOPE_DE_NODOS, celdas: memoDado, ...opciones } = {}) {
  const ev = eventoDe(eje, X);
  if (!ev || typeof ev.id !== 'string' || !eje?.obtener?.(ev.id)) return null;
  const pasos = escalera(opciones);
  if (!pasos.length) return null;
  const memo = memoDado instanceof Map ? memoDado : new Map();
  const celdaDe = (id) => {
    if (!memo.has(id)) memo.set(id, celdaDeEjecucion(eje, id, opciones));
    return memo.get(id);
  };
  let vistos = 0;
  // La cadena más larga de ejecuciones anidadas en la celda (fila, columna), desde lo anclado en `id`.
  const cadena = (id, fila, columna, n) => {
    if (n >= ARIDAD) return [];
    let mejor = [];
    for (const h of eje.sobre(id)) {
      if (++vistos > tope * ARIDAD) break;
      const c = celdaDe(h.id);
      if (c?.oficio !== fila || c?.ejecucion !== columna) continue;
      const larga = [h.id, ...cadena(h.id, fila, columna, n + 1)];
      if (larga.length > mejor.length) mejor = larga;
    }
    return mejor;
  };
  const ultimo = pasos.length - 1;
  const celdas = pasos.map((p) => {
    const ids = cadena(ev.id, p.fila, p.columna, 0);
    const n = ids.length;
    return {
      peldano: p.indice, fila: p.fila, columna: p.columna, profundidad: n,
      direccion: n ? String(p.digito).repeat(n).padEnd(ARIDAD, '0') : null, cadena: ids,
      alcanza: n === 0 ? null : n > p.profundidad ? Math.min(ultimo, p.indice + 1) : p.indice,
    };
  });
  const cubiertas = celdas.filter((c) => c.alcanza !== null);
  const mejor = cubiertas.reduce((a, c) => (!a || c.alcanza > a.alcanza || (c.alcanza === a.alcanza && c.profundidad > a.profundidad) ? c : a), null);
  const peldano = mejor ? mejor.alcanza : 0;
  const p = pasos[peldano];
  return {
    peldano, nivel: p.nivel, grado: p.grado, nombre: p.nombre, direccion: p.direccion,
    medida: mejor ? { fila: mejor.fila, columna: mejor.columna, profundidad: mejor.profundidad, direccion: mejor.direccion, cadena: mejor.cadena } : null,
    exacto: Boolean(mejor && mejor.peldano === peldano && mejor.profundidad === pasos[mejor.peldano].profundidad),
    celdas, disponibles: pasos.slice(0, peldano + 1).map((x) => x.indice),
  };
}

/**
 * La división de un mundo (un punto de vista lateral) a pantalla completa (epoch.8.7, VG 10-11 noche): no es una
 * matriz con herencia sino la cruceta aplicada al elemento pulsado. Al entrar en un elemento, sus hijos son los
 * dígitos que ese mundo enciende (cada uno, un PV aplicado al elemento de arriba). La fila de la época, una por PV,
 * es `[[pv], [hijos], [profundidad], [formas], [lo que mide], [estilo de los de abajo], [nota], [hilos], [enlace], [orden]]`;
 * las posiciones que no aplican llevan `0`, `[]` o `"-"`. `nivel` es el nivel de profundidad en que se mira (desde 1).
 * → { pv, hijos, profundidad, nivel, entra, forma, formas, mide, bandas?, paso?, hilos?, enlace?, orden?, estilo, nota } o null si la época
 * no dice nada de ese PV. `forma` es la del nivel pedido (la última se repite); `bandas` (y `paso`, el paso de
 * epoch.9.8 que coloca cada entrada) salen de lo que la fila mide: en las franjas (el 6 y el 7), una por escala de T
 * que el calendario mide; en el cielo (el 8) y el camino (el 9), las diez cajas de los hitos
 * ([{ indice, nivel, grado, nombre }]); `hilos` (el 6 y el 7), los PV de las filas horizontales, de arriba abajo;
 * `orden` (el 6 y el 7, VG 11-11), el nombre del orden de epoch.8.5 de sus listas verticales, de arriba abajo (lo más
 * cercano al presente arriba): lo pasan a ocupantes() y diario() quien pinta esas listas, no las franjas;
 * `estilo`, el CSS por defecto de la época para los hijos de un elemento de este mundo (texto, puede ser ""); `mide`, las
 * referencias de lo que la fila mide; `enlace` (encargo «datos», issue #11), lo que cada hijo es de lo que la fila mide,
 * uno por hijo y en su orden: en el 2, la mirada de su P (epoch.1.1); en el 3, la zona de atención (epoch.1.2.1); en el 1
 * (encargo «datos2», issue #11), la referencia de lo que mide cada hijo (epoch.9.2 el coste, capacity la capacidad,
 * epoch.4.0 lo que entra y sale), con null donde la fila pone «-» (ese hijo no mide nada). Encargo «datos3» (issue #11):
 * `pasos`, los nombres de los pasos de epoch.9.8 que la fila mide, en su orden (el 7: «cuando» y «escala»), y, si la fila
 * mide «cohort» (el 8), `cohortes`, las cohortes que la época admite ([{ valor, alcance, texto }], cohortes()).
 */
export function divisionDelMundo(_eje, pv, { nivel = 1, ...opciones } = {}) {
  const raiz = raizDe(epocaDe(opciones));
  const fila = hojas(en(raiz, [...SITIO.divisionDelMundo, 1])).filter(Array.isArray).find((r) => hoja(r[0]) === pv);
  if (!fila) return null;
  const numeros = (x) => hojas(x).filter((n) => typeof n === 'number');
  const textos = (x) => hojas(x).filter((s) => typeof s === 'string');
  const hijos = numeros(fila[1]);
  const profundidad = Number(hoja(fila[2])) || 0;
  const formas = textos(fila[3]);
  const mide = textos(fila[4]).filter((s) => s !== '-');
  const hilos = numeros(fila[7]);
  // El enlace, uno por hijo: un número (la mirada, la zona) o una referencia (el 1); «-» en un hijo que no mide nada.
  const enlaceCrudo = hojas(fila[8]).filter((x) => typeof x === 'number' || typeof x === 'string');
  const enlace = enlaceCrudo.every((x) => x === '-') ? [] : enlaceCrudo.map((x) => (x === '-' ? null : x));
  const orden = ordenPorNombre(texto(hoja(fila[9])), opciones)?.nombre ?? null;
  const actual = Math.min(Math.max(1, Math.floor(nivel)), Math.max(1, profundidad));
  const nombres = mide.filter((s) => !/^epoch\./.test(s) && s !== 'hitos' && s !== MIDE.rango);
  // Los pasos de epoch.9.8 que la fila nombra, en su orden (encargo «datos3»): la entrada va en la franja del primero que
  // da valor (el 7: por la fecha a la que se refiere y, si no, por su escala); el último es la escala que declara.
  const deLaTabla = new Set(hojas(en(raiz, [9, 8])).slice(1).filter(Array.isArray).map((r) => texto(hoja(r[1]))));
  const pasos = nombres.filter((n) => deLaTabla.has(n));
  let bandas;
  if (mide.includes('epoch.1.3') && mide.includes('epoch.7')) bandas = escalasDelCalendario(raiz);
  else if (mide.includes('hitos')) bandas = cajasDeHitos(opciones);
  return {
    pv, hijos, profundidad, nivel: actual, entra: actual < profundidad,
    forma: formas.length ? formas[Math.min(actual - 1, formas.length - 1)] : null, formas, mide,
    ...(bandas ? { bandas, paso: nombres[0] ?? null, pasos } : {}),
    ...(mide.includes(MIDE.cohorte) ? { cohortes: cohortes(opciones) } : {}),
    ...(mide.includes(MIDE.ejecucion) ? { ejes: ejesDeLaMatriz(opciones) } : {}),
    ...(mide.includes(MIDE.rango) ? { escalera: escalera(opciones) } : {}),
    ...(hilos.length ? { hilos } : {}),
    ...(enlace.length ? { enlace } : {}),
    ...(orden ? { orden } : {}),
    estilo: cssSeguro(textos(fila[5]).join('; ')),
    nota: texto(ultima(fila[6])) ?? '',
  };
}

/**
 * Los hijos del elemento X en el mundo `pv` (epoch.8.7): los dígitos que ese mundo enciende, cada uno con su nombre a
 * la profundidad del nivel (epoch.5: en profundidad 1, 0 qué es, 1 cuánto, 2 con qué condición…) y los ocupantes de
 * X.<dígito>: [{ digito, nombre, ocupantes, total, vacio }]. `vacio` es que no tiene ocupantes: la carta pinta su
 * nombre apagado y no entra; si todos están vacíos, no baja. Sin fila en la época para ese PV, ninguno. `cuantos` (por
 * defecto el paso de la época) limita los ocupantes que se devuelven de cada hijo; `total` es cuántos hay.
 *
 * Lo que la fila mide, por hijo (encargo «datos», issue #11; solo si X es un registro del eje y la fila trae su enlace):
 * - `epoch.1.1` (el P por mirada, el 2): `mirada` (la del enlace) y el P posicionado sobre X.<mirada>, de todos sus
 *   titulares: `comprometidos` (bloqueado, con la salida que sea) y `reposicionables` (disponible: su titular lo
 *   puede mover);
 * - `epoch.9.0.0` (el recuento, el 2): si el criterio del dueño de X dice esa mirada («view d», motor.miradasDe), su
 *   recuento (motor.recuento): `umbral` (el «above x» del dueño o el de la época), `valor`, `pasa` y `faltan` (lo que
 *   le falta al valor para llegar al umbral, en las unidades del recuento; 0 si pasa);
 * - `epoch.1.2.1` (los grupos de atención, el 3): `precio`, el de la zona del enlace para el dueño de X (su A.3: el de la
 *   época o el que ancló en el 3.k.2 de su alta), { zona, grupo, enQue, cuanto, texto }, con `texto` legible en el
 *   idioma («legible attention price <en qué>» de epoch.9.4);
 * - `attended` (el 3): `estados`, uno por ocupante (lente.estadoDePaquete): «pendiente» o «atendido» si es una
 *   petición de atención (una devolución de R a su emisor), «perdonado» si quema la R de otro, null si no es un paquete.
 *
 * En el 1 (encargo «datos2», issue #11; Core, pendiente de revisar VG), el hijo cuyo enlace es:
 * - `epoch.9.2` (las plantillas de dominio): `coste`, lo que X declara en <dígito>.2 (la condición del hijo: en el 1,
 *   «a qué precio», el 1.2 de «purchase» y de «booking») si X tiene plantilla y ahí hay una magnitud «EUR 12»:
 *   { posicion, cuanto, unidad, texto };
 * - `capacity`: `capacidad`, `comprometido`, `disponible` (= capacidad − comprometido), `franja` y `declara` (el registro
 *   que la declara): la del último «declare capacity or threshold» del dueño de X anclado en X (su parámetro «capacity»)
 *   o, si no hay, la del registro más cercano del hilo de X que la declara en su 2 (tokens.capacidadDe, el tope de E del
 *   eje). Lo comprometido es el E vivo de las series atadas a ese registro o a lo que cuelga de él que ya no está libre
 *   en manos de su emisor (entregado o bloqueado), por franja (la noche de una plaza); se da la franja más apretada;
 * - `epoch.4.0` (las primitivas): `entradas` y `salidas`, lo que el libro movió de E y de T en X y en lo que cuelga de
 *   él (contrato.diario) hacia su dueño (acuñar, transferir) y desde él (transferir, quemar), por serie: [{ serie,
 *   cantidad, con }], `con` las otras partes (null es nadie: acuñar o quemar). La asignación del día y el T informativo
 *   no cuentan.
 *
 * El cielo del 8 (encargo «datos3», issue #11; Core, pendiente de revisar VG): un mundo sin hijos cuya fila mide «cohort»
 * da sus bandas como hijos, una por caja nivel.grado de los hitos (`digito` es el índice de la caja, 0-9), con los
 * comparables de la cohorte de X que caen en ella (cohorteDe, por `cohorte` o la que eligió el dueño): `ocupantes`
 * (sus referencias, hasta el paso), `total`, `vacio`, `nivel`, `grado`, `comparables` ([{ ref, caja, cuota, serie,
 * foco }]), `foco` (si X está en ella), `cohorte` (el valor) y `base` (quién escribió la base de la cohorte, o
 * { escrita: false }).
 */
export function hijosDe(eje, X, pv, { nivel = 1, cuantos, base = [], direccion, raiz: nodoRaiz, cohorte, ...opciones } = {}) {
  const d = divisionDelMundo(eje, pv, { nivel, ...opciones });
  if (!d) return [];
  if (!d.hijos.length && d.bandas && d.cohortes) return cajasDelCielo(eje, X, d, { cohorte, cuantos, ...opciones });
  if (!d.hijos.length && d.bandas && d.escalera?.length) return posicionesParaSituarse(eje, X, d, opciones);
  const raiz = raizDe(epocaDe(opciones));
  const profundidad = Math.min(Math.max(1, d.nivel), ARIDAD - 1);
  // Bajado dentro de X por dígitos (encargo «lecturas»): los hijos son X.<base>.<dígito>; lo que mide la fila es de X.<dígito>.
  const sub = caminoDe(base);
  const medir = sub.length ? null : medidasDeHijos(eje, X, d, opciones);
  const derivar = Array.isArray(direccion) && direccion.length < ARIDAD;
  return d.hijos.map((digito, i) => {
    const camino = [...Array(profundidad).fill(0), digito];
    const o = ocupantes(eje, X, [...sub, digito], 0, cuantos, opciones);
    let hijo = { digito, nombre: texto(hoja(corta(raiz, camino)?.[0])) ?? null, ocupantes: o.ocupantes, total: o.total, vacio: o.total === 0 };
    if (derivar) {
      // Lo que deriva del libro con la dirección entera (el mundo y los dígitos por los que se ha bajado, desde la raíz),
      // sin repetir lo anclado de la celda.
      const anclados = new Set(ocupantes(eje, X, [...sub, digito], 0, Infinity, opciones).ocupantes.map(claveDeValor));
      const derivados = leerRuta(eje, nodoRaiz ?? X, [...direccion, digito], opciones).derivado.filter((x) => !anclados.has(claveDeValor(x.valor)));
      hijo = { ...hijo, derivados: derivados.slice(0, cuantos ?? paso(opciones)), totalDerivados: derivados.length, vacio: o.total === 0 && derivados.length === 0 };
    }
    return medir ? { ...hijo, ...medir(i, o.ocupantes, digito) } : hijo;
  });
}

/**
 * Las posiciones del 9 para situarse como hijos (hijosDe; encargo «el4», VG 12-11, #39): una por caja nivel.grado de los
 * hitos (`digito`, el índice), sin ocupantes, con `disponible` (las que deja el rango del 8 de X, rango(): del primer
 * peldaño al suyo) y `actual` (la suya). Sin rango declarado: situarse es elegir entre las disponibles.
 */
function posicionesParaSituarse(eje, X, d, opciones) {
  const r = rango(eje, X, opciones);
  return d.bandas.map((b) => ({
    digito: b.indice, nombre: b.nombre, nivel: b.nivel, grado: b.grado, direccion: b.direccion ?? null, ocupantes: [], total: 0, vacio: true,
    disponible: Boolean(r?.disponibles.includes(b.indice)), actual: r?.peldano === b.indice,
  }));
}

// ---------- 4.4 las diez lecturas: lo que el PV d lee de un nodo (encargo «lecturas», issue #12) ----------

/**
 * Las lecturas de los puntos de vista (VG, 11-11 noche): una regla larga por PV en epoch.2, «point of view» en su 4,
 * «qué lee el PV d aplicado a un nodo N», con el PV en su 3: [{ pv, nombre, formulas, js, regla }], en el orden de su 8.
 * `formulas` son las del BQL mínimo de su 2 (it = el nodo, me = de quién es lo suyo); `js`, las lecturas del núcleo en
 * JavaScript que la regla nombra («js <nombre>», LECTURAS_JS) donde el BQL mínimo no alcanza.
 */
export function lecturasDePv(opciones = {}) {
  return (epocaDe(opciones).lecturasDePv ?? []).map((regla) => {
    const fuentes = hojas(regla[2]).filter((x) => typeof x === 'string');
    return { pv: Number(hoja(regla[3])), nombre: nombreDeRegla(regla), formulas: fuentes.filter((x) => x.startsWith('=')), js: fuentes.filter((x) => x.startsWith('js ')).map((x) => x.slice(3)), regla };
  });
}

/** Cuántos nodos sigue como mucho una lectura encadenada en cada dígito (lo demás no se lee: un tope, no un orden). */
const TOPE_DE_NODOS = 200;
/** Lo que no cuenta como cantidad de un nodo: la asignación del día, el T informativo y el P que dan las reglas al escribir o al recibir R. */
const SIN_CANTIDAD = new Set(['asignacion', 'informativo', 'obtencion']);

/** La clave de un valor para no repetirlo: un registro por su id (con o sin dirección), lo demás por su forma. */
const claveDeValor = (v) => (esReferencia(v) ? 'ref ' + v.ref : JSON.stringify(v));

/** Un nodo que se puede leer: el id de un registro del eje o una identidad con alta; lo demás (una hoja, una décupla), null. */
function nodoDe(eje, x) {
  if (esReferencia(x)) return eje?.obtener(x.ref) ? x.ref : null;
  if (x && typeof x === 'object' && typeof x.id === 'string' && 'payload' in x) return eje?.obtener(x.id) ? x.id : null;
  if (typeof x !== 'string') return null;
  if (eje?.obtener(x)) return x;
  return eje?.alta?.(x) ? x : null;
}

/** De quién es lo suyo en una lectura: el autor de un registro, la identidad misma. */
const duenoDe = (eje, nodo) => eje?.obtener(nodo)?.autor ?? nodo;

/** Un valor que da una lectura, como ocupante: un registro del eje es su referencia; lo demás, tal cual. */
const ocupanteDe = (eje, v) => (typeof v === 'string' && eje?.obtener(v) ? { ref: v } : v);

/**
 * Las lecturas del núcleo en JavaScript que nombran las reglas («js <nombre>»): (eje, nodo, { me, epoca, opciones }) →
 * [{ valor, ...lo que lo justifica }]. Solo leen registros (una identidad no tiene subárbol ni representación).
 */
const LECTURAS_JS = Object.freeze({
  // 0: las representaciones (formatos y tamaños de la época, que el BQL mínimo no normaliza)
  representaciones: (eje, nodo, { opciones }) => (eje?.obtener(nodo) ? representaciones(eje, nodo, opciones).map((r) => ({ valor: r.texto ?? r.recurso, formato: r.formato })).filter((x) => x.valor !== null && x.valor !== undefined) : []),
  // 1: lo que se mueve en el subárbol con alguien que no es el dueño (el BQL mínimo no recorre un subárbol entero)
  flujo: (eje, nodo, { me, opciones }) => (eje?.obtener(nodo) ? diario(eje, nodo, 0, Infinity, opciones).entradas : []).map((e) => {
    const movimientos = e.movimientos.filter((m) => !SIN_CANTIDAD.has(m.clase) && ((m.de && m.de !== me) || (m.a && m.a !== me)))
      .map(({ serie, cantidad, de, a }) => ({ serie, cantidad, de, a }));
    return movimientos.length ? { valor: { ref: e.id }, movimientos } : null;
  }).filter(Boolean),
  // 7: el futuro del subárbol por su fecha (encargo «datos3»): lo que tiene un estado del futuro (estadoDeEntrada: el T
  // futuro declarado con la fecha a la que se refiere, lo bloqueado hasta una fecha, lo que caduca), de lo más próximo a
  // lo más lejano por esa fecha (a igual fecha, por llegada); el T futuro lleva además `refiere` y su cantidad
  futuro: (eje, nodo, { opciones }) => {
    if (!eje?.obtener(nodo)) return [];
    const fuera = diario(eje, nodo, 0, Infinity, opciones).entradas.filter((e) => e.estado?.fecha).map((e) => ({
      valor: { ref: e.id }, estado: e.estado.tipo, fecha: e.estado.fecha,
      ...(e.estado.tipo === ESTADO.previsto ? { refiere: e.estado.fecha, cantidad: e.estado.cantidad } : {}),
    }));
    return porInstante(fuera, (x) => x.fecha);
  },
  // 8: los comparables de la cohorte que el dueño eligió («change cohort» en el 8 del nodo, encargo «datos3») con su caja;
  // los hermanos ya los da el BQL de la regla, así que con la cohorte de los hermanos (o sin elegir) no añade nada
  cohorte: (eje, nodo, { opciones }) => {
    if (!eje?.obtener(nodo)) return [];
    const elegida = cohorteEscrita(eje, eje.obtener(nodo), opciones);
    const c = elegida ? cohorteDe(eje, nodo, { ...opciones, cohorte: elegida.valor }) : null;
    if (!c || c.alcance === ALCANCE_DE_COHORTE.siblings) return [];
    return c.comparables.filter((x) => x.ref !== nodo).map((x) => ({ valor: { ref: x.ref }, cohorte: c.cohorte, caja: x.caja, rango: x.rango }));
  },
  // 9: el tutorial del camino (acciones.camino, su primera fuente): las acciones que nombra el 9 de su plantilla o el suyo
  camino: (eje, nodo, { me, epoca, opciones }) => {
    const ev = eje?.obtener(nodo);
    if (!ev) return [];
    const acciones = new Set(accionesDe(epoca).map((a) => a.nombre));
    const del9 = (x) => (Array.isArray(x) ? hojas(x[9]) : []).filter((n) => typeof n === 'string' && acciones.has(n));
    // El alta de quien la lee: el tutorial de la plantilla de identidad (epoch.3.0, su 9), como en acciones.camino.
    const esAlta = eje.alta?.(ev.autor)?.id === ev.id && ev.autor === me;
    return [...new Set([...del9(plantilla(eje, ev, opciones)), ...(esAlta ? del9(en(raizDe(epoca), [3, 0])) : []), ...del9(ev.payload)])].map((n) => ({ valor: n }));
  },
});

/** Lo que da la lectura de un PV aplicada a un nodo: lo de cada fórmula de su 2 y cada lectura JS que nombra, sin repetir. */
function aplicarLectura(eje, lectura, nodo, ctx, me, opciones) {
  if (!lectura) return [];
  const fuera = [];
  for (const f of lectura.formulas) {
    const v = vale(f, ctx, { sujeto: nodo });
    if (v) for (const o of v) { const x = plano(o, ctx); if (x !== undefined && x !== null && typeof x !== 'boolean') fuera.push({ valor: ocupanteDe(eje, x) }); }
  }
  for (const nombre of lectura.js) {
    const leerJs = LECTURAS_JS[nombre];
    if (leerJs) fuera.push(...leerJs(eje, nodo, { me, epoca: epocaDe(opciones), opciones }).map(({ valor, ...extra }) => ({ valor: ocupanteDe(eje, valor), extra })));
  }
  const vistos = new Set();
  return fuera.filter((x) => { const k = claveDeValor(x.valor); if (vistos.has(k)) return false; vistos.add(k); return true; });
}

/**
 * Lo que el PV d lee de N (encargo «lecturas», issue #12, VG 11-11 noche): lo anclado en N.d (los ocupantes, como
 * `ocupantes`) más lo que deriva del libro, la lectura de su PV (epoch.2, «point of view») aplicada a N. N es un registro
 * del eje (su id o el evento) o una identidad con alta; `yo` dice de quién es «lo suyo» (por defecto, el dueño de N).
 * → { pv, anclado, derivado: [{ valor, por }], lista: [{ valor, origen: 'anclado' | 'derivado', por? }] }; lo derivado no
 * repite lo anclado y `por` es la cadena de lecturas que lo justifica: [{ pv, regla, nombre, desde, …movimientos o fecha }].
 */
export function leer(eje, N, d, opciones = {}) {
  const r = leerRuta(eje, N, [Number(d)], opciones);
  return { pv: Number(d), anclado: r.anclado, derivado: r.derivado, lista: r.lista };
}

/**
 * La lectura encadenada de una dirección (VG: «el contenido de N.a.b.c es la regla de c aplicada al resultado de la de b
 * aplicada al de la de a aplicada a N»): cada dígito aplica la lectura de su PV a cada nodo que dio el anterior (un
 * registro o una identidad; una hoja no sigue). Lo anclado es lo de N en la dirección entera (ocupantes de N.a.b.c);
 * lo derivado, lo que da el último dígito, sin repetir lo anclado y, con más de un dígito, sin volver a N ni a su hilo
 * hacia arriba (donde ya se está). → { ruta, anclado, derivado, lista } (como `leer`).
 */
export function leerRuta(eje, N, ruta, { yo, t: _t, tope = TOPE_DE_NODOS, ...opciones } = {}) {
  const digitos = caminoDe(ruta);
  const raizNodo = nodoDe(eje, N);
  const anclado = raizNodo && eje.obtener(raizNodo) && digitos.length ? ocupantes(eje, raizNodo, digitos, 0, Infinity, opciones).ocupantes : [];
  const fuera = (derivado) => ({ ruta: digitos, anclado, derivado, lista: [...anclado.map((valor) => ({ valor, origen: 'anclado' })), ...derivado.map(({ valor, por }) => ({ valor, origen: 'derivado', por }))] });
  if (!raizNodo || !digitos.length || digitos.length > ARIDAD) return fuera([]);
  const epoca = epocaDe(opciones);
  const me = yo ?? duenoDe(eje, raizNodo);
  const ctx = new ContextoEje(eje, { epoch: epoca, me });
  const porPv = new Map(lecturasDePv(opciones).map((l) => [l.pv, l]));
  const nombreDe = (d) => texto(hoja(corta(raizDe(epoca), [0, d])?.[0])) ?? null;
  let frente = [{ nodo: raizNodo, por: [] }];
  let items = [];
  digitos.forEach((d, i) => {
    const lectura = porPv.get(d);
    const porClave = new Map();
    for (const f of frente) {
      for (const x of aplicarLectura(eje, lectura, f.nodo, ctx, me, opciones)) {
        const k = claveDeValor(x.valor);
        const previo = porClave.get(k);
        if (previo) { const paso = previo.por[previo.por.length - 1]; if (!paso.desde.includes(f.nodo)) paso.desde.push(f.nodo); continue; }
        porClave.set(k, { valor: x.valor, por: [...f.por, { pv: d, regla: lectura.nombre, nombre: nombreDe(d), desde: [f.nodo], ...(x.extra ?? {}) }] });
      }
    }
    items = [...porClave.values()];
    if (i < digitos.length - 1) frente = items.map((x) => ({ nodo: nodoDe(eje, x.valor), por: x.por })).filter((x) => x.nodo).slice(0, tope);
  });
  // Lo encadenado no vuelve a N ni a su hilo hacia arriba (donde ya se está; un solo dígito sí: el 5 de N es su ancla);
  // nada repite lo anclado.
  const hilo = digitos.length > 1 && eje.obtener(raizNodo) ? eje.hilo(raizNodo).map((e) => claveDeValor({ ref: e.id })) : [];
  const fuera_ = new Set([...anclado.map(claveDeValor), ...hilo]);
  return fuera(items.filter((x) => !fuera_.has(claveDeValor(x.valor))));
}

/** Las referencias de lo que mide una fila de epoch.8.7 que dan algo por hijo (encargo «datos», issue #11). */
const MIDE = Object.freeze({ poder: 'epoch.1.1', recuento: 'epoch.9.0.0', atencion: 'epoch.1.2.1', atendido: 'attended', coste: 'epoch.9.2', capacidad: 'capacity', flujo: 'epoch.4.0', cohorte: 'cohort', ejecucion: 'execution', rango: 'rank' });

/** La plantilla de transacción que declara capacidad (epoch.9.6) y su parámetro (encargo «datos2»): se leen de la época. */
const DECLARAR_CAPACIDAD = Object.freeze({ plantilla: 'declare capacity or threshold', parametro: 'capacity' });

/** Las clases de asiento que no son de un registro sino del día (la asignación de T) o informativas (T pasado, futuro o inventado). */
const SIN_FLUJO = new Set(['asignacion', 'informativo']);

/**
 * El coste que X declara en <dígito>.2 (encargo «datos2», issue #11): si X tiene plantilla y ahí hay una magnitud
 * («EUR 12», o una referencia que llega a una), { posicion, cuanto, unidad, texto }; si no, null.
 */
function costeDeRegistro(eje, ev, digito, opciones) {
  if (typeof digito !== 'number' || !plantilla(eje, ev, opciones)) return null;
  const ctx = contextoDe(eje, epocaDe(opciones));
  const sitio = '(first ("' + ev.id + '").' + digito + '.2)';
  const cuanto = uno(sitio + '.1', ctx);
  if (typeof cuanto !== 'number') return null;
  const unidad = uno(sitio + '.2', ctx);
  const dicho = uno(sitio, ctx);
  return { posicion: digito + '.2', cuanto, unidad: typeof unidad === 'string' ? unidad : null, texto: typeof dicho === 'string' ? dicho : [unidad, cuanto].filter((x) => x !== undefined && x !== null).join(' ') };
}

/**
 * Lo que el libro movió de E y de T en X y en lo que cuelga de él (contrato.diario), visto desde su dueño (encargo
 * «datos2», issue #11): { entradas, salidas }, cada una [{ serie, cantidad, con }] por orden de aparición; entra lo que
 * se acuña o transfiere al dueño, sale lo que transfiere o quema; `con`, las otras partes (null: nadie).
 */
function flujoDeRegistro(eje, ev, opciones) {
  const dueno = ev.autor;
  const entradas = new Map();
  const salidas = new Map();
  const suma = (mapa, serie, cantidad, otro) => {
    const s = mapa.get(serie) ?? { serie, cantidad: 0, con: [] };
    s.cantidad = redondo(s.cantidad + cantidad);
    if (!s.con.includes(otro)) s.con.push(otro);
    mapa.set(serie, s);
  };
  for (const e of diario(eje, ev.id, 0, Infinity, opciones).entradas) {
    for (const m of e.movimientos) {
      if (!/^[ET]:/.test(m.serie) || SIN_FLUJO.has(m.clase) || m.de === m.a) continue;
      if (m.a === dueno && (m.primitiva === 'acunar' || m.primitiva === 'transferir')) suma(entradas, m.serie, m.cantidad, m.de ?? null);
      else if (m.de === dueno && (m.primitiva === 'transferir' || m.primitiva === 'quemar')) suma(salidas, m.serie, m.cantidad, m.a ?? null);
    }
  }
  return { entradas: [...entradas.values()], salidas: [...salidas.values()] };
}

/** El registro que declara la capacidad de X: el último «declare capacity or threshold» de su dueño anclado en X, o el más cercano de su hilo que la declara en su 2. */
function declaraCapacidad(eje, ev, opciones) {
  const p = (Array.isArray(epocaDe(opciones).transacciones) ? epocaDe(opciones).transacciones : []).map((x) => x.plantilla).find((x) => texto(hoja(x?.[0])) === DECLARAR_CAPACIDAD.plantilla);
  const param = p ? hojas(p[1]).filter(Array.isArray).find((x) => texto(hoja(x[0])) === DECLARAR_CAPACIDAD.parametro) : null;
  const ancla = p ? texto(hoja(p[5])) : undefined;
  const donde = param ? texto(hoja(param[5])) : undefined;
  if (ancla && donde && !ancla.startsWith('=')) {
    const escritos = eje.sobre(ev.id, direccion(caminoDe(ancla))).filter((h) => h.autor === ev.autor && hojas(h.payload?.[4]).includes(DECLARAR_CAPACIDAD.plantilla));
    const ultimo = escritos[escritos.length - 1];
    const c = ultimo ? hoja(en(ultimo.payload, caminoDe(donde))) : undefined;
    if (typeof c === 'number' && c > 0) return { id: ultimo.id, capacidad: c };
  }
  for (const e of eje.hilo(ev.id)) {
    const c = capacidadDe(e.payload);
    if (c !== undefined) return { id: e.id, capacidad: c };
  }
  return null;
}

/**
 * La capacidad de X y lo que queda (encargo «datos2», issue #11): { capacidad, comprometido, disponible, franja,
 * declara } o null si nadie la declara. Lo comprometido, por franja, es el E vivo de las series atadas al registro que
 * la declara (o a lo que cuelga de él) que ya no está libre en manos de su emisor; se da la franja con menos disponible.
 */
function capacidadDeRegistro(eje, ev, opciones) {
  const declarada = declaraCapacidad(eje, ev, opciones);
  if (!declarada) return null;
  const porFranja = new Map();
  for (const s of typeof eje.series === 'function' ? eje.series() : []) {
    if (s.token !== 'E' || !s.registro || !eje.hilo(s.registro).some((e) => e.id === declarada.id)) continue;
    const franja = franjaDe(s.denominacion);
    const fuera = Math.max(0, eje.vivo(s.clave) - eje.saldo(s.emisor, s.clave));
    porFranja.set(franja, redondo((porFranja.get(franja) ?? 0) + fuera));
  }
  const [franja, comprometido] = [...porFranja.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0] ?? ['', 0];
  return { capacidad: declarada.capacidad, comprometido, disponible: redondo(declarada.capacidad - comprometido), franja, declara: declarada.id };
}

/** El prefijo de las claves de texto del precio de una zona de atención: «legible attention price <en qué>». */
const PRECIO_DE_ATENCION = 'attention price ';

/** Un número sin el ruido de la coma flotante (como motor.recuento). */
const redondo = (x) => Math.round(x * 1e9) / 1e9;

/**
 * El P posicionado sobre las miradas de un registro, de todos sus titulares (P por mirada, VG tras 3b-bis: el ámbito
 * «r.d»): Map(mirada → { comprometidos, reposicionables }), con lo bloqueado (con cualquier salida) y lo disponible.
 */
function poderPorMirada(eje, id) {
  const suma = new Map();
  if (typeof eje?.libro?.vista !== 'function') return suma;
  for (const titular of eje.identidades()) {
    for (const [clave, v] of Object.entries(eje.libro.vista(titular))) {
      if (!clave.startsWith('P:')) continue;
      const p = partirClave(clave);
      if (p.raiz !== id || p.mirada === undefined) continue;
      const s = suma.get(p.mirada) ?? { comprometidos: 0, reposicionables: 0 };
      s.reposicionables = redondo(s.reposicionables + v.disponible);
      s.comprometidos = redondo(s.comprometidos + Object.values(v.bloqueado).reduce((x, y) => x + y, 0));
      suma.set(p.mirada, s);
    }
  }
  return suma;
}

/** El precio de un grupo de atención de quien es dueño (lo que da yo().atencion), legible en el idioma de las opciones. */
function precioDeGrupo(eje, g, dueno, opciones) {
  const epoca = epocaDe(opciones);
  const idioma = opciones.idioma ?? 'en';
  const { enQue, cuanto } = g.precio;
  const formato = typeof enQue === 'string' ? texto_(eje, CLAVE.legible(PRECIO_DE_ATENCION + enQue), idioma, { epoca }) : null;
  const partes = { amount: cuanto, owner: legible(eje, dueno, TIPO.identidad, { idioma, epoca }).texto };
  const plano = [cuanto, enQue].filter((x) => x !== undefined && x !== null).join(' ');
  return { zona: g.zona, grupo: g.nombre, enQue: enQue ?? null, cuanto: cuanto ?? null, texto: formato === null ? plano : plano_(formato, partes) };
}

/**
 * Lo que la fila d de epoch.8.7 mide de cada hijo de X (hijosDe): una función (i, ocupantes) → los campos de más del
 * hijo i, o null si X no es un registro del eje o la fila no mide nada que dé algo por hijo.
 */
function medidasDeHijos(eje, X, d, opciones) {
  const ev = eventoDe(eje, X);
  if (!ev || typeof ev.id !== 'string' || !eje?.obtener(ev.id)) return null;
  const mide = new Set(d.mide);
  const conEnlace = Array.isArray(d.enlace);
  const poder = conEnlace && mide.has(MIDE.poder) ? poderPorMirada(eje, ev.id) : null;
  const miradas = conEnlace && mide.has(MIDE.recuento) ? miradasDe(eje, ev.id) : [];
  const grupos = conEnlace && mide.has(MIDE.atencion) ? atencionDe(ev.autor, contextoDe(eje, epocaDe(opciones))) : null;
  const paquetes = mide.has(MIDE.atendido);
  // El 1 (encargo «datos2», issue #11): coste, capacidad y lo que entra y sale, en el hijo que dice el enlace.
  const delUno = (ref) => conEnlace && mide.has(ref) && d.enlace.includes(ref);
  const conCoste = delUno(MIDE.coste);
  const capacidad = delUno(MIDE.capacidad) ? capacidadDeRegistro(eje, ev, opciones) : null;
  const flujo = delUno(MIDE.flujo) ? flujoDeRegistro(eje, ev, opciones) : null;
  if (!poder && !miradas.length && !grupos && !paquetes && !conCoste && !capacidad && !flujo) return null;
  let cuenta;
  return (i, lista, digito) => {
    const m = conEnlace ? d.enlace[i] : undefined;
    const extra = {};
    if (conCoste && m === MIDE.coste) {
      const c = costeDeRegistro(eje, ev, digito, opciones);
      if (c) extra.coste = c;
    }
    if (capacidad && m === MIDE.capacidad) Object.assign(extra, capacidad);
    if (flujo && m === MIDE.flujo) Object.assign(extra, flujo);
    if (poder && typeof m === 'number') {
      const p = poder.get(m) ?? { comprometidos: 0, reposicionables: 0 };
      Object.assign(extra, { mirada: m, comprometidos: p.comprometidos, reposicionables: p.reposicionables });
    }
    if (miradas.includes(m)) {
      cuenta ??= recuento(eje, ev.id);
      if (cuenta.estado === 'RESUELTO') Object.assign(extra, { umbral: cuenta.umbral, valor: cuenta.valor, pasa: cuenta.pasa, faltan: cuenta.pasa ? 0 : redondo(Math.max(0, cuenta.umbral - cuenta.valor)) });
    }
    const g = grupos && typeof m === 'number' ? grupos.find((x) => x.zona === m) : null;
    if (g) extra.precio = precioDeGrupo(eje, g, ev.autor, opciones);
    if (paquetes) extra.estados = lista.map((o) => (esReferencia(o) ? estadoDePaquete(eje, o.ref) : null));
    return extra;
  };
}

// ---------- 4b. los dos estilos como datos (VG, 10-11 noche) ----------

/** Lo máximo que mide un estilo (caracteres): más largo, no es un estilo sino una carga. */
const MAXIMO_CSS = 2000;

/**
 * Las propiedades de CSS corriente que un dato puede pedir (más las variables `--x`): colores, fondos, bordes, tipografía,
 * espaciado, grid y flex, tamaños. Nada que saque un elemento de su sitio (position, z-index, transform), tape la
 * pantalla, cargue un recurso (content, cursor, list-style-image, @font-face…) o dispare algo (animation, transition).
 */
const PROPIEDADES_CSS = new Set([
  'color', 'opacity', 'background', 'background-color', 'background-image', 'background-position', 'background-size', 'background-repeat', 'background-clip',
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-color', 'border-width', 'border-style', 'border-radius',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius',
  'outline', 'outline-color', 'outline-width', 'outline-style', 'outline-offset', 'box-shadow', 'text-shadow',
  'font', 'font-family', 'font-size', 'font-style', 'font-weight', 'font-variant', 'line-height', 'letter-spacing', 'word-spacing',
  'text-align', 'text-transform', 'text-decoration', 'text-decoration-color', 'text-decoration-line', 'text-decoration-style', 'text-indent', 'text-overflow', 'white-space', 'vertical-align',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'gap', 'row-gap', 'column-gap', 'grid-gap',
  'display', 'grid', 'grid-template', 'grid-template-columns', 'grid-template-rows', 'grid-template-areas', 'grid-auto-columns', 'grid-auto-rows', 'grid-auto-flow',
  'grid-column', 'grid-row', 'grid-area', 'grid-column-start', 'grid-column-end', 'grid-row-start', 'grid-row-end',
  'flex', 'flex-direction', 'flex-wrap', 'flex-flow', 'flex-grow', 'flex-shrink', 'flex-basis',
  'justify-content', 'justify-items', 'justify-self', 'align-content', 'align-items', 'align-self', 'place-content', 'place-items', 'place-self',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'aspect-ratio',
]);

/** Funciones de CSS que cargan un recurso de fuera o ejecutan algo; ninguna llega al estilo. */
const FUNCIONES_PROHIBIDAS = /(url|image-set|image|src|element|cross-fade|paint|expression)\s*\(/i;

/**
 * Un texto de estilo (el 0.9 de un registro, el 5.0, o el de la época) saneado, o "" si no es seguro. El libro es
 * compartido y un dato nunca ejecuta JavaScript ni carga un recurso de fuera, así que de un texto solo se aceptan
 * declaraciones `propiedad: valor;` de CSS corriente (la lista blanca de PROPIEDADES_CSS) y variables `--x: …`:
 * ni llaves (ni selectores ni reglas), ni `<` `>` (nada de etiquetas), ni `@` (ni `@import`), ni barras invertidas ni
 * comentarios (las formas de esconder lo anterior), ni `url(`, `expression(`, `javascript:`, `behavior`,
 * `-moz-binding`; máximo 2000 caracteres. Lo que de este modo es sospechoso invalida todo el texto (""); una
 * declaración que no es de la lista blanca o no se entiende se descarta sola y se conservan las demás. El resultado
 * es `propiedad: valor;` separadas por un espacio.
 */
export function cssSeguro(css) {
  if (typeof css !== 'string' || css.length > MAXIMO_CSS) return '';
  // Sin caracteres de control (salvo el salto y la tabulación) ni invisibles que cambian lo que se lee (cero ancho, separadores de línea).
  if (/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(css.replace(/[\n\r\t]/g, ''))) return '';
  const plano = css.toLowerCase().replace(/\s+/g, '');
  if (/[{}<>@\\]/.test(css) || css.includes('/*') || css.includes('*/')) return '';
  if (/javascript:|vbscript:|data:|behavior|-moz-binding|expression\(|url\(|@import/.test(plano) || FUNCIONES_PROHIBIDAS.test(css)) return '';
  const fuera = [];
  for (const crudo of css.split(';')) {
    const decl = crudo.trim();
    if (!decl) continue;
    const dos = decl.indexOf(':');
    if (dos < 1) continue;
    const propiedad = decl.slice(0, dos).trim().toLowerCase();
    const valor = decl.slice(dos + 1).trim();
    if (!valor || !(/^--[a-z0-9_-]+$/.test(propiedad) || PROPIEDADES_CSS.has(propiedad))) continue;
    if (!/^[\w\s#%.,()+*/"'-]+$/.test(valor) || !equilibrado(valor)) continue;
    fuera.push(propiedad + ': ' + valor.replace(/\s+/g, ' ') + ';');
  }
  return fuera.join(' ');
}

/** ¿Tiene un valor sus paréntesis y comillas cerrados? (una declaración no puede abrir nada que se cuele en la siguiente). */
function equilibrado(valor) {
  let abiertos = 0;
  let comilla = null;
  for (const c of valor) {
    if (comilla) { if (c === comilla) comilla = null; continue; }
    if (c === '"' || c === "'") comilla = c;
    else if (c === '(') abiertos++;
    else if (c === ')' && --abiertos < 0) return false;
  }
  return abiertos === 0 && comilla === null;
}

/** El último texto de la lista de ocupantes (o de hojas) que, saneado, es un estilo. */
function ultimoEstilo(lista) {
  let css = '';
  for (const o of lista) {
    const limpio = typeof o === 'string' ? cssSeguro(o) : '';
    if (limpio) css = limpio;
  }
  return css;
}

/**
 * El estilo escrito en la posición `camino` de un registro del eje: el de su último ocupante que sea un estilo. Un
 * ocupante puede ser el texto mismo (en el payload del registro) o un escrito en esa posición (una referencia a un
 * registro cuyo payload es el texto); se lee su payload, nunca se sigue más allá.
 */
function estiloEscrito(eje, X, camino, opciones) {
  if (!eventoDe(eje, X)) return '';
  const textos = ocupantes(eje, X, camino, 0, 1000, opciones).ocupantes.flatMap((o) => (esReferencia(o) && !o.dir ? hojas(eje.obtener(o.ref)?.payload) : [o]));
  return ultimoEstilo(textos);
}

/**
 * El estilo de un elemento como dato, con la cascada de lo más cercano a lo más lejano (VG, 10-11 noche). Dos estilos:
 * `de: 'propio'`: cómo se pinta X; su 0.9 (representación · cómo), si no la plantilla de X (su 0.9), si no nada (la
 * época no dice cómo se pinta un registro propio: la fila de epoch.8.7 es de los hijos); `de: 'hijos'`: cómo se
 * pintan los de abajo; su 5.0 (estructura · qué es), si no el 5.0 de su padre (el registro sobre el que se escribió),
 * si no el 5.0 de su plantilla, si no el de la fila de epoch.8.7 del mundo `pv` donde cuelga X (sin `pv`, nada).
 * Todo texto pasa por cssSeguro. → { css, origen } con origen 'registro' | 'padre' | 'plantilla' | 'epoca' | null.
 */
export function estilo(eje, X, { de = 'propio', pv, ...opciones } = {}) {
  const ninguno = { css: '', origen: null };
  if (de !== 'propio' && de !== 'hijos') throw new TypeError("el estilo es 'propio' o 'hijos'");
  const ev = eventoDe(eje, X);
  const camino = de === 'propio' ? [0, 9] : [5, 0];
  // El 5.0 ocupa la dirección del 5 (x.0 es x, colisión por ceros): lo escrito en él es lo escrito en el 5, y lo que no es un estilo (el nombre de la plantilla) no cuenta.
  const enEje = de === 'propio' ? camino : [5];
  const delRegistro = ev ? estiloEscrito(eje, X, enEje, opciones) : '';
  if (delRegistro) return { css: delRegistro, origen: 'registro' };
  if (de === 'hijos' && typeof ev?.sobre === 'string') {
    const delPadre = estiloEscrito(eje, ev.sobre, enEje, opciones);
    if (delPadre) return { css: delPadre, origen: 'padre' };
  }
  const p = ev ? plantilla(eje, X, opciones) : null;
  const dePlantilla = p ? ultimoEstilo(hojas(en(p, camino))) : '';
  if (dePlantilla) return { css: dePlantilla, origen: 'plantilla' };
  if (de === 'hijos' && typeof pv === 'number') {
    const delMundo = divisionDelMundo(eje, pv, opciones)?.estilo ?? '';
    if (delMundo) return { css: delMundo, origen: 'epoca' };
  }
  return ninguno;
}

// ---------- 5. la madurez ----------

/** Los niveles genéricos de la época (epoch.8.4): los de posición y los de orden de magnitud, en orden (con `idioma`, traducidos: «level <nombre>»). */
export function niveles(opciones = {}) {
  const raiz = raizDe(epocaDe(opciones));
  const lista = [...hojas(en(raiz, [...SITIO.madurez, 2])), ...hojas(en(raiz, [...SITIO.madurez, 4]))];
  return opciones.idioma ? lista.map((n) => texto_(null, CLAVE.nivel(n), opciones.idioma, { original: n, epoca: opciones.epoca })) : lista;
}

/**
 * La madurez de X: la lectura «maturity» de la época (X.8.1), su medida (X.8.6: posiciones escritas del subárbol,
 * profundidad y cantidad que mueve) y el nombre del nivel: entre los de su plantilla (su 8.8), repartidos
 * proporcionalmente sobre los genéricos, o entre los genéricos de epoch.8.4. → { nivel, de, nombre, clave, medida };
 * con `idioma`, `nombre` es la traducción («level <nombre>») y `clave` el nombre canónico.
 */
export function madurez(eje, X, opciones = {}) {
  const ev = eventoDe(eje, X);
  if (!ev) return null;
  const epoca = epocaDe(opciones);
  const ctx = contextoDe(eje, epoca, ev);
  const s = expresion(sujetoDe(ctx, eje, ev));
  const nivelGenerico = uno('first ' + s + '.8.1', ctx);
  const medida = { posiciones: uno(s + '.8.6.1', ctx), profundidad: uno(s + '.8.6.5', ctx), cantidad: uno(s + '.8.6.4', ctx) };
  if (typeof nivelGenerico !== 'number') return { nivel: null, de: null, nombre: null, clave: null, medida };
  const genericos = niveles({ epoca: opciones.epoca });
  const propios = hojas(descripcion(plantilla(eje, ev, opciones), [8])?.[8]).filter((x) => typeof x === 'string');
  const escala = propios.length ? propios : genericos;
  const nivel = propios.length ? Math.max(1, Math.ceil(nivelGenerico * propios.length / genericos.length)) : nivelGenerico;
  const de = escala.length;
  const clave = escala[Math.min(nivel, de) - 1] ?? null;
  const nombre = clave !== null && opciones.idioma ? texto_(eje, CLAVE.nivel(clave), opciones.idioma, { original: clave, epoca: opciones.epoca }) : clave;
  return { nivel: Math.min(nivel, de), de, nombre, clave, medida };
}

// ---------- 6. el diario ----------

/**
 * El diario del subárbol de X: sus transacciones (X y lo anclado bajo él, a cualquier profundidad) por llegada, cada
 * una con sus asientos del libro (lo que de verdad se movió: movimientos, asignación y obtención) y su ancla.
 * Paginado desde un índice o desde un id: { total, desde, entradas: [{ id, t, autor, movimientos, ancla, pv, estado }] }. Con
 * `opciones.orden`, el nombre de un orden de epoch.8.5 (el de la lista vertical del 6: divisionDelMundo(…).orden), en
 * ese orden: «instante» por el t de cada transacción (a igual t, por llegada) y «reverse» al revés; el encaje no
 * ordena transacciones (por llegada). Encargo «datos3» (issue #11): `pv` es el PV de X del que cuelga la entrada
 * (pvDeEntrada: el hilo de las franjas del 6 y el 7) y `estado`, el de su futuro (estadoDeEntrada) o null.
 */
export function diario(eje, X, desde = 0, cuantos, opciones = {}) {
  const ev = eventoDe(eje, X);
  if (!ev || typeof ev.id !== 'string' || !eje?.obtener(ev.id)) return { total: 0, desde: 0, entradas: [] };
  const vistos = new Set([ev.id]);
  const frente = [ev.id];
  while (frente.length) {
    const id = frente.shift();
    for (const h of eje.sobre(id)) if (!vistos.has(h.id)) { vistos.add(h.id); frente.push(h.id); }
  }
  let ids = eje.orden.filter((id) => vistos.has(id));
  const [mecanismo, ...marcas] = ordenPorNombre(opciones.orden, opciones)?.mecanismo ?? [];
  if (mecanismo === 'instante') ids = porInstante(ids, (id) => eje.obtener(id)?.t);
  if (mecanismo && marcas.includes('reverse')) ids.reverse();
  const inicio = typeof desde === 'string' ? Math.max(0, ids.indexOf(desde)) : Math.max(0, desde);
  const n = cuantos ?? paso(opciones);
  const asientosDe = (e) => (e.sobre ? eje.libro.asientos({ registro: e.sobre }) : eje.libro.asientos()).filter((a) => a.tx?.id === e.id)
    .map(({ primitiva, serie, de, a, cantidad, salida, clase, etiqueta }) => ({ primitiva, serie, de, a, cantidad, ...(salida !== undefined && salida !== null ? { salida } : {}), ...(clase ? { clase } : {}), ...(etiqueta !== undefined && etiqueta !== null ? { etiqueta } : {}) }));
  const entradas = ids.slice(inicio, inicio + n).map((id) => {
    const e = eje.obtener(id);
    return { id, t: e.t, autor: e.autor, movimientos: asientosDe(e), ancla: { sobre: e.sobre ?? null, en: e.en ?? RAIZ }, pv: pvDeEntrada(eje, ev.id, id), estado: estadoDeEntrada(eje, id, opciones) };
  });
  return { total: ids.length, desde: inicio, entradas };
}

// ---------- 6b. las entradas de las franjas y el cielo (encargo «datos3», issue #11; Core, pendiente de revisar VG) ----------

/** El reloj del libro: `opciones.t` o el mayor t aceptado del eje (como yo()), o null. */
const relojDe = (eje, opciones) => opciones?.t ?? (Number.isFinite(eje?.tMaximo?.()) ? new Date(eje.tMaximo()).toISOString() : null);

/** El primer dígito de un «en» (la posición del padre que modifica un registro); 0 en la raíz o si no se entiende. */
function primerDigito(en) {
  try { return typeof en === 'string' ? indicesDe(en)[0] ?? 0 : 0; } catch { return 0; }
}

/**
 * La posición de su padre a la que se refiere un registro: la primera referencia de su payload al padre con dirección
 * (`{ ref: <padre>, dir }`, recorrida en el orden de sus posiciones), el primer dígito de esa dirección; null si no la hay.
 */
function digitoReferido(payload, padre) {
  let fuera = null;
  const ver = (x) => {
    if (fuera !== null) return;
    if (esReferencia(x)) { if (x.ref === padre && typeof x.dir === 'string') fuera = primerDigito(x.dir) || null; return; }
    if (Array.isArray(x)) x.forEach(ver);
  };
  ver(payload);
  return fuera;
}

/**
 * El PV de X del que cuelga un registro de su subárbol (el hilo de las franjas del 6 y el 7): el de la posición que
 * modificó, el primer dígito de su «en»; si se anclaba en la raíz de su padre pero referencia una posición de su padre
 * (`{ ref: <padre>, dir }`: la compra referencia el 1 del menú), el dígito de esa posición; si no, 0 (el centro). X mismo
 * es el centro (0); null si `id` no cuelga de X.
 */
export function pvDeEntrada(eje, X, id) {
  const raiz = typeof X === 'string' ? X : X?.id;
  const ev = typeof id === 'string' ? eje?.obtener?.(id) : null;
  if (!ev || typeof raiz !== 'string') return null;
  if (ev.id === raiz) return 0;
  if (!eje.hilo(ev.id).some((e) => e.id === raiz)) return null;
  const d = primerDigito(ev.en);
  if (d !== 0) return d;
  return (ev.sobre ? digitoReferido(ev.payload, ev.sobre) : null) ?? 0;
}

/** Los estados del futuro de una entrada (estadoDeEntrada): los nombres que da el núcleo; los textos son de la carta. */
const ESTADO = Object.freeze({ previsto: 'previsto', bloqueado: 'bloqueado', liberado: 'liberado', caduca: 'caduca', caducado: 'caducado' });

/**
 * El estado del futuro de un registro (encargo «datos3»), del primero de sus movimientos declarados que lo da, o null:
 *   previsto   declara T de la escala «futuro» (epoch.1.3.1, el dígito 8) con la fecha a la que se refiere («when»);
 *   bloqueado  bloquea algo con una salida que es una fecha (lo que hace «commit time»: bloqueado hasta), y sigue bloqueado;
 *   liberado   lo mismo, pero ya no queda nada bloqueado con esa salida;
 *   caduca     emite E con una caducidad que aún no ha llegado (el reloj del libro, o `opciones.t`);
 *   caducado   esa caducidad ya pasó, o quema E propia (lo que hace «expire something mine»; la fecha es la del registro).
 * → { tipo, fecha, serie?, cantidad } (fecha ISO).
 */
export function estadoDeEntrada(eje, id, opciones = {}) {
  const ev = typeof id === 'string' ? eje?.obtener?.(id) : null;
  if (!ev || !Array.isArray(ev.movimientos)) return null;
  const futuro = texto(hoja(hojas(en(raizDe(epocaDe(opciones)), [...SITIO.familias, 3, 1]))[8]?.[0]));
  const ahora = msUTC(relojDe(eje, opciones) ?? '');
  const serieDe = (m) => { try { return claveToken(m); } catch { return null; } };
  for (const m of ev.movimientos) {
    if (!m || typeof m !== 'object') continue;
    if (m.token === 'T' && m.escala === futuro && esInstante(m.refiere)) return { tipo: ESTADO.previsto, fecha: m.refiere, cantidad: m.cantidad };
    if (m.estado === 'bloqueo' && esInstante(m.salida)) {
      const serie = serieDe(m);
      const sigue = serie !== null && typeof eje.bloqueado === 'function' && eje.bloqueado(m.de, serie, m.salida) > 0;
      return { tipo: sigue ? ESTADO.bloqueado : ESTADO.liberado, fecha: m.salida, serie, cantidad: m.cantidad };
    }
    if (m.token === 'E' && m.de === null && esInstante(m.caduca)) return { tipo: msUTC(m.caduca) <= ahora ? ESTADO.caducado : ESTADO.caduca, fecha: m.caduca, serie: serieDe(m), cantidad: m.cantidad };
    if (m.token === 'E' && m.a === null && m.de !== null && m.de === m.emisor) return { tipo: ESTADO.caducado, fecha: ev.t, serie: serieDe(m), cantidad: m.cantidad };
  }
  return null;
}

/**
 * La escala del calendario de una fecha vista desde el reloj del libro (`opciones.t` o el del eje): la más fina de las
 * que el calendario mide (epoch.7.0, con sus segundos) que contiene la distancia, como tiempo.banda; más allá de la más
 * gruesa, la más gruesa (Core, pendiente de revisar VG). → el dígito de esa escala en epoch.1.3.1, o null sin fecha o sin reloj.
 */
export function escalaDeFecha(eje, fecha, opciones = {}) {
  const ms = msUTC(typeof fecha === 'string' ? fecha : '');
  const ahora = msUTC(relojDe(eje, opciones) ?? '');
  if (!Number.isFinite(ms) || !Number.isFinite(ahora)) return null;
  const raiz = raizDe(epocaDe(opciones));
  const segundos = new Map(hojas(en(raiz, [7, 0])).filter(Array.isArray).map((r) => [texto(hoja(r[0])), Number(hoja(r[1]))]));
  const escalas = escalasDelCalendario(raiz).map((e) => ({ ...e, segundos: segundos.get(e.nombre) })).filter((e) => Number.isFinite(e.segundos)).sort((a, b) => a.segundos - b.segundos);
  if (!escalas.length) return null;
  const distancia = Math.abs(ms - ahora) / 1000;
  return (escalas.find((e) => distancia < e.segundos) ?? escalas[escalas.length - 1]).escala;
}

/**
 * La franja de una entrada en un mundo de franjas (el 6 o el 7): la del primer paso de la fila (divisionDelMundo(…).pasos)
 * que da valor sobre ella (el 7: «cuando», la escala de la fecha a la que se refiere; si no, «escala», la del T que
 * quema). `declarada` es la del último paso (la escala que declara su T) e `incongruente`, si la coloca otro paso y
 * dan franjas distintas (una entrada cuya escala declarada no coincide con la que le toca por fecha).
 * → { k, paso, declarada, incongruente } o null si la fila no tiene pasos.
 */
export function franjaDeEntrada(eje, id, pv, { division: dada, ...opciones } = {}) {
  const d = dada ?? divisionDelMundo(eje, pv, opciones);
  const nombres = d?.pasos ?? [];
  if (!nombres.length) return null;
  const valores = nombres.map((n) => { const k = pasoDe(eje, id, n, opciones)?.k; return typeof k === 'number' ? k : null; });
  const i = valores.findIndex((k) => k !== null);
  const declarada = valores[valores.length - 1];
  const k = i < 0 ? null : valores[i];
  return { k, paso: i < 0 ? null : nombres[i], declarada, incongruente: i >= 0 && i < nombres.length - 1 && declarada !== null && declarada !== k };
}

/** La plantilla de transacción que cambia la cohorte (epoch.9.6) y su parámetro: se leen de la época. */
const CAMBIAR_COHORTE = Object.freeze({ plantilla: 'change cohort', parametro: 'cohort' });

/**
 * Lo que dice cada valor del parámetro «cohort» de «change cohort» en las cohortes de las bases (bases.ALCANCES), como
 * lo explica su ayuda (epoch.9.4: siblings los hermanos, project el proyecto, genesis el génesis, cuyo 8 resume la
 * cohorte «general»). Un valor que no está aquí no es una cohorte que el 8 sepa leer.
 */
const ALCANCE_DE_COHORTE = Object.freeze({ siblings: 'hermanos', project: 'proyecto', genesis: 'general' });

/** Una plantilla de transacción de la época por su nombre, y uno de sus parámetros por su etiqueta. */
const transaccionPorNombre = (epoca, nombre) => (Array.isArray(epoca?.transacciones) ? epoca.transacciones : []).map((x) => x.plantilla).find((p) => texto(hoja(p?.[0])) === nombre) ?? null;
const parametroPorEtiqueta = (p, etiqueta) => hojas(p?.[1]).filter(Array.isArray).find((x) => texto(hoja(x[0])) === etiqueta) ?? null;

/**
 * Las cohortes que la época admite (encargo «datos3»): los valores que la validación del parámetro «cohort» de «change
 * cohort» enumera (la misma lista que da opciones() a su formulario), cada uno con la cohorte de las bases que lee y su
 * texto en el idioma («legible cohort <valor>» de epoch.9.4): [{ valor, alcance, texto }].
 */
export function cohortes(opciones = {}) {
  const epoca = epocaDe(opciones);
  const param = parametroPorEtiqueta(transaccionPorNombre(epoca, CAMBIAR_COHORTE.plantilla), CAMBIAR_COHORTE.parametro);
  const valores = valoresDeValidacion(texto(ultima(param?.[2]))) ?? [];
  return valores.filter((v) => Object.hasOwn(ALCANCE_DE_COHORTE, v)).map((v) => ({ valor: v, alcance: ALCANCE_DE_COHORTE[v], texto: texto_(null, CLAVE.legible('cohort ' + v), opciones.idioma ?? 'en', { original: v, epoca }) }));
}

/** La cohorte que el dueño de X eligió: el último «change cohort» suyo anclado donde ancla la plantilla (el 8 de X): { valor, de } o null. */
function cohorteEscrita(eje, ev, opciones) {
  const p = transaccionPorNombre(epocaDe(opciones), CAMBIAR_COHORTE.plantilla);
  const param = parametroPorEtiqueta(p, CAMBIAR_COHORTE.parametro);
  const ancla = p ? texto(hoja(p[5])) : undefined;
  const donde = param ? texto(hoja(param[5])) : undefined;
  if (!ancla || !donde || ancla.startsWith('=') || donde === '-' || typeof eje?.sobre !== 'function') return null;
  const escritos = eje.sobre(ev.id, direccion(caminoDe(ancla))).filter((h) => h.autor === ev.autor && hojas(h.payload?.[4]).includes(CAMBIAR_COHORTE.plantilla));
  const ultimo = escritos[escritos.length - 1];
  const v = ultimo ? hoja(en(ultimo.payload, caminoDe(donde))) : undefined;
  return typeof v === 'string' ? { valor: v, de: ultimo.id } : null;
}

/**
 * La cohorte del 8 de X (encargo «datos3», issue #11; Core, pendiente de revisar VG): contra quién se compara X. La
 * cohorte es la pedida (`cohorte`, un valor o una cohorte de las bases), si no la que eligió su dueño («change cohort» en
 * su 8) y si no la primera que admite la época (cohortes()). Los comparables son los registros de esa cohorte
 * (bases.comparables, por bases.confluir: medidos al vuelo), cada uno en la caja (0-9) de su cuota en la cohorte en la
 * serie en que más pesa (lo mismo que el paso «cuota», share box, pero frente a la cohorte entera; bases.cajaDeCuota),
 * o null si no mueve nada. La base es la escrita en el 8 que resume la cohorte (bases.situar): quién la escribió y cuándo;
 * sin ella, { escrita: false, texto: SIN_BASE_ESCRITA } (lo que se ve está calculado al vuelo).
 * Encargo «el4» (VG 12-11, #39: un solo rango, el del 8): cada comparable lleva además su `rango`, el peldaño de la
 * escalera que ha alcanzado (rango(), 0-9), y la cohorte el del foco; `caja` sigue siendo la de su cuota (una medida).
 * → { cohorte, alcance, texto, elegida, cohortes, registro, base, comparables: [{ ref, caja, cuota, serie, foco, rango }], caja, rango } o null.
 */
export function cohorteDe(eje, X, { cohorte, ...opciones } = {}) {
  const ev = eventoDe(eje, X);
  if (!ev || typeof ev.id !== 'string' || !eje?.obtener?.(ev.id)) return null;
  const lista = cohortes(opciones);
  const elegida = cohorteEscrita(eje, ev, opciones);
  const c = lista.find((x) => x.valor === cohorte || x.alcance === cohorte) ?? lista.find((x) => x.valor === elegida?.valor) ?? lista[0];
  if (!c) return null;
  let s;
  try { s = confluir(eje, ev.id, { alcance: c.alcance }); } catch { return null; }
  const celdas = new Map();
  const comparables = (s.comparables ?? []).map((fila) => {
    let mejor = null;
    for (const clave of Object.keys(fila.tokens ?? {}).sort()) {
      const v = fila.tokens[clave];
      const suma = s.tokens?.[clave]?.suma;
      if (v > 0 && suma > 0 && (!mejor || v / suma > mejor.cuota)) mejor = { serie: clave, cuota: v / suma };
    }
    const r = rango(eje, fila.id, { ...opciones, celdas });
    return { ref: fila.id, caja: mejor ? cajaDeCuota(mejor.cuota) : null, cuota: mejor ? redondo(mejor.cuota) : null, serie: mejor?.serie ?? null, foco: fila.id === ev.id, rango: r ? r.peldano : null };
  });
  let base = null;
  let leida;
  try { leida = situar(eje, ev.id, { alcance: c.alcance }); } catch { leida = null; }
  if (leida?.estado === 'RESUELTO' && leida.escrita) base = { escrita: true, id: leida.base, autor: leida.autor, t: leida.frescura?.t ?? null, registro: leida.registro };
  else if (leida && leida.registro !== null) base = { escrita: false, registro: leida.registro, texto: SIN_BASE_ESCRITA };
  return {
    cohorte: c.valor, alcance: c.alcance, texto: c.texto, elegida: elegida?.valor ?? null, cohortes: lista, registro: s.registro ?? null, base, comparables,
    caja: comparables.find((x) => x.foco)?.caja ?? null,
    rango: comparables.find((x) => x.foco)?.rango ?? rango(eje, ev.id, { ...opciones, celdas })?.peldano ?? null,
  };
}

/**
 * Las cajas del cielo del 8 como hijos (hijosDe): una por banda de los hitos (un peldaño de la escalera), con los
 * comparables de la cohorte de X cuyo rango es ese peldaño (encargo «el4», #39: un solo rango; la cuota queda como medida).
 */
function cajasDelCielo(eje, X, d, { cohorte, cuantos, ...opciones }) {
  const c = cohorteDe(eje, X, { cohorte, ...opciones });
  return d.bandas.map((b) => {
    const dentro = (c?.comparables ?? []).filter((x) => x.rango === b.indice);
    return {
      digito: b.indice, nombre: b.nombre, nivel: b.nivel, grado: b.grado,
      ocupantes: dentro.slice(0, cuantos ?? paso(opciones)).map((x) => ({ ref: x.ref })), total: dentro.length, vacio: dentro.length === 0,
      comparables: dentro, foco: dentro.some((x) => x.foco), cohorte: c?.cohorte ?? null, base: c?.base ?? null,
    };
  });
}

// ---------- 7. yo y mi configuración ----------

/**
 * Mi foco: mi alta y sus posiciones, leídas como vistas del libro con el BQL mínimo (las del encargo 3a): 1 la
 * cartera, 2 el criterio (2.1 el P posicionado, 2.3 los criterios que adopto), 3 los grupos de atención, 7 el tiempo
 * gastado hoy (a la fecha `t`; por defecto, el reloj del libro). → { identidad, alta, cartera, criterio, atencion, tiempo }
 * o null si la identidad no tiene alta.
 */
export function yo(eje, identidad, { t, ...opciones } = {}) {
  const alta = eje?.alta(identidad);
  if (!alta) return null;
  const epoca = epocaDe(opciones);
  const raiz = raizDe(epoca);
  const reloj = t ?? (Number.isFinite(eje.tMaximo()) ? new Date(eje.tMaximo()).toISOString() : undefined);
  const ctx = contextoDe(eje, epoca, { autor: identidad, t: reloj, movimientos: [], payload: [identidad] });
  const A = '("' + identidad + '")';
  const cuenta = (expr) => uno('count ' + expr, ctx) ?? 0;
  const cartera = [];
  for (let k = 0; k < cuenta(A + '.1'); k++) {
    const e = '(nth ' + k + ' ' + A + '.1)';
    cartera.push({ serie: uno(e + '.0', ctx), disponible: uno(e + '.1', ctx), bloqueado: planos(e + '.2 each 0', ctx).map((salida, j) => ({ salida, cuanto: uno('nth ' + j + ' (' + e + '.2 each 1)', ctx) })) });
  }
  const posicionado = [];
  for (let k = 0; k < cuenta(A + '.2.1'); k++) {
    const e = '(nth ' + k + ' ' + A + '.2.1)';
    // P por mirada (VG, tras 3b-bis): la entrada de una mirada lleva su dígito en el 5; la del registro entero, nada.
    const mirada = uno(e + '.5', ctx);
    posicionado.push({ registro: uno(e + '.0', ctx), ...(mirada === undefined ? {} : { mirada }), cuanto: uno(e + '.1', ctx), disponible: uno(e + '.4', ctx), origenes: planos(e + '.6', ctx) });
  }
  const atencion = atencionDe(identidad, ctx);
  const escalas = hojas(en(raiz, [...SITIO.familias, 3, 1])).filter(Array.isArray).map((x) => hoja(x[0]));
  const tiempo = {};
  escalas.forEach((nombre, k) => {
    const v = uno(A + '.7.' + k, ctx);
    if (typeof v === 'number') tiempo[nombre] = v;
  });
  return { identidad, alta: alta.id, cartera, criterio: { posicionado, adopta: planos(A + '.2.3', ctx) }, atencion, tiempo };
}

/**
 * Los grupos de atención de una identidad (su A.3, mapa §16 [D]): uno por zona, en su orden, cada uno con su nombre, su
 * zona, su precio (el último de su 2: { enQue, cuanto }) y quiénes están en él. [] si no tiene alta.
 */
function atencionDe(identidad, ctx) {
  const A = '("' + identidad + '")';
  const atencion = [];
  const n = uno('count ' + A + '.3', ctx) ?? 0;
  for (let k = 0; k < n; k++) {
    const e = '(nth ' + k + ' ' + A + '.3)';
    atencion.push({ nombre: uno(e + '.0', ctx) ?? null, zona: uno(e + '.1', ctx), precio: { enQue: uno('(last ' + e + '.2).0', ctx), cuanto: uno('(last ' + e + '.2).1', ctx) }, quienes: planos(e + '.3', ctx) });
  }
  return atencion;
}

/**
 * Mi configuración: el registro anclado en el 9 de mi alta por mí cuyo tipo es la plantilla «preferences» de la época
 * (el último), leído con las etiquetas de la plantilla como claves; sin registro, los defectos de la plantilla (las
 * hojas de cada d.9 menos la ayuda). `yo` es la identidad o lo que devuelve yo(). → { <etiqueta>: valor, …, de: id | null }.
 */
export function configuracion(eje, quien, opciones = {}) {
  return leerConfiguracion(eje, quien, en(raizDe(epocaDe(opciones)), SITIO.preferencias), opciones);
}

/**
 * Los ajustes de otra plantilla de configuración de la época, por su nombre (hoy «guide settings»: la guía del PV9; la
 * de preferencias tiene ya las diez posiciones): el registro anclado en el 9 de mi alta por mí cuyo tipo es esa
 * plantilla (el último), leído con sus etiquetas como claves; sin registro, sus defectos. → { <etiqueta>: valor, …, de }.
 */
export function configuracionDe(eje, quien, nombre, opciones = {}) {
  const p = plantillas(null, opciones).find((x) => x.nombre === nombre)?.registro;
  return leerConfiguracion(eje, quien, p, opciones);
}

/**
 * El nombre de la plantilla de los ajustes de la guía del PV9: lo dice el propio registro de la guía (su 5), no el
 * código. Sus posiciones, por orden, son las claves de `configuracionDe` (docs/CONTRATO.md §16).
 */
export const ajustesDeLaGuia = (opciones = {}) => guia(null, 'en', opciones)?.ajustes ?? null;

/** Los ajustes de la guía de quien mira (configuracionDe con su plantilla): { <etiqueta>: valor, …, de }. */
export const configuracionGuia = (eje, quien, opciones = {}) => configuracionDe(eje, quien, ajustesDeLaGuia(opciones), opciones);

/** La posición de los ajustes de la guía donde cada cual dice dónde ancla sus opiniones como registros (docs/CONTRATO.md §12.7): la 6 de «guide settings». */
export const POSICION_ANCLA_DE_OPINIONES = 6;

/**
 * Dónde ancla `quien` sus opiniones como registros: lo que dice su registro de ajustes de la guía en la posición 6 (el id
 * o el 0 de un registro, tal cual lo escribió) o null si no lo ha dicho (o escribió «-»: quitarla). La resolución a un
 * registro es de acciones.registroDe.
 */
export function anclaDeLasOpiniones(eje, quien, opciones = {}) {
  const nombre = ajustesDeLaGuia(opciones);
  const clave = clavesDeConfiguracionDe(nombre, opciones).find((c) => c.pv === POSICION_ANCLA_DE_OPINIONES)?.clave;
  const v = clave ? configuracionDe(eje, quien, nombre, opciones)[clave] : undefined;
  return typeof v === 'string' && v.trim() && v.trim() !== '-' ? v.trim() : null;
}

/** ¿Es X un registro de configuración (de las preferencias o de los ajustes de la guía)? Lo que no se manda a ninguna IA: puede llevar dónde se comparte el eje. */
export function esDeConfiguracion(eje, X, opciones = {}) {
  const p = plantilla(eje, X, opciones);
  if (!p) return false;
  return p === en(raizDe(epocaDe(opciones)), SITIO.preferencias) || p === plantillas(null, opciones).find((x) => x.nombre === ajustesDeLaGuia(opciones))?.registro;
}

function leerConfiguracion(eje, quien, p, opciones) {
  const identidad = typeof quien === 'string' ? quien : quien?.identidad;
  if (!esPlantilla(p)) return { de: null };
  const valores = {};
  // El 5 es el tipo (B4: ahí el registro nombra su plantilla), no una preferencia: la plantilla lo describe para que
  // las posiciones de detrás existan (encargo 3c-2b: «model» en el 6), y aquí no se lee.
  for (let d = 1; d < ARIDAD; d++) {
    if (d === 5) continue;
    const desc = descripcion(p, [d]);
    if (!desc) continue;
    const nombre = texto(hoja(desc[0]));
    const defecto = hojas(desc[9]).slice(0, -1);
    if (nombre && defecto.length) valores[nombre] = defecto.length === 1 ? defecto[0] : defecto;
  }
  const alta = identidad ? eje?.alta(identidad) : null;
  let registro = null;
  if (alta) {
    for (const h of eje.sobre(alta.id, direccion([9]))) if (h.autor === identidad && plantilla(eje, h, opciones) === p) registro = h;
  }
  if (registro && Array.isArray(registro.payload)) {
    for (let d = 1; d < ARIDAD; d++) {
      if (d === 5) continue;
      const desc = descripcion(p, [d]);
      const nombre = texto(hoja(desc?.[0]));
      const v = hojas(registro.payload[d]).filter((x) => esTerminal(x));
      if (nombre && v.length) valores[nombre] = v.length === 1 ? v[0] : v;
    }
  }
  return { ...valores, de: registro?.id ?? null };
}

/**
 * Las posiciones de la plantilla «preferences» que son preferencias, en orden: [{ pv, clave, defecto }] (todas las
 * que la plantilla describe salvo el 5, que es el tipo: B4). `defecto` es el de la época, o undefined si la posición
 * no lo tiene (como `sync url` y `sync ledger`: sin valor, configuracion no las devuelve). Lo que la carta pinta en
 * el formulario de la configuración.
 */
export function clavesDeConfiguracion(opciones = {}) {
  return clavesDe(en(raizDe(epocaDe(opciones)), SITIO.preferencias));
}

/** Lo mismo para otra plantilla de configuración de la época, por su nombre (hoy «guide settings»). */
export function clavesDeConfiguracionDe(nombre, opciones = {}) {
  return clavesDe(plantillas(null, opciones).find((x) => x.nombre === nombre)?.registro);
}

/**
 * Los valores que admite una posición cuando su validación es una enumeración, «="a" in it.N or "b" in it.N …» (la del
 * pintado: sober o animated): las palabras entre comillas, en su orden; null si la validación no es de esa forma.
 */
function valoresDeValidacion(formula) {
  if (typeof formula !== 'string') return null;
  const clausula = /^\s*"([^"]+)"\s+in\s+it(?:\.\d+)*\s*$/;
  const partes = formula.replace(/^=/, '').split(/\s+or\s+/);
  if (!formula.startsWith('=') || !partes.every((x) => clausula.test(x))) return null;
  return partes.map((x) => x.match(clausula)[1]);
}

function clavesDe(p) {
  if (!esPlantilla(p)) return [];
  const claves = [];
  for (let d = 1; d < ARIDAD; d++) {
    if (d === 5) continue;
    const desc = descripcion(p, [d]);
    const clave = texto(hoja(desc?.[0]));
    if (!clave) continue;
    const defecto = hojas(desc[9]).slice(0, -1);
    const valores = valoresDeValidacion(texto(ultima(desc[2])));
    claves.push({ pv: d, clave, defecto: defecto.length ? (defecto.length === 1 ? defecto[0] : defecto) : undefined, ...(valores ? { valores } : {}) });
  }
  return claves;
}

/**
 * Las instrucciones de la guía del PV9, leídas de la época (el 9.9: un registro referenciado, como las reglas): el texto
 * base, que es dato y no código. Cada texto va en el idioma pedido por su clave en el 9.4 («guide role», «guide
 * summary», «guide rules», «guide answer», «guide question N»); si falta, el inglés del propio registro. → { id, nombre,
 * papel, resumen, normas, preguntas: [texto], ajustes: nombre de la plantilla de sus ajustes, respuesta: cómo se
 * responde desde fuera de AGRAM (§16.6), opinion: nombre de la plantilla de una opinión, ancla: nombre de la
 * transacción que la ancla } o null si la época no trae guía.
 */
export function guia(eje, idioma = 'en', opciones = {}) {
  const epoca = epocaDe(opciones);
  const raiz = raizDe(epoca);
  const ref = hojas(en(raiz, SITIO.guia)).find((h) => esReferencia(h));
  const registro = ref ? epoca.registros?.get(ref.ref) : null;
  if (!Array.isArray(registro)) return null;
  const T = (clave, original) => texto_(eje, clave, idioma, { original, ...opciones });
  const cuerpo = (d, clave) => T(clave, hojas(registro[d]).filter((x) => typeof x === 'string')[0] ?? '');
  return {
    id: ref.ref,
    nombre: texto(hoja(hoja(registro[0]))),
    papel: cuerpo(1, 'guide role'),
    resumen: cuerpo(2, 'guide summary'),
    normas: cuerpo(3, 'guide rules'),
    preguntas: hojas(registro[4]).filter((x) => typeof x === 'string').map((q, k) => T('guide question ' + (k + 1), q)),
    ajustes: texto(hoja(registro[5])) ?? null,
    respuesta: cuerpo(6, 'guide answer'),
    opinion: texto(hoja(registro[7])) ?? null,
    ancla: texto(hoja(registro[8])) ?? null,
  };
}

// ---------- 8. mensajes y traducción ----------

/** Los idiomas con mensajes en la época (epoch.9.4): sus códigos, con el canónico (en) delante y sin repetir. */
export function idiomas(opciones = {}) {
  const raiz = raizDe(epocaDe(opciones));
  const registros = hojas(en(raiz, SITIO.mensajes)).slice(1).filter(Array.isArray);
  return [...new Set(['en', ...registros.map((r) => texto(hoja(r[0]))).filter(Boolean)])];
}

/**
 * El mensaje de una regla (su 9, canónico en inglés) en un idioma: el registro «messages» de ese idioma en la época
 * tiene un ocupante por regla, «<nombre de la regla>: <texto>», con los mismos huecos {…}; si falta el idioma o la
 * regla, el inglés. Los huecos se resuelven con el contexto del eje (y la candidata `ev`, si se da) como el 9 de toda
 * regla (bqlm.rellenar). `regla` es la décupla o su nombre.
 */
export function mensaje(eje, regla, idioma = 'en', { ev, ...opciones } = {}) {
  const epoca = epocaDe(opciones);
  const raiz = raizDe(epoca);
  const r = Array.isArray(regla) ? regla : (epoca.reglasConId ?? []).map((x) => x.regla).find((x) => nombreDeRegla(x) === regla);
  if (!r) return null;
  const nombre = nombreDeRegla(r);
  let plantillaTexto = texto(ultima(r[9])) ?? nombre;
  if (idioma && idioma !== 'en') {
    const registros = hojas(en(raiz, SITIO.mensajes)).slice(1).filter(Array.isArray);
    const del = registros.find((x) => hojas(x[0]).includes(idioma));
    const entradas = hojas(del?.[1]);
    const prefijo = nombre + ': ';
    const propio = entradas.find((x) => typeof x === 'string' && x.startsWith(prefijo))
      ?? (Array.isArray(del?.[1]) && esDecupla(del[1]) ? del[1].filter(Array.isArray).map((par) => (hoja(hoja(par[0])) === nombre ? prefijo + hoja(par[1]) : undefined)).find(Boolean) : undefined);
    if (propio) plantillaTexto = propio;
  }
  if (!eje && !ev) return plantillaTexto;
  return rellenar(plantillaTexto, contextoDe(eje, epoca, ev));
}

// ---------- 9. textos de la época por clave, y valores legibles ----------

/** Los textos de cada idioma de la época por clave: idioma → Map(clave → texto); se lee una vez por época (la raíz está congelada). */
const TEXTOS = new WeakMap();
function textosDe(raiz) {
  if (!TEXTOS.has(raiz)) {
    const porIdioma = new Map();
    for (const r of hojas(en(raiz, SITIO.mensajes)).slice(1).filter(Array.isArray)) {
      const mapa = new Map();
      for (const h of hojas(r[1])) {
        const i = typeof h === 'string' ? h.indexOf(': ') : -1;
        if (i > 0 && !mapa.has(h.slice(0, i))) mapa.set(h.slice(0, i), h.slice(i + 2));
      }
      for (const codigo of hojas(r[0])) if (typeof codigo === 'string' && !porIdioma.has(codigo)) porIdioma.set(codigo, mapa);
    }
    TEXTOS.set(raiz, porIdioma);
  }
  return TEXTOS.get(raiz);
}

/**
 * Un texto de la época por su clave en un idioma (el registro del idioma en epoch.9.4, una hoja «<clave>: <texto>»):
 * la traducción; si falta, la del registro canónico (en); si falta, `original` (el texto en inglés que ya tiene quien
 * pregunta: el nombre de la plantilla, la etiqueta, la ayuda); si no hay nada, null. Las claves: «template <nombre>»
 * (el nombre de una plantilla de transacción o de datos), «template <nombre> param <etiqueta> label | help |
 * placeholder» (lo que dice de un parámetro o de una posición), «template <nombre> message» (su 9, con los mismos
 * huecos), «level <nombre>», «order <nombre>», «size <nombre>» y «legible <qué>» (los formatos de legible()).
 */
function texto_(eje, clave, idioma = 'en', { original, ...opciones } = {}) {
  const porIdioma = textosDe(raizDe(epocaDe(opciones)));
  const propio = idioma ? porIdioma.get(idioma)?.get(clave) : undefined;
  if (propio !== undefined) return propio;
  const canonico = porIdioma.get('en')?.get(clave);
  if (canonico !== undefined) return canonico;
  return original === undefined || original === null ? null : String(original);
}
export { texto_ as texto };
/** Las claves de traducción que usa este módulo (epoch.9.4), para quien compone una clave fuera: plantilla(nombre), parametro(nombre, etiqueta, que), mensaje(nombre), nivel, orden, tamano, legible. */
export const claves = CLAVE;

/** Un motivo de una acción en el idioma (clave «reason <qué>», uno de MOTIVOS) con sus huecos {…} rellenos con `partes`; sin idioma, el canónico (en). */
export function motivo(que, partes = {}, { idioma = 'en', ...opciones } = {}) {
  return plano_(texto_(null, CLAVE.motivo(que), idioma, { epoca: opciones.epoca }), partes);
}

/** Un formato con huecos planos «{parte}» relleno con sus partes; sin formato, las partes seguidas. */
function plano_(formato, partes) {
  if (typeof formato !== 'string') return Object.values(partes).filter((v) => v !== undefined && v !== null && v !== '').join(' ');
  return formato.replace(/\{([^{}]+)\}/g, (_, k) => (partes[k] === undefined || partes[k] === null ? '' : String(partes[k])));
}

/** Los nombres de las plantillas de cerrado de la época (epoch.9.0.1: «all announced movements happened»). */
const cerradosDe = (epoca) => hojas(en(raizDe(epoca), SITIO.cerrados)).filter(Array.isArray).map((c) => texto(hoja(c[0]))).filter(Boolean);

/** Los nombres de las plantillas de transacción de la época (epoch.9.6), con su id. */
const accionesDe = (epoca) => (Array.isArray(epoca?.transacciones) ? epoca.transacciones : []).map((x) => ({ id: x.id, nombre: texto(hoja(x.plantilla?.[0])) })).filter((x) => x.nombre);

/** El texto del 0 de un registro del eje (su primera representación de texto), o null. */
function ceroDe(eje, id, opciones) {
  if (!eje?.obtener?.(id)) return null;
  return representaciones(eje, id, opciones).find((r) => typeof r.texto === 'string')?.texto ?? null;
}

/** El id del alta de una identidad, o null. */
const altaDe = (eje, identidad) => eje?.alta?.(identidad)?.id ?? null;

/** Una fecha legible en el idioma: un instante (con su hora, en UTC) o un día «AAAA-MM-DD»; null si no lo es. */
function fechaLegible(v, idioma) {
  const dia = RE_DIA.test(v);
  const ms = dia ? Date.UTC(Number(v.slice(0, 4)), Number(v.slice(5, 7)) - 1, Number(v.slice(8, 10))) : msUTC(v);
  if (!Number.isFinite(ms)) return null;
  try {
    return new Intl.DateTimeFormat(idioma || 'en', dia ? { dateStyle: 'medium', timeZone: 'UTC' } : { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(ms));
  } catch {
    return v.replace('T', ' ').replace(/Z$/, '');
  }
}

/**
 * Un valor de una posición o de un parámetro, legible: { texto, partes }. `tipo` es el de la plantilla (las hojas de su
 * d.1: number, ref, identity, instant, level, o la décupla; lo demás, texto) y orienta la lectura; lo que el valor es se
 * reconoce también por su forma (una referencia, un id, una clave de serie, un instante, una décupla). Lo que decide
 * cómo se dice viene de la época: los formatos «legible <qué>» de epoch.9.4 en el idioma, las escalas de T de
 * epoch.1.3, los nombres de las plantillas («template <nombre>») y de los niveles («level <nombre>»); lo que alcanza
 * una referencia o una identidad, de su 0 en el eje. Una lista se lee ocupante a ocupante; una décupla, por su 0 y,
 * sin él, «registro de N posiciones»; un precio [[en qué], [cuánto]], «cuánto en qué por unidad».
 */
export function legible(eje, valor, tipo, { idioma = 'en', ...opciones } = {}) {
  const epoca = epocaDe(opciones);
  const raiz = raizDe(epoca);
  const t = hojas(tipo).find((x) => typeof x === 'string');
  const o = { epoca, idioma };
  const F = (que, partes) => plano_(texto_(eje, CLAVE.legible(que), idioma, { epoca }), partes);
  const otro = (v, tipoDe) => legible(eje, v, tipoDe, o);
  const junta = (lista, tipoDe) => {
    const partes = lista.map((v) => otro(v, tipoDe));
    return { texto: partes.map((p) => p.texto).filter((x) => x !== '').join(SEPARADOR), partes: { lista: partes } };
  };
  if (valor === undefined || valor === null) return { texto: '', partes: { vacio: true } };
  if (typeof valor === 'number' || typeof valor === 'boolean') return { texto: String(valor), partes: { valor } };
  // Un movimiento o un asiento: { serie, cantidad }.
  if (valor && typeof valor === 'object' && !Array.isArray(valor) && !esReferencia(valor) && typeof valor.cantidad === 'number' && typeof valor.serie === 'string') {
    const serie = otro(valor.serie);
    return { texto: F('amount', { amount: valor.cantidad, series: serie.texto }), partes: { cantidad: valor.cantidad, serie: serie.partes } };
  }
  if (esReferencia(valor)) {
    const X = eje?.obtener?.(valor.ref) ? valor.ref : null;
    const cero = X ? ceroDe(eje, X, { epoca }) : null;
    const dir = valor.dir && valor.dir !== RAIZ ? valor.dir : null;
    const posicion = dir ? etiqueta(eje, X ?? valor.ref, dir, o) ?? indicesDe(dir).join('.') : null;
    // El 0 de un registro va tal cual (es su representación), salvo que sea una fecha: esa se lee legible.
    const base = cero === null ? String(valor.ref).slice(0, 8) : (esInstante(cero) || RE_DIA.test(cero) ? fechaLegible(cero, idioma) : null) ?? cero;
    return { texto: posicion ? base + SEPARADOR + posicion : base, partes: { ref: valor.ref, dir: dir ?? null, X, representacion: cero, posicion } };
  }
  if (Array.isArray(valor)) {
    const esPrecio = (v) => Array.isArray(v) && v.length === 2 && typeof hoja(v[0]) === 'string' && typeof hoja(v[1]) === 'number' && hojas(v[0]).length === 1 && hojas(v[1]).length === 1;
    if (esPrecio(valor)) {
      const serie = otro(hoja(valor[0]));
      const cuanto = hoja(valor[1]);
      return { texto: F('price', { amount: cuanto, series: serie.texto }), partes: { precio: { enQue: hoja(valor[0]), cuanto, serie: serie.partes } } };
    }
    if (valor.length > 0 && valor.every(esPrecio)) {
      const lista = valor.map((v) => otro(v));
      return { texto: lista.map((p) => p.texto).join(SEPARADOR), partes: { precios: lista.map((p) => p.partes.precio) } };
    }
    if (esDecupla(valor)) {
      const posiciones = valor.map((v) => (v === undefined || v === null ? null : otro(v)));
      const cero = posiciones[0];
      const n = posiciones.filter(Boolean).length;
      return { texto: cero && cero.texto !== '' ? cero.texto : F('record', { n }), partes: { decupla: true, n, posiciones } };
    }
    return junta(valor, t);
  }
  if (typeof valor !== 'string') return { texto: String(valor), partes: { valor } };
  const s = valor;
  // Un instante o un día.
  if (t === TIPO.instante || esInstante(s) || RE_DIA.test(s)) {
    const f = fechaLegible(s, idioma);
    if (f !== null) return { texto: f, partes: { instante: s } };
  }
  // El id de un registro del eje (o un parámetro ref con el id).
  if (RE_ID.test(s) && eje?.obtener?.(s)) return otro({ ref: s });
  // Una clave de serie: E por su denominación (con su registro), P por su registro (y su mirada), R por su emisor, T por su escala.
  if (RE_SERIE.test(s)) {
    const p = partirClave(s);
    if (p.token === 'E' && p.emisor && p.denominacion) {
      const registro = p.registro ?? eje?.registroDe?.(s) ?? null;
      const partes = { familia: p.token, emisor: p.emisor, denominacion: p.denominacion, registro, registroTexto: registro ? ceroDe(eje, registro, { epoca }) : null };
      return { texto: F('series E', { denomination: p.denominacion, issuer: p.emisor, record: partes.registroTexto ?? '' }), partes };
    }
    if (p.token === 'P' && p.raiz) {
      const registro = ceroDe(eje, p.raiz, { epoca }) ?? p.raiz.slice(0, 8);
      const partes = { familia: p.token, registro: p.raiz, registroTexto: registro, ...(p.mirada === undefined ? {} : { mirada: p.mirada }), ...(p.origen ? { origen: p.origen } : {}) };
      return { texto: F(p.mirada === undefined ? 'series P' : 'series P view', { record: registro, view: p.mirada, origin: p.origen ?? '' }), partes };
    }
    if (p.token === 'R' && p.emisor) return { texto: F('series R', { issuer: p.emisor }), partes: { familia: p.token, emisor: p.emisor } };
    if (p.token === 'T' && p.escala) {
      const k = ESCALAS_T.indexOf(p.escala);
      const nombre = texto(hoja(hojas(en(raiz, [...SITIO.familias, 3, 1]))[k]?.[0])) ?? p.escala;
      return { texto: F('series T', { scale: nombre }), partes: { familia: p.token, escala: p.escala, nombre } };
    }
  }
  // Una identidad con alta: su nombre es el 0 de su alta.
  if (t === TIPO.identidad || eje?.identidades?.().includes(s)) {
    const alta = altaDe(eje, s);
    return { texto: (alta ? ceroDe(eje, alta, { epoca }) : null) ?? s, partes: { identidad: s, alta } };
  }
  // Un nivel de madurez, el nombre de una acción del aro o el de una plantilla de datos (el 5 de un registro): su traducción.
  if (t === TIPO.nivel) return { texto: texto_(eje, CLAVE.nivel(s), idioma, { original: s, epoca }), partes: { nivel: s } };
  const accion = accionesDe(epoca).find((a) => a.nombre === s);
  if (accion) return { texto: texto_(eje, CLAVE.plantilla(s), idioma, { original: s, epoca }), partes: { accion: s, id: accion.id } };
  if (plantillas(eje, { epoca }).some((p) => p.nombre === s)) return { texto: texto_(eje, CLAVE.plantilla(s), idioma, { original: s, epoca }), partes: { plantilla: s } };
  // El nombre de una plantilla de cerrado (el criterio por defecto de un registro): también su traducción.
  if (cerradosDe(epoca).includes(s)) return { texto: texto_(eje, CLAVE.plantilla(s), idioma, { original: s, epoca }), partes: { cerrado: s } };
  return { texto: s, partes: { valor: s } };
}

/** ¿Es un tipo que desdeLegible sabe leer de un texto? Los tipos genéricos de la época (epoch.9.2.0.1: texto, número, identidad, referencia, instante, nivel); lo demás (una décupla) se edita en BTML. */
export function esTipoSimple(tipo, opciones = {}) {
  const raiz = raizDe(epocaDe(opciones));
  const t = hojas(tipo).find((x) => typeof x === 'string');
  return t === undefined || hojas(en(raiz, [...SITIO.plantillas, 0, 1])).includes(t);
}

/**
 * La inversa mínima de legible para editar: de un texto escrito por una persona al valor de un tipo simple. Un número
 * (con coma o punto decimal); un instante (ISO estricto, un día «AAAA-MM-DD», o «AAAA-MM-DDTHH:MM» como lo da un
 * input, completados en UTC); una identidad por su id o por el 0 de su alta, entre las del eje; una referencia por su
 * id o por el 0 de un registro del eje; un nivel o el nombre de una acción por su traducción; lo demás, el texto tal
 * cual. Vacío, { valor: undefined }. → { valor } o { motivo } (en el idioma: los formatos «legible …» de epoch.9.4).
 */
export function desdeLegible(textoDado, tipo, { eje, idioma = 'en', ...opciones } = {}) {
  const epoca = epocaDe(opciones);
  const t = hojas(tipo).find((x) => typeof x === 'string');
  const s = String(textoDado ?? '').trim();
  const motivo = (que) => ({ motivo: plano_(texto_(eje, CLAVE.legible(que), idioma, { epoca }), { text: s }) });
  if (s === '') return { valor: undefined };
  if (t === TIPO.numero) {
    if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(s)) return motivo('not a number');
    return { valor: Number(s.replace(',', '.')) };
  }
  if (t === TIPO.instante) {
    if (esInstante(s)) return { valor: s };
    if (RE_DIA.test(s) && esInstante(s + 'T00:00:00Z')) return { valor: s + 'T00:00:00Z' };
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) && esInstante(s + ':00Z')) return { valor: s + ':00Z' };
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s) && esInstante(s + 'Z')) return { valor: s + 'Z' };
    return motivo('not an instant');
  }
  if (t === TIPO.identidad) {
    const conocidas = eje?.identidades?.() ?? [];
    if (conocidas.includes(s)) return { valor: s };
    const porNombre = conocidas.find((id) => altaDe(eje, id) && ceroDe(eje, altaDe(eje, id), { epoca }) === s);
    return porNombre ? { valor: porNombre } : motivo('unknown identity');
  }
  if (t === TIPO.referencia) {
    if (RE_ID.test(s) && eje?.obtener?.(s)) return { valor: s };
    const porNombre = (eje?.orden ?? []).find((id) => ceroDe(eje, id, { epoca }) === s);
    return porNombre ? { valor: porNombre } : motivo('unknown record');
  }
  if (t === TIPO.nivel) {
    const canonico = niveles({ epoca }).find((n) => texto_(eje, CLAVE.nivel(n), idioma, { original: n, epoca }) === s);
    return { valor: canonico ?? s };
  }
  const nombres = [...accionesDe(epoca).map((a) => a.nombre), ...plantillas(eje, { epoca }).map((p) => p.nombre), ...cerradosDe(epoca)];
  const canonico = nombres.find((n) => texto_(eje, CLAVE.plantilla(n), idioma, { original: n, epoca }) === s);
  return { valor: canonico ?? s };
}

// ---------- 9. las opciones de una posición (issue #5: «desplegables en todas partes») ----------

/** La posición donde un registro nombra su plantilla (B4: el 5 es el tipo; es la que lee plantilla()). */
const POSICION_DEL_TIPO = 5;
/** Dónde pone la época los modelos de visualización (epoch.9.7: 0 la cabecera, con la dirección de la preferencia que nombra el modelo en 0.5; 1… las referencias a los modelos). */
const SITIO_MODELOS = [9, 7];
/** Cuántos valores, como mucho, da un rango de enteros de una validación («=it >= 0 and it <= 9»: los dígitos). */
const MAXIMO_RANGO = ARIDAD;

/** Los enteros que admite una validación de la forma «=it >= a and it <= b» (a ≤ b, como mucho diez), o null. */
function rangoDeValidacion(formula) {
  const m = typeof formula === 'string' ? /^=\s*it\s*>=\s*(-?\d+)\s+and\s+it\s*<=\s*(-?\d+)\s*$/.exec(formula) : null;
  if (!m) return null;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return b >= a && b - a < MAXIMO_RANGO ? Array.from({ length: b - a + 1 }, (_, k) => a + k) : null;
}

/** Los idiomas de la época (epoch.9.4) con su nombre: [{ valor: código, texto: nombre }]; el canónico, por su código. */
function idiomasConNombre(opciones) {
  const registros = hojas(en(raizDe(epocaDe(opciones)), SITIO.mensajes)).slice(1).filter(Array.isArray);
  return idiomas(opciones).map((codigo) => {
    const nombre = texto(hojas(registros.find((r) => hojas(r[0]).includes(codigo))?.[0])[1]);
    return { valor: codigo, texto: nombre ?? codigo };
  });
}

/** Los nombres de los modelos de la época (epoch.9.7.1…, cada uno por el 0.0 de su registro), en su orden. */
function nombresDeModelos(opciones) {
  const epoca = epocaDe(opciones);
  return hojas(en(raizDe(epoca), SITIO_MODELOS)).slice(1).filter(esReferencia)
    .map((r) => texto(hoja(hoja(epoca.registros?.get?.(r.ref)?.[0])))).filter(Boolean);
}

/** La dirección (diez dígitos) de la preferencia que nombra el modelo: la cabecera de los modelos (epoch.9.7.0.5), o null. */
function direccionDelModelo(opciones) {
  const d = texto(hoja(en(raizDe(epocaDe(opciones)), [...SITIO_MODELOS, 0, 5])));
  return d && /^[0-9]{10}$/.test(d) ? d : null;
}

/** Los registros hermanos de X: los anclados en su mismo padre con su misma plantilla (sin plantilla, en su misma posición), sin X. */
function hermanosDe(eje, ev, opciones) {
  if (typeof ev.sobre !== 'string' || !eje?.obtener?.(ev.sobre)) return [];
  const p = plantilla(eje, ev, opciones);
  return eje.sobre(ev.sobre).filter((h) => h.id !== ev.id && (p ? plantilla(eje, h, opciones) === p : h.en === ev.en));
}

/**
 * Las opciones de una posición: lo que se puede escribir en la posición `pv` de X (un dígito o un camino «1.2»), sacado
 * de los datos y nunca de una lista escrita aquí. En este orden, la primera fuente que da algo:
 *   (a) si la posición nombra la plantilla (el 5: B4), las plantillas que hay (epoch.9.2, epoch.9.3 y las del eje); si su
 *       tipo (contrato.tipo) es `ref` y nombra una plantilla, los registros del eje de esa plantilla; si es `identity`,
 *       las identidades del eje; cada uno con su legible;
 *   (b) si es una enumeración de la época: la que escribe su validación («="a" in it… or "b" in it…», como el pintado;
 *       un rango pequeño de enteros, «=it >= 0 and it <= 9», como los dígitos), los niveles si su tipo es `level`
 *       (epoch.8.4), los idiomas de los mensajes si es la preferencia del idioma (epoch.9.4: la que tiene por defecto uno
 *       de ellos), los modelos si es la
 *       preferencia que nombra la cabecera de los modelos (epoch.9.7.0.5) o, en un parámetro de una acción, la lista de
 *       la que su defecto «=first …» toma el primero;
 *   (c) si no, los ocupantes ya escritos en esa posición en los registros hermanos (mismo padre, misma plantilla): lo
 *       propio de su payload y lo anclado ahí (por su legible), sin repetir.
 * `parametro` (un parámetro de acciones.parametros, con `en`: la dirección donde anclará el registro que escribe la
 * acción) pide las de ese parámetro de una acción sobre X: su tipo, su validación y sus defectos son los del parámetro,
 * y sus hermanos, los registros ya anclados donde anclará. Lo que no tiene lista da [] (también un tipo que no es simple, una
 * décupla, que se edita en BTML): la carta pinta un input libre.
 * → [{ valor, texto }]
 */
export function opciones(eje, X, pv, { yo, idioma, parametro, ...resto } = {}) {
  const ev = eventoDe(eje, X);
  if (!ev) return [];
  const epoca = epocaDe(resto);
  const o = { ...resto, epoca };
  const leer = (v, tipoDe) => legible(eje, v, tipoDe, { ...o, idioma }).texto;
  const raiz = raizDe(epoca);
  const id = typeof ev.id === 'string' && eje?.obtener?.(ev.id) ? ev.id : null;
  // Lo que se sabe de la posición: de la plantilla de X o del parámetro.
  let tipoDato;
  let formula;
  let defectos = [];
  let camino;
  let hermanos;
  let esTipo = false;
  let preferencia = null;
  if (parametro) {
    tipoDato = hojas(parametro.tipo);
    formula = parametro.validacion ?? null;
    defectos = hojas(parametro.defectos);
    camino = parametro.posicion && parametro.posicion !== '-' ? caminoDe(parametro.posicion) : null;
    hermanos = id && typeof parametro.en === 'string' ? eje.sobre(id, parametro.en) : [];
  } else {
    camino = caminoDe(pv);
    const p = plantilla(eje, ev, o);
    const desc = descripcion(p, camino);
    tipoDato = tipo(eje, ev, camino, o);
    formula = texto(ultima(desc?.[2])) ?? null;
    hermanos = hermanosDe(eje, ev, o);
    esTipo = camino.length === 1 && camino[0] === POSICION_DEL_TIPO;
    if (p && p === en(raiz, SITIO.preferencias)) preferencia = { defecto: hojas(desc?.[9]).slice(0, -1), direccion: direccion([...SITIO.preferencias, ...camino]) };
  }
  const t0 = tipoDato.find((x) => typeof x === 'string');
  const unicas = (lista) => {
    const vistos = new Set();
    // Un valor es un terminal (una hoja o una referencia); una fórmula «=…» no es un valor que se elija.
    const clave = (v) => JSON.stringify(v);
    return lista.filter((x) => x && esTerminal(x.valor) && !(typeof x.valor === 'string' && x.valor.startsWith('=')) && x.texto !== '' && !vistos.has(clave(x.valor)) && vistos.add(clave(x.valor)));
  };
  // (a) referencias: las plantillas (el 5), los registros de una plantilla, las identidades.
  if (esTipo) {
    return unicas(plantillas(eje, o).map((p) => ({ valor: p.nombre, texto: texto_(eje, CLAVE.plantilla(p.nombre), idioma, { original: p.nombre, epoca }) })));
  }
  if (t0 === TIPO.referencia) {
    const nombrada = plantillas(eje, o).find((p) => p.nombre !== t0 && tipoDato.includes(p.nombre));
    if (nombrada) return unicas((eje?.orden ?? []).filter((r) => plantilla(eje, r, o) === nombrada.registro).map((r) => ({ valor: r, texto: leer({ ref: r }) })));
  }
  if (t0 === TIPO.identidad) {
    const ids = eje?.identidades?.() ?? [];
    if (ids.length) return unicas(ids.map((i) => ({ valor: i, texto: leer(i, [TIPO.identidad]) })));
  }
  // Lo que no es de un tipo simple (una décupla) se edita en BTML: sin lista.
  if (!esTipoSimple(tipoDato, o)) return [];
  // (b) las enumeraciones de la época.
  const enumerada = valoresDeValidacion(formula) ?? rangoDeValidacion(formula);
  if (enumerada) return unicas(enumerada.map((v) => ({ valor: v, texto: leer(v, tipoDato) })));
  if (t0 === TIPO.nivel) return unicas(niveles({ epoca }).map((n) => ({ valor: n, texto: texto_(eje, CLAVE.nivel(n), idioma, { original: n, epoca }) })));
  // La época no enlaza la preferencia del idioma con epoch.9.4 (solo lo dice su ayuda): es la que tiene por defecto un idioma de los mensajes.
  if (preferencia?.defecto.length === 1 && idiomas(o).includes(preferencia.defecto[0])) return unicas(idiomasConNombre(o));
  if (preferencia && preferencia.direccion === direccionDelModelo(o)) return unicas(nombresDeModelos(o).map((n) => ({ valor: n, texto: n })));
  for (const d of defectos) {
    const m = typeof d === 'string' ? /^=\s*first\s+(.+)$/.exec(d) : null;
    if (!m || !id) continue;
    const ctx = new ContextoEje(eje, { epoch: epoca, me: yo });
    const lista = (vale(m[1], ctx, { sujeto: id }) ?? []).map((x) => plano(x, ctx)).filter(esTerminal);
    if (lista.length) return unicas(lista.map((v) => ({ valor: v, texto: leer(v, tipoDato) })));
  }
  // (c) lo ya escrito en esa posición en los hermanos: lo propio de su payload y lo anclado ahí (por su legible).
  if (!camino) return [];
  const escritos = [];
  for (const h of hermanos) {
    for (const x of ocupantesDe(eje, h.id, camino, { orden: 'llegada', exacto: true })) {
      if (x.tipo === 'propio' && esTerminal(x.contenido)) escritos.push({ valor: x.contenido, texto: leer(x.contenido, tipoDato) });
      else if (x.tipo === 'escrito') {
        const cero = leer({ ref: x.evento });
        if (cero) escritos.push({ valor: cero, texto: cero });
      }
    }
  }
  return unicas(escritos);
}
