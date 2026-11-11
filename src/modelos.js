// Los modelos de visualización (encargo 3c-2b, tras 3c-1). Principio (VG): nada hardcodeado en la pantalla; los
// modelos de visualización son REGISTROS; cualquier modelo puede estar incompleto y se rellena por partes; la carta
// pregunta por una pieza (un tipo, un mundo, un paso o una acción, una orientación) y la cadena de modelos responde
// en orden: el arte propio del elemento (las piezas ancladas al registro: #25, el registro es su propio modelo
// parcial), el que nombra la configuración de quien mira, luego el general de la época, el animado genérico y el
// sobrio, que no tiene recursos (solo formas) y siempre responde. Documentación: docs/CONTRATO.md, «Modelos de visualización».
//
//   modelo(eje, yo, { elemento })                    la cadena de modelos a consultar, en orden (con `elemento`, su arte propio delante)
//   propio(eje, X)                                   el arte propio de un registro como modelo parcial (null si no lleva)
//   pieza(modelos, tipo, pv, clave, variante, { tamano, rol, de })   la primera pieza que exista en la cadena (nunca null si el sobrio está)
//   corresponde(cabecera, tipo, dado, pv)            la clave de pieza que corresponde a lo que da el núcleo (epoch.9.7.0.4.n.2)
//   rolPorDefecto(cabecera, tipo, pv)                la segunda componente de la clave por defecto en un mundo (el rol del muñequito)
//   modelosDeLaEpoca()                               los modelos que referencia epoch.9.7, con sus piezas leídas
//   piezasDeModelo(registro, { eje, id })            las piezas de un modelo (las referencias de sus posiciones y, en el eje, lo anclado)
//   leerPieza(registro, { pv })                      una pieza como objeto plano
//   validarModelo(modelo)                            lo animado sin bucle o sin fotogramas, los tamaños que la época no tiene
//   cabecera()                                       lo que la época dice de los modelos (epoch.9.7.0)
//
// Dónde mira la época (lo único que este módulo sabe): epoch.9.7 son los modelos, 9.7.0 su cabecera y 9.7.1… las
// referencias a los registros de los modelos (datos/epocas/modelos/); epoch.9.5.1 los formatos de las
// representaciones. Un modelo es una décupla: 0 nombre, nivel de detalle y nota; 1-4 y 6-9 las piezas del mundo de
// cada punto de vista, como lista de referencias { ref } a registros de pieza (en el eje, también las piezas ancladas
// en esa posición); 5 los marcos y los iconos del aro. Una pieza es una décupla: 0 tipo; 1 [tamaño mínimo, formato]
// o, sin recurso, [tamaño mínimo, forma sobria]; 2 su clave: la condición (el paso 1-10, la acción, la primitiva o
// efecto, o el mundo del que es icono o marco; «*» = cualquiera) y, detrás, lo que distingue piezas con la misma
// condición (el rol del muñequito, el nombre del elemento, del marco o del icono: etapa 5, la fase 2); 3 su
// orientación; 4 [repetición, fotogramas]; 5 los mundos en que sirve; 6 su recurso (una ruta relativa del repositorio
// o una URL) y su procedencia; 7 su rango entre las piezas de la misma clave (0 o nada la primera; 1 la que queda de
// respaldo detrás de una nueva). Los nombres de los tipos, de las claves, de las orientaciones, de los niveles y de
// las palabras de repetición son datos de la cabecera: aquí no hay ninguno.

import { EPOCA_0_BTML } from './epocas.js';
import { esReferencia, esLista, esTerminal, direccion, resolver } from './btml.js';
import { configuracion } from './contrato.js';

const RE_ID = /^[0-9a-f]{64}$/;
/**
 * La referencia a un archivo adjunto (encargo «pv0», #22): «archivo:<sha256>», el hash del contenido en minúsculas. El
 * archivo vive fuera del eje (la función `archivos`); la carta resuelve la referencia a su URL con la clave que tiene.
 */
export const RE_ARCHIVO = /^archivo:[0-9a-f]{64}$/;
/** La clave comodín de una pieza: sirve para cualquier paso, acción, primitiva o punto de vista (como el «*» del 5 de una regla). */
export const CUALQUIERA = '*';

