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
//   division(eje, ruta, { datos, forma })  qué puntos de vista caben y cómo se disponen (epoch.8.3)
//   madurez(eje, X)                        el nivel de X (la lectura «maturity», X.8.1) y su medida (X.8.6)
//   diario(eje, X, desde, cuantos)         las transacciones del subárbol de X por llegada, con sus asientos
//   yo(eje, identidad)                     mi alta y sus posiciones: cartera, criterio, atención, tiempo
//   configuracion(eje, yo)                 mis preferencias (el registro en el 9 de mi alta) o los defectos de la plantilla
//   mensaje(eje, regla, idioma, { ev })    el 9 de una regla en un idioma (epoch.9.4), con los huecos resueltos
//
// Solo lee: nada de aquí escribe en el eje. Las entradas de acción (plantillas
// de transacción, transaccion(), camino, libro local) son del encargo 3c-2.

import { EPOCA_0_BTML } from './epocas.js';
import { ContextoEje } from './contexto-eje.js';
import { evaluar, rellenar, nombreDeRegla } from './bqlm.js';
import { esReferencia, esLista, esTerminal, esDecupla, indicesDe, resolver, direccion, ARIDAD } from './btml.js';
import { ocupantes as ocupantesDe } from './encaje.js';

const RE_ID = /^[0-9a-f]{64}$/;
const RAIZ = '0000000000';

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
  plantillas: [9, 2], // 0 la cabecera (0.1 el tipo genérico por dígito), 1… las plantillas de dominio
  preferencias: [9, 3], // la plantilla «preferences»
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

/** La etiqueta legible de la posición d de X: la de su plantilla (d.0) o la regla corta de la época (su nombre). */
export function etiqueta(eje, X, d, opciones = {}) {
  const camino = caminoDe(d);
  const raiz = raizDe(epocaDe(opciones));
  const desc = descripcion(plantilla(eje, X, opciones), camino);
  return texto(hoja(desc?.[0])) ?? texto(hoja(corta(raiz, camino)?.[0])) ?? null;
}

/** La ayuda de la posición d de X: la última hoja del d.9 de su plantilla, o el significado de la regla corta. */
export function ayuda(eje, X, d, opciones = {}) {
  const camino = caminoDe(d);
  const raiz = raizDe(epocaDe(opciones));
  const desc = descripcion(plantilla(eje, X, opciones), camino);
  return texto(ultima(desc?.[9])) ?? texto(hoja(corta(raiz, camino)?.[1])) ?? null;
}

/** El marcador (placeholder, lo que se espera) de la posición d de X: las hojas del d.9 de la plantilla menos la ayuda; si calla, el ejemplo de la regla corta. */
export function marcador(eje, X, d, opciones = {}) {
  const camino = caminoDe(d);
  const raiz = raizDe(epocaDe(opciones));
  const desc = descripcion(plantilla(eje, X, opciones), camino);
  const nueve = hojas(desc?.[9]);
  if (nueve.length > 1) return nueve.slice(0, -1);
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
 * la posición, en inglés) o, si la fórmula no se resuelve, su estado. Vacía si todo pasa o X no tiene plantilla.
 */
export function validar(eje, X, opciones = {}) {
  const ev = eventoDe(eje, X);
  const p = ev ? plantilla(eje, ev, opciones) : null;
  if (!p) return [];
  const epoca = epocaDe(opciones);
  const ctx = contextoDe(eje, epoca, ev);
  const sujeto = sujetoDe(ctx, eje, ev);
  const fuera = [];
  for (let d = 0; d < ARIDAD; d++) {
    const desc = descripcion(p, [d]);
    const formula = texto(ultima(desc?.[2]));
    if (!formula || !formula.startsWith('=') || formula.startsWith('==')) continue;
    const r = evaluar(formula, ctx, { sujeto });
    const nombre = texto(hoja(desc[0])) ?? String(d);
    if (r.estado !== 'RESUELTO') fuera.push({ posicion: d, motivo: nombre + ': ' + r.estado + ': ' + r.motivo });
    else if (!(r.valor.length === 1 && r.valor[0] === true)) fuera.push({ posicion: d, motivo: nombre + ': ' + (texto(ultima(desc[9])) ?? 'does not satisfy ' + formula) });
  }
  return fuera;
}

// ---------- 2. representaciones ----------