/** Dónde pone la época cada cosa. */
const SITIO = Object.freeze({
  modelos: [9, 7], // 0 la cabecera, 1… las referencias a los modelos
  representacion: [9, 5], // 1 los formatos
});
/** Las posiciones de la cabecera (epoch.9.7.0). */
const CABECERA = Object.freeze({ niveles: 1, cadena: 2, variantes: 3, tipos: 4, preferencia: 5, animados: 6, repeticion: 7, multiplo: 8, nota: 9 });
/** Los formatos que una pieza del eje no puede traer (SEG-14): ejecutan código de quien la escribió. Las de la época y las del repositorio, sí. */
const FORMATOS_VEDADOS_EN_EL_EJE = Object.freeze(['html']);
/** Dónde puede estar el recurso de una pieza del eje si es una ruta relativa del repositorio (SEG-14). */
const CARPETA_DE_ARTE = 'arte/';
/** Las posiciones de una pieza. */
const PIEZA = Object.freeze({ tipo: 0, medida: 1, clave: 2, variante: 3, tiempo: 4, mundos: 5, recurso: 6, rango: 7 });
/** Las posiciones de un tipo de pieza en la cabecera (epoch.9.7.0.4.n): el tipo, los nombres de su clave, la correspondencia. */
const TIPO = Object.freeze({ tipo: 0, claves: 1, correspondencia: 2 });

const epocaDe = (opciones) => opciones?.epoca ?? EPOCA_0_BTML;
const raizDe = (epoca) => (Array.isArray(epoca) ? epoca : epoca.registro ?? epoca.payload);
const en = (raiz, camino) => camino.reduce((n, d) => (Array.isArray(n) ? n[d] : undefined), raiz);
const hoja = (x) => (Array.isArray(x) ? x[0] : x);
const hojas = (x) => (x === undefined || x === null ? [] : Array.isArray(x) ? x : [x]);
const texto = (x) => (typeof x === 'string' ? x : typeof x === 'number' ? String(x) : undefined);

/**
 * La lista blanca de orígenes de donde una pieza del eje puede traer su recurso (SEG-14): en el 9 de la cabecera, detrás
 * de la nota, una lista de orígenes («https://host», sin ruta). Se normalizan con URL; lo que no es un origen http(s) se ignora.
 */
function origenesDe(posicion) {
  const fuera = [];
  for (const lista of hojas(posicion).filter(Array.isArray)) {
    for (const o of lista) {
      if (typeof o !== 'string') continue;
      try {
        const u = new URL(o);
        if ((u.protocol === 'https:' || u.protocol === 'http:') && u.origin === o.replace(/\/+$/, '')) fuera.push(u.origin);
      } catch { /* no es un origen */ }
    }
  }
  return fuera;
}

/**
 * ¿Es `recurso` aceptable en una pieza que viene del eje? Una ruta relativa dentro de `arte/` (sin «..», sin esquema, sin
 * «//», sin barras invertidas, sin porcentajes ni caracteres de control), una URL de uno de los orígenes de la lista
 * blanca de la cabecera o un archivo adjunto por su hash («archivo:<sha256>», RE_ARCHIVO). Lo demás (otro origen,
 * `data:`, `javascript:`, una ruta fuera de `arte/`) no.
 */