/** Los tamaños de la época (epoch.9.5.2): [{ tamano, nombre, datos }], por tamaño. */
export function tamanos(opciones = {}) {
  const raiz = raizDe(epocaDe(opciones));
  return hojas(en(raiz, [...SITIO.representacion, 2])).filter(Array.isArray).map((t) => ({ tamano: hoja(t[0]), nombre: hoja(t[1]), datos: hoja(t[2]) })).sort((a, b) => a.tamano - b.tamano);
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
    const [tamano, formato] = hojas(dec[1]);
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

/** El nombre del orden que rige una posición de X: el d.8 de su plantilla, lo que el dueño nombra en el 2.3 de X, o el primero de la época. */
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
  return conocidos.find((o) => o.nombre === elegido) ?? conocidos[0];
}

/**
 * Los ocupantes de la posición `d` de X, tal cual (hojas, décuplas o referencias por su id; un registro anclado, la
 * referencia a su id), en el orden que dice la época y paginados: { total, desde, cuantos, orden, ocupantes }. La carta
 * nunca ordena ni filtra: el orden es el del d.8 de la plantilla de X, el que el dueño nombra en el 2.3 de X o, por
 * defecto, el primero de epoch.8.5 (por llegada). `cuantos` por defecto es el paso de la época.
 */
export function ocupantes(eje, X, d, desde = 0, cuantos, opciones = {}) {
  const ev = eventoDe(eje, X);
  if (!ev) return { total: 0, desde: 0, cuantos: 0, orden: null, ocupantes: [] };
  const camino = caminoDe(d);
  const orden = ordenDe(eje, ev, camino, opciones);
  const [mecanismo, ...marcas] = orden?.mecanismo ?? [];
  let lista;
  if (typeof ev.id === 'string' && eje?.obtener(ev.id)) {
    lista = ocupantesDe(eje, ev.id, camino, { orden: mecanismo, exacto: true })
      .filter((o) => o.tipo !== 'referencia')
      .map((o) => (o.tipo === 'escrito' ? { ref: o.evento } : o.contenido));
  } else {
    // Una candidata que aún no está en el eje: solo lo propio de su payload.
    const nodo = camino.reduce((n, k) => (Array.isArray(n) && !(n !== ev.payload && esLista(n)) ? n[k] : undefined), ev.payload);
    lista = nodo === undefined ? [] : esLista(nodo) ? [...nodo] : [nodo];
  }
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

// ---------- 5. la madurez ----------

/** Los niveles genéricos de la época (epoch.8.4): los de posición y los de orden de magnitud, en orden. */
export function niveles(opciones = {}) {
  const raiz = raizDe(epocaDe(opciones));
  return [...hojas(en(raiz, [...SITIO.madurez, 2])), ...hojas(en(raiz, [...SITIO.madurez, 4]))];
}

/**
 * La madurez de X: la lectura «maturity» de la época (X.8.1), su medida (X.8.6: posiciones escritas del subárbol,
 * profundidad y cantidad que mueve) y el nombre del nivel: entre los de su plantilla (su 8.8), repartidos
 * proporcionalmente sobre los genéricos, o entre los genéricos de epoch.8.4. → { nivel, de, nombre, medida }.
 */
export function madurez(eje, X, opciones = {}) {
  const ev = eventoDe(eje, X);
  if (!ev) return null;
  const epoca = epocaDe(opciones);
  const ctx = contextoDe(eje, epoca, ev);
  const s = expresion(sujetoDe(ctx, eje, ev));
  const nivelGenerico = uno('first ' + s + '.8.1', ctx);
  const medida = { posiciones: uno(s + '.8.6.1', ctx), profundidad: uno(s + '.8.6.5', ctx), cantidad: uno(s + '.8.6.4', ctx) };
  if (typeof nivelGenerico !== 'number') return { nivel: null, de: null, nombre: null, medida };
  const genericos = niveles(opciones);
  const propios = hojas(descripcion(plantilla(eje, ev, opciones), [8])?.[8]).filter((x) => typeof x === 'string');
  const escala = propios.length ? propios : genericos;
  const nivel = propios.length ? Math.max(1, Math.ceil(nivelGenerico * propios.length / genericos.length)) : nivelGenerico;
  const de = escala.length;
  return { nivel: Math.min(nivel, de), de, nombre: escala[Math.min(nivel, de) - 1] ?? null, medida };
}

// ---------- 6. el diario ----------

/**
 * El diario del subárbol de X: sus transacciones (X y lo anclado bajo él, a cualquier profundidad) por llegada, cada
 * una con sus asientos del libro (lo que de verdad se movió: movimientos, asignación y obtención) y su ancla.
 * Paginado desde un índice o desde un id: { total, desde, entradas: [{ id, t, autor, movimientos, ancla }] }.
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
  const ids = eje.orden.filter((id) => vistos.has(id));
  const inicio = typeof desde === 'string' ? Math.max(0, ids.indexOf(desde)) : Math.max(0, desde);
  const n = cuantos ?? paso(opciones);
  const asientosDe = (e) => (e.sobre ? eje.libro.asientos({ registro: e.sobre }) : eje.libro.asientos()).filter((a) => a.tx?.id === e.id)
    .map(({ primitiva, serie, de, a, cantidad, salida, clase, etiqueta }) => ({ primitiva, serie, de, a, cantidad, ...(salida !== undefined && salida !== null ? { salida } : {}), ...(clase ? { clase } : {}), ...(etiqueta !== undefined && etiqueta !== null ? { etiqueta } : {}) }));
  const entradas = ids.slice(inicio, inicio + n).map((id) => {
    const e = eje.obtener(id);
    return { id, t: e.t, autor: e.autor, movimientos: asientosDe(e), ancla: { sobre: e.sobre ?? null, en: e.en ?? RAIZ } };
  });
  return { total: ids.length, desde: inicio, entradas };
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
    posicionado.push({ registro: uno(e + '.0', ctx), cuanto: uno(e + '.1', ctx), disponible: uno(e + '.4', ctx), origenes: planos(e + '.6', ctx) });
  }
  const atencion = [];
  for (let k = 0; k < cuenta(A + '.3'); k++) {
    const e = '(nth ' + k + ' ' + A + '.3)';
    atencion.push({ nombre: uno(e + '.0', ctx) ?? null, zona: uno(e + '.1', ctx), precio: { enQue: uno('(last ' + e + '.2).0', ctx), cuanto: uno('(last ' + e + '.2).1', ctx) }, quienes: planos(e + '.3', ctx) });
  }
  const escalas = hojas(en(raiz, [...SITIO.familias, 3, 1])).filter(Array.isArray).map((x) => hoja(x[0]));
  const tiempo = {};
  escalas.forEach((nombre, k) => {
    const v = uno(A + '.7.' + k, ctx);
    if (typeof v === 'number') tiempo[nombre] = v;
  });
  return { identidad, alta: alta.id, cartera, criterio: { posicionado, adopta: planos(A + '.2.3', ctx) }, atencion, tiempo };
}

/**
 * Mi configuración: el registro anclado en el 9 de mi alta por mí cuyo tipo es la plantilla «preferences» de la época
 * (el último), leído con las etiquetas de la plantilla como claves; sin registro, los defectos de la plantilla (las
 * hojas de cada d.9 menos la ayuda). `yo` es la identidad o lo que devuelve yo(). → { <etiqueta>: valor, …, de: id | null }.
 */
export function configuracion(eje, quien, opciones = {}) {
  const identidad = typeof quien === 'string' ? quien : quien?.identidad;
  const raiz = raizDe(epocaDe(opciones));
  const p = en(raiz, SITIO.preferencias);
  if (!esPlantilla(p)) return { de: null };
  const valores = {};
  for (let d = 1; d < ARIDAD; d++) {
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
      const desc = descripcion(p, [d]);
      const nombre = texto(hoja(desc?.[0]));
      const v = hojas(registro.payload[d]).filter((x) => esTerminal(x));
      if (nombre && v.length) valores[nombre] = v.length === 1 ? v[0] : v;
    }
  }
  return { ...valores, de: registro?.id ?? null };
}

// ---------- 8. mensajes y traducción ----------

/** Los idiomas con mensajes en la época (epoch.9.4): sus códigos, con el canónico (en) delante. */
export function idiomas(opciones = {}) {
  const raiz = raizDe(epocaDe(opciones));
  const registros = hojas(en(raiz, SITIO.mensajes)).slice(1).filter(Array.isArray);
  return ['en', ...registros.map((r) => texto(hoja(r[0]))).filter(Boolean)];
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