export function recursoAdmitido(recurso, c) {
  if (typeof recurso !== 'string' || !recurso.length) return false;
  if (RE_ARCHIVO.test(recurso)) return true; // un adjunto por su hash (#22, #25): la carta lo resuelve; nunca una ruta ni una URL
  if (/[\u0000-\u001f\u007f\\\s]/.test(recurso)) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(recurso)) {
    try {
      const u = new URL(recurso);
      return (u.protocol === 'https:' || u.protocol === 'http:') && !u.username && !u.password && (c?.origenes ?? []).includes(u.origin);
    } catch {
      return false;
    }
  }
  if (recurso.startsWith('/') || recurso.includes('//') || recurso.includes('%')) return false;
  if (!recurso.startsWith(CARPETA_DE_ARTE) || recurso.length === CARPETA_DE_ARTE.length) return false;
  return !recurso.split(/[/?#]/).some((seg) => seg === '..' || seg === '.');
}

/** ¿Admite una pieza que viene del eje? Sin formato vedado y, si trae recurso, uno acotado (recursoAdmitido). */
function piezaDelEjeAdmitida(p, c) {
  const formato = String(p.formato ?? p.forma ?? '').toLowerCase();
  if (FORMATOS_VEDADOS_EN_EL_EJE.includes(formato)) return false;
  return p.recurso === null || recursoAdmitido(p.recurso, c);
}

/**
 * Lo que la época dice de los modelos (epoch.9.7.0): los niveles de detalle, la cadena de respaldo (los nombres que
 * se consultan detrás del que nombra la configuración), las orientaciones (la primera es la de respaldo), los tipos de
 * pieza con el nombre de su clave, la dirección de la preferencia que nombra el modelo, los formatos animados (bucle y
 * fotogramas obligatorios), las palabras de repetición (la primera es bucle) y el múltiplo de los fotogramas nuevos.
 */
export function cabecera(opciones = {}) {
  const raiz = raizDe(epocaDe(opciones));
  const c = en(raiz, [...SITIO.modelos, 0]);
  const lista = (d) => hojas(c?.[d]).filter((x) => esTerminal(x));
  const repeticion = lista(CABECERA.repeticion);
  return {
    niveles: lista(CABECERA.niveles),
    cadena: lista(CABECERA.cadena),
    variantes: lista(CABECERA.variantes),
    tipos: hojas(c?.[CABECERA.tipos]).filter(Array.isArray).map((t) => {
      const claves = hojas(t[TIPO.claves]).map(texto).filter((x) => x !== undefined);
      // La correspondencia (etapa 5): filas [[lo dado], [la clave de la pieza], [mundos…]]; sin mundos, vale en todos. Una
      // fila con varias claves y tantos mundos como claves las empareja una a una (VG, 11-11, el elemento: una fila por
      // dado, que una décupla no pasa de diez filas): [[hijo], [tienda, parterre…], [1, 2…]] es tienda en el 1, parterre en el 2…
      const correspondencia = hojas(t[TIPO.correspondencia]).filter(Array.isArray).flatMap((f) => {
        const de = hoja(f[0]);
        const claves = hojas(f[1]);
        const mundos = hojas(f[2]).filter((m) => typeof m === 'number');
        if (claves.length > 1 && claves.length === mundos.length) return claves.map((a, k) => ({ de, a, mundos: [mundos[k]] }));
        return [{ de, a: claves[0], mundos }];
      }).filter((f) => f.de !== undefined && f.a !== undefined);
      return { tipo: hoja(t[TIPO.tipo]), clave: claves[0] ?? null, claves, correspondencia };
    }),
    preferencia: texto(hoja(c?.[CABECERA.preferencia])) ?? null,
    animados: lista(CABECERA.animados),
    bucle: repeticion[0] ?? null,
    fijo: repeticion[1] ?? null,
    multiplo: typeof hoja(c?.[CABECERA.multiplo]) === 'number' ? hoja(c[CABECERA.multiplo]) : null,
    origenes: origenesDe(c?.[CABECERA.nota]),
    formatos: hojas(en(raiz, [...SITIO.representacion, 1])).filter((x) => typeof x === 'string'),
  };
}

/**
 * Una pieza como objeto plano, o null si el registro no es una pieza (su 0 no es un tipo de la cabecera):
 * { tipo, pv, clave, <nombre de la clave>: clave, subclave, <nombre de la segunda clave>: subclave, variante, tamano,
 * formato | forma, bucle, fotogramas, recurso, procedencia, mundos, animado, rango, crudo }. `pv` es el mundo desde el
 * que se lee (la posición del modelo). Sin orientación, la primera de la cabecera; sin clave, la comodín; sin
 * segunda componente, null; sin tamaño mínimo, 0 (cabe en todo); sin rango, 0 (la primera opción).
 */
export function leerPieza(registro, { pv = null, cabecera: cab, ...opciones } = {}) {
  const c = cab ?? cabecera(opciones);
  if (!Array.isArray(registro)) return null;
  const tipo = texto(hoja(registro[PIEZA.tipo]));
  const t = c.tipos.find((x) => x.tipo === tipo);
  if (!t) return null;
  const [tamanoCrudo, formatoOForma] = hojas(registro[PIEZA.medida]);
  const tamano = typeof tamanoCrudo === 'number' ? tamanoCrudo : 0;
  const esFormato = typeof formatoOForma === 'string' && c.formatos.includes(formatoOForma);
  const [claveCruda, subclaveCruda] = hojas(registro[PIEZA.clave]);
  const clave = typeof claveCruda === 'number' || (typeof claveCruda === 'string' && claveCruda) ? claveCruda : CUALQUIERA;
  const subclave = texto(subclaveCruda) ?? null;
  const rangoCrudo = hoja(registro[PIEZA.rango]);
  const variante = texto(hoja(registro[PIEZA.variante])) ?? c.variantes[0] ?? null;
  const [repeticion, fotogramasCrudo] = hojas(registro[PIEZA.tiempo]);
  const tiempo = registro[PIEZA.tiempo] !== undefined;
  const fotogramas = typeof fotogramasCrudo === 'number' ? fotogramasCrudo : 1;
  const recurso = hojas(registro[PIEZA.recurso]);
  const pieza = {
    tipo,
    pv,
    clave,
    subclave,
    variante,
    tamano,
    ...(esFormato ? { formato: formatoOForma } : { forma: typeof formatoOForma === 'string' ? formatoOForma : null }),
    bucle: repeticion === c.bucle,
    fotogramas,
    recurso: recurso.length ? recurso[0] : null,
    procedencia: recurso.slice(1).filter((x) => typeof x === 'string'),
    mundos: hojas(registro[PIEZA.mundos]).filter((x) => esTerminal(x)),
    animado: esFormato && c.animados.includes(formatoOForma),
    rango: typeof rangoCrudo === 'number' && rangoCrudo > 0 ? rangoCrudo : 0,
    tiempo,
    repeticion: typeof repeticion === 'string' ? repeticion : null,
    crudo: registro,
  };
  if (t.clave && !Object.hasOwn(pieza, t.clave)) pieza[t.clave] = clave; // el nombre de la clave del tipo (paso, accion, primitiva, mundo), si no pisa un campo propio
  if (t.claves[1] && !Object.hasOwn(pieza, t.claves[1])) pieza[t.claves[1]] = subclave; // y el de la segunda (rol, nombre)
  return pieza;
}

/**
 * Quiénes pueden anclar piezas en un modelo del eje: su autor y a quien este delegue. PENDIENTE: el eje no tiene hoy
 * ningún mecanismo de delegación de escritura sobre un registro (el P delegado es de tokens, no de anclar en un
 * registro ajeno), así que solo cuenta el autor. Cuando exista, es aquí donde se suman los delegados.
 */
function autoresDelModelo(_eje, autor) {
  return typeof autor === 'string' && autor ? new Set([autor]) : new Set();
}

/**
 * Las piezas de un modelo, planas y con su mundo: lo que referencian sus posiciones 1-9 (registros de la época, o del
 * eje si se da) y, si el modelo es un registro del eje (`id`), lo anclado en cada una de esas posiciones que sea una
 * pieza Y lo haya escrito el autor del modelo (`autor`, por defecto el del registro `id`) o alguien en quien delegue
 * (pendiente: el eje no tiene delegación de escritura sobre un registro, ver autoresDelModelo); las piezas ancladas por
 * otros se ignoran sin error (quien mira adopta un modelo, no lo que le anclen). Las piezas que vienen del eje (por
 * referencia o ancladas) pasan además por piezaDelEjeAdmitida (SEG-14: recurso acotado, sin html); las de la época, no.
 * Una posición que no es una lista de referencias (una hoja: «sin piezas») no tiene piezas.
 */
export function piezasDeModelo(registro, { eje = null, id = null, autor, cabecera: cab, ...opciones } = {}) {
  const epoca = epocaDe(opciones);
  const c = cab ?? cabecera(opciones);
  const fuera = [];
  const deLaEpoca = (ref) => epoca.registros?.has(ref);
  const alcanza = (ref) => epoca.registros?.get(ref) ?? eje?.obtener(ref)?.payload ?? null;
  const autores = id && eje ? autoresDelModelo(eje, autor ?? eje.obtener(id)?.autor) : new Set();
  for (let pv = 1; pv < 10; pv++) {
    const posicion = registro?.[pv];
    const refs = Array.isArray(posicion) ? posicion.filter(esReferencia) : esReferencia(posicion) ? [posicion] : [];
    for (const r of refs) {
      const p = leerPieza(alcanza(r.ref), { pv, cabecera: c });
      if (p && (deLaEpoca(r.ref) || piezaDelEjeAdmitida(p, c))) fuera.push({ ...p, donde: r.ref });
    }
    if (autores.size) {
      for (const h of eje.sobreDe(id, direccion([pv]), autores)) {
        const p = leerPieza(h.payload, { pv, cabecera: c });
        if (p && piezaDelEjeAdmitida(p, c)) fuera.push({ ...p, donde: h.id });
      }
    }
  }
  return fuera;
}

/** Un modelo como objeto: { nombre, nivel, nota, donde, registro, piezas, cabecera }. */
function modeloDe(registro, donde, c, { eje = null, id = null, ...opciones } = {}) {
  const cero = hojas(registro?.[0]);
  return {
    nombre: texto(cero[0]) ?? null,
    nivel: texto(cero[1]) ?? null,
    nota: texto(cero[2]) ?? null,
    donde,
    registro,
    piezas: piezasDeModelo(registro, { eje, id, cabecera: c, ...opciones }),
    cabecera: c,
  };
}

/** Los modelos que referencia la época (epoch.9.7.1…), en su orden, con sus piezas: [{ nombre, nivel, nota, donde, registro, piezas, cabecera }]. */
export function modelosDeLaEpoca(opciones = {}) {
  const epoca = epocaDe(opciones);
  const raiz = raizDe(epoca);
  const c = cabecera(opciones);
  const lista = en(raiz, SITIO.modelos);
  const fuera = [];
  (Array.isArray(lista) ? lista : []).forEach((x, k) => {
    if (k === 0 || !esReferencia(x)) return;
    const registro = epoca.registros?.get(x.ref);
    if (Array.isArray(registro)) fuera.push(modeloDe(registro, x.ref, c, opciones));
  });
  return fuera;
}

/** ¿Es el payload un registro de modelo? Su 0 lleva un nombre y un nivel de detalle de la cabecera. */
function esModelo(payload, c) {
  const cero = hojas(payload?.[0]);
  return Array.isArray(payload) && typeof cero[0] === 'string' && c.niveles.includes(cero[1]);
}

/**
 * La cadena de modelos que la carta consulta, en orden (respaldo en cadena, VG): el que nombra la configuración de
 * `yo` (la preferencia cuya posición dice la cabecera: un nombre de la época o el id —{ ref } o el texto— de un registro
 * del eje que sea un modelo: por nombre solo se resuelven los de la época), luego los de la cadena de la época (epoch.9.7.0.2: el animado genérico y el sobrio), sin
 * repetir; el que no tiene recursos (el sobrio) siempre al final, aunque lo nombre la configuración. `yo` es la identidad o lo que devuelve contrato.yo(). Cada uno, { nombre, nivel, nota, donde, registro,
 * piezas, cabecera }.
 */
export function modelo(eje, yo, { elemento, ...opciones } = {}) {
  const epoca = epocaDe(opciones);
  const raiz = raizDe(epoca);
  const c = cabecera(opciones);
  const deLaEpoca = modelosDeLaEpoca(opciones);
  const conf = configuracion(eje, yo, opciones);
  const descripcion = c.preferencia ? resolver(raiz, c.preferencia) : undefined;
  const etiqueta = texto(hoja(descripcion?.[0]));
  const nombrado = etiqueta ? conf[etiqueta] : undefined;
  const nombres = [nombrado, ...c.cadena].map((x) => (esReferencia(x) ? x.ref : x)).filter((x) => typeof x === 'string' && x.length > 0);
  // Por nombre solo se resuelven los modelos de la época; uno del eje, por su id (SEG-14: un registro del eje que se
  // llame «general» no suplanta al de la época). Lo que no es ni lo uno ni lo otro se salta.
  const resolverNombre = (n) => {
    const propio = deLaEpoca.find((m) => m.nombre === n || m.donde === n);
    if (propio) return propio;
    if (!eje || !RE_ID.test(n)) return null;
    const ev = eje.obtener(n);
    return ev && esModelo(ev.payload, c) ? modeloDe(ev.payload, ev.id, c, { eje, id: ev.id, autor: ev.autor, ...opciones }) : null;
  };
  const vistos = new Set();
  const fuera = [];
  for (const n of nombres) {
    const m = resolverNombre(n);
    if (m && !vistos.has(m.donde)) {
      vistos.add(m.donde);
      fuera.push(m);
    }
  }
  // El sobrio (un modelo sin ninguna pieza con recurso: solo formas) es el respaldo por definición: siempre al final
  // de la cadena, también si la configuración lo nombra (#3: con `model: sobrio` guardado, «animado» enseña el arte).
  const cadena = [...fuera.filter(conRecursos), ...fuera.filter((m) => !conRecursos(m))];
  // Delante de todo, el arte propio del elemento que se pinta (#25), si lo lleva.
  const suyo = elemento ? propio(eje, elemento, opciones) : null;
  return suyo ? [suyo, ...cadena.filter((m) => m.donde !== suyo.donde)] : cadena;
}

/** Todos los mundos de un modelo (1-4 y 6-9): lo que vale «*» en el 5 de una pieza. */
const MUNDOS = Object.freeze([1, 2, 3, 4, 6, 7, 8, 9]);

/**
 * El arte propio de un registro X (#25, VG 11-11: «cada elemento puede llevar su icono, su imagen, su Lottie propio»):
 * X es su propio modelo parcial. Sus piezas son las de un modelo del eje (piezasDeModelo con `id`: lo que referencian
 * sus posiciones 1-9 y lo ANCLADO en ellas por el autor de X, con los filtros de SEG-14) y cada una sirve en el mundo
 * donde está y en los que dice su 5 («*», todos): un icono propio anclado una vez con «*» se ve en los ocho mundos. Su
 * recurso puede ser un adjunto («archivo:<sha256>»). → { nombre: null, nivel: null, nota: null, donde: X, registro,
 * piezas, cabecera, propio: true } o null si X no está en el eje o no lleva ninguna pieza propia.
 */
export function propio(eje, X, opciones = {}) {
  const id = esReferencia(X) ? X.ref : X;
  const ev = typeof id === 'string' ? eje?.obtener?.(id) : null;
  if (!ev || !Array.isArray(ev.payload)) return null;
  const c = cabecera(opciones);
  const piezas = [];
  for (const p of piezasDeModelo(ev.payload, { eje, id: ev.id, autor: ev.autor, cabecera: c, ...opciones })) {
    const mundos = new Set([p.pv]);
    for (const m of p.mundos) {
      if (m === CUALQUIERA) MUNDOS.forEach((x) => mundos.add(x));
      else if (typeof m === 'number' && Number.isInteger(m) && m >= 1 && m <= 9) mundos.add(m);
    }
    for (const pv of mundos) piezas.push({ ...p, pv });
  }
  if (!piezas.length) return null;
  return { nombre: null, nivel: null, nota: null, donde: ev.id, registro: ev.payload, piezas, cabecera: c, propio: true };
}

/** ¿Trae el modelo alguna pieza con recurso? El que no (el sobrio) es el respaldo de forma: va al final de la cadena. */
export const conRecursos = (m) => Boolean(m?.piezas?.some((p) => p.recurso));

/**
 * Lo que la configuración ofrece como «modelo» (#4): la clave de la preferencia que nombra el modelo (la etiqueta de
 * la posición que dice la cabecera, epoch.9.7.0.5) y los modelos de la época que tienen recursos (los paquetes de arte,
 * en el orden de la cadena de la época; el sobrio no: es el respaldo, no se elige). → { clave, modelos: [{ nombre, nivel, donde }] }.
 */
export function eleccionDeModelo(opciones = {}) {
  const c = cabecera(opciones);
  const descripcion = c.preferencia ? resolver(raizDe(epocaDe(opciones)), c.preferencia) : undefined;
  const clave = texto(hoja(descripcion?.[0])) ?? null;
  const orden = (m) => { const k = c.cadena.indexOf(m.nombre); return k < 0 ? Infinity : k; }; // en el orden de la cadena de la época
  const modelos = modelosDeLaEpoca(opciones).filter(conRecursos).map((m, k) => ({ m, k })).sort((a, b) => orden(a.m) - orden(b.m) || a.k - b.k);
  return { clave, modelos: modelos.map(({ m: { nombre, nivel, donde } }) => ({ nombre, nivel, donde })) };
}

/** El valor numérico de una clave para ordenar los pasos: la comodín es la más baja. */
const numero = (clave) => (typeof clave === 'number' ? clave : -Infinity);

/**
 * La clave de pieza que corresponde a lo que el núcleo o la carta dan (`dado`) para un tipo en un mundo, según la
 * correspondencia de la cabecera (epoch.9.7.0.4.n.2): la fila de ese dado con el mundo `pv` entre los suyos, si no la
 * fila sin mundos, si no lo dado tal cual (la correspondencia solo renombra lo que renombra).
 */
export function corresponde(c, tipo, dado, pv) {
  const filas = (c?.tipos ?? []).find((t) => t.tipo === tipo)?.correspondencia ?? [];
  const mias = filas.filter((f) => f.de === dado);
  const conMundo = typeof pv === 'number' ? mias.find((f) => f.mundos.includes(pv)) : undefined;
  return (conMundo ?? mias.find((f) => !f.mundos.length))?.a ?? dado;
}

/** La segunda componente de la clave por defecto de un tipo en un mundo (el rol por defecto del muñequito: la fila de la correspondencia cuyo dado es el mundo), o null. */
export function rolPorDefecto(c, tipo, pv) {
  const filas = (c?.tipos ?? []).find((t) => t.tipo === tipo)?.correspondencia ?? [];
  const fila = filas.find((f) => f.de === pv);
  return fila ? texto(fila.a) ?? null : null;
}

/**
 * La primera pieza que exista en la cadena `modelos` (lo que da modelo()) para un tipo, un mundo (pv) y una clave (el
 * paso de madurez, la acción, la primitiva o el punto de vista del icono), con una orientación. En cada modelo, por
 * orden: la orientación pedida y, si no la hay, las de la cabecera (la primera es la de respaldo); con una clave
 * numérica, la pieza del paso pedido o la del paso inferior más cercano (la comodín es la más baja); con una palabra,
 * la exacta o la comodín; entre varias, la de mayor tamaño mínimo que quepa en `tamano` (sin tamaño, todas caben) y,
 * a igual tamaño, la de menor rango (la nueva antes que la que quedó de respaldo con la misma clave; a igual rango,
 * la primera del modelo). Con `rol` (etapa 5), la segunda componente de la clave: las piezas de ese rol o nombre; si
 * el modelo no tiene ninguna del rol pedido en ese mundo, las del rol por defecto del mundo (la correspondencia de la
 * cabecera, rolPorDefecto) y, si tampoco, cualquiera. Con `de`, una clave numérica k se lee como «k de `de`» y se
 * reescala a los pasos que el modelo tiene para ese tipo y mundo (su mayor clave numérica): la madurez 11 de 15 pide
 * la etapa 8 de 10. Solo si ningún modelo responde en ese mundo devuelve null: el sobrio, completo por forma,
 * siempre responde.
 * `origen` es dónde está el modelo que responde (el id del registro del modelo, o el del elemento si es su arte
 * propio, `propio: true`): la carta, en el pintado «propio», solo acepta piezas cuyo origen es el elemento que pinta.
 * → { modelo, nivel, origen, propio, tipo, pv, clave, <nombre de la clave>, subclave, variante, tamano, formato | forma, recurso, bucle, fotogramas, rango, … }
 */
export function pieza(modelos, tipo, pv, clave, variante, { tamano, rol, de } = {}) {
  const pedida = clave === undefined || clave === null ? CUALQUIERA : clave;
  for (const m of modelos ?? []) {
    const delTipo = m.piezas.filter((p) => p.tipo === tipo && p.pv === pv && (tamano === undefined || !(p.tamano > tamano)));
    if (!delTipo.length) continue;
    let candidatas = delTipo;
    if (typeof rol === 'string' && rol) {
      const propias = delTipo.filter((p) => p.subclave === rol);
      const defecto = propias.length ? null : rolPorDefecto(m.cabecera, tipo, pv);
      const porDefecto = defecto ? delTipo.filter((p) => p.subclave === defecto) : [];
      candidatas = propias.length ? propias : porDefecto.length ? porDefecto : delTipo;
    }
    // Con «k de de», k se reescala a los pasos de este modelo (su mayor clave numérica para el tipo y el mundo).
    let k = pedida;
    if (typeof pedida === 'number' && typeof de === 'number' && de > 0) {
      const tope = Math.max(0, ...candidatas.map((p) => numero(p.clave)).filter((n) => Number.isFinite(n)));
      if (tope > 0) k = Math.max(1, Math.ceil((pedida * tope) / de));
    }
    const orientaciones = [...new Set([variante, ...(m.cabecera?.variantes ?? []), ...candidatas.map((p) => p.variante)].filter((v) => typeof v === 'string'))];
    for (const v of orientaciones) {
      const lista = candidatas.filter((p) => p.variante === v);
      let mejores;
      if (typeof k === 'number') {
        const caben = lista.filter((p) => p.clave === CUALQUIERA || (typeof p.clave === 'number' && p.clave <= k));
        const mayor = Math.max(...caben.map((p) => numero(p.clave)));
        mejores = caben.filter((p) => numero(p.clave) === mayor);
      } else {
        const exactas = lista.filter((p) => p.clave === k);
        mejores = exactas.length ? exactas : lista.filter((p) => p.clave === CUALQUIERA);
      }
      if (!mejores.length) continue;
      const elegida = mejores.reduce((a, b) => (b.tamano > a.tamano || (b.tamano === a.tamano && b.rango < a.rango) ? b : a));
      const { crudo: _crudo, tiempo: _tiempo, repeticion: _repeticion, ...plana } = elegida;
      return { modelo: m.nombre, nivel: m.nivel, origen: m.donde ?? null, propio: Boolean(m.propio), ...plana };
    }
  }
  return null;
}

/**
 * Lo que a un modelo le falta o le sobra para ser válido: { motivos, avisos }. Motivos: una pieza animada (un formato de
 * epoch.9.7.0.6) sin su 4 [repetición, fotogramas], con una repetición que la cabecera no conoce o con fotogramas que
 * no son un entero positivo; un tamaño mínimo que la época no tiene; una posición del modelo cuyo registro no es una
 * pieza (otro tipo). Avisos: fotogramas animados que no son múltiplo del de la cabecera (lo nuevo va en múltiplos de
 * diez; el arte de prueba 03 trae 48). `m` es lo que da modelo() o modelosDeLaEpoca(), o un registro de modelo.
 */
export function validarModelo(m, opciones = {}) {
  const c = m?.cabecera ?? cabecera(opciones);
  const modeloObj = Array.isArray(m) ? modeloDe(m, null, c, opciones) : m;
  const raiz = raizDe(epocaDe(opciones));
  const tamanos = hojas(en(raiz, [...SITIO.representacion, 2])).filter(Array.isArray).map((t) => hoja(t[0]));
  const motivos = [];
  const avisos = [];
  const epoca = epocaDe(opciones);
  // Las referencias de las posiciones que no llevan a una pieza.
  for (let pv = 1; pv < 10; pv++) {
    const posicion = modeloObj.registro?.[pv];
    for (const r of Array.isArray(posicion) ? posicion.filter(esReferencia) : []) {
      const destino = epoca.registros?.get(r.ref);
      if (destino === undefined) continue; // un registro del eje: lo lee piezasDeModelo con el eje
      if (!leerPieza(destino, { pv, cabecera: c })) motivos.push('posición ' + pv + ': ' + r.ref.slice(0, 8) + ' no es una pieza (su 0 no es un tipo de la cabecera)');
    }
  }
  const vistas = new Set(); // una pieza que sirve en varios mundos se valida una vez
  modeloObj.piezas.forEach((p) => {
    if (p.donde) { if (vistas.has(p.donde)) return; vistas.add(p.donde); }
    const donde = 'pieza ' + p.tipo + ' ' + String(p.clave) + (p.subclave ? ' ' + p.subclave : '') + ' ' + p.variante + ' (mundo ' + p.pv + ')';
    if (p.tamano !== 0 && !tamanos.includes(p.tamano)) motivos.push(donde + ': tamaño mínimo ' + p.tamano + ' que la época no tiene');
    if (p.animado) {
      if (!p.tiempo) motivos.push(donde + ': animada (' + p.formato + ') sin su 4 [repetición, fotogramas]: bucle y fotogramas son obligatorios en lo animado');
      else {
        if (p.repeticion !== c.bucle && p.repeticion !== c.fijo) motivos.push(donde + ': repetición «' + p.repeticion + '» que la cabecera no conoce (' + [c.bucle, c.fijo].join(', ') + ')');
        if (!Number.isInteger(p.fotogramas) || p.fotogramas < 1) motivos.push(donde + ': los fotogramas son un entero positivo');
        else if (c.multiplo && p.fotogramas % c.multiplo !== 0) avisos.push(donde + ': ' + p.fotogramas + ' fotogramas no son múltiplo de ' + c.multiplo + ' (lo nuevo va en múltiplos de ' + c.multiplo + ')');
      }
    }
  });
  return { motivos, avisos };
}

/** Las posiciones de una pieza y de la cabecera, por nombre, para quien construye modelos (arte/importar.mjs). */
export const POSICIONES = Object.freeze({ pieza: PIEZA, cabecera: CABECERA, tipo: TIPO, modelos: SITIO.modelos });

/** ¿Es `x` una lista de referencias (la forma de una posición de un modelo de la época)? */
export const esListaDeReferencias = (x) => esLista(x) && x.every(esReferencia);
