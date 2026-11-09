// Los modelos de visualización (encargo 3c-2b, tras 3c-1). Principio (VG): nada hardcodeado en la pantalla; los
// modelos de visualización son REGISTROS; cualquier modelo puede estar incompleto y se rellena por partes; la carta
// pregunta por una pieza (un tipo, un mundo, un paso o una acción, una orientación) y la cadena de modelos responde
// en orden: el que nombra la configuración de quien mira, luego el animado genérico de la época, luego el sobrio,
// que no tiene recursos (solo formas) y siempre responde. Documentación: docs/CONTRATO.md, «Modelos de visualización».
//
//   modelo(eje, yo)                                  la cadena de modelos a consultar, en orden
//   pieza(modelos, tipo, pv, clave, variante, { tamano })   la primera pieza que exista en la cadena (nunca null si el sobrio está)
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
// o, sin recurso, [tamaño mínimo, forma sobria]; 2 su clave (el paso 1-10, la acción, la primitiva o efecto, o el
// mundo del que es icono; «*» = cualquiera); 3 su orientación; 4 [repetición, fotogramas]; 5 los mundos en que sirve; 6 su
// recurso (una ruta relativa del repositorio o una URL) y su procedencia. Los nombres de los tipos, de las claves, de
// las orientaciones, de los niveles y de las palabras de repetición son datos de la cabecera: aquí no hay ninguno.

import { EPOCA_0_BTML } from './epocas.js';
import { esReferencia, esLista, esTerminal, direccion, resolver } from './btml.js';
import { configuracion } from './contrato.js';

const RE_ID = /^[0-9a-f]{64}$/;
/** La clave comodín de una pieza: sirve para cualquier paso, acción, primitiva o punto de vista (como el «*» del 5 de una regla). */
export const CUALQUIERA = '*';

/** Dónde pone la época cada cosa. */
const SITIO = Object.freeze({
  modelos: [9, 7], // 0 la cabecera, 1… las referencias a los modelos
  representacion: [9, 5], // 1 los formatos
});
/** Las posiciones de la cabecera (epoch.9.7.0). */
const CABECERA = Object.freeze({ niveles: 1, cadena: 2, variantes: 3, tipos: 4, preferencia: 5, animados: 6, repeticion: 7, multiplo: 8 });
/** Las posiciones de una pieza. */
const PIEZA = Object.freeze({ tipo: 0, medida: 1, clave: 2, variante: 3, tiempo: 4, mundos: 5, recurso: 6 });

const epocaDe = (opciones) => opciones?.epoca ?? EPOCA_0_BTML;
const raizDe = (epoca) => (Array.isArray(epoca) ? epoca : epoca.registro ?? epoca.payload);
const en = (raiz, camino) => camino.reduce((n, d) => (Array.isArray(n) ? n[d] : undefined), raiz);
const hoja = (x) => (Array.isArray(x) ? x[0] : x);
const hojas = (x) => (x === undefined || x === null ? [] : Array.isArray(x) ? x : [x]);
const texto = (x) => (typeof x === 'string' ? x : typeof x === 'number' ? String(x) : undefined);

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
    tipos: hojas(c?.[CABECERA.tipos]).filter(Array.isArray).map((t) => ({ tipo: hoja(t[0]), clave: texto(hoja(t[1])) ?? null })),
    preferencia: texto(hoja(c?.[CABECERA.preferencia])) ?? null,
    animados: lista(CABECERA.animados),
    bucle: repeticion[0] ?? null,
    fijo: repeticion[1] ?? null,
    multiplo: typeof hoja(c?.[CABECERA.multiplo]) === 'number' ? hoja(c[CABECERA.multiplo]) : null,
    formatos: hojas(en(raiz, [...SITIO.representacion, 1])).filter((x) => typeof x === 'string'),
  };
}

/**
 * Una pieza como objeto plano, o null si el registro no es una pieza (su 0 no es un tipo de la cabecera):
 * { tipo, pv, clave, <nombre de la clave>: clave, variante, tamano, formato | forma, bucle, fotogramas, recurso,
 * procedencia, mundos, animado, crudo }. `pv` es el mundo desde el que se lee (la posición del modelo). Sin
 * orientación, la primera de la cabecera; sin clave, la comodín; sin tamaño mínimo, 0 (cabe en todo).
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
  const claveCruda = hoja(registro[PIEZA.clave]);
  const clave = typeof claveCruda === 'number' || (typeof claveCruda === 'string' && claveCruda) ? claveCruda : CUALQUIERA;
  const variante = texto(hoja(registro[PIEZA.variante])) ?? c.variantes[0] ?? null;
  const [repeticion, fotogramasCrudo] = hojas(registro[PIEZA.tiempo]);
  const tiempo = registro[PIEZA.tiempo] !== undefined;
  const fotogramas = typeof fotogramasCrudo === 'number' ? fotogramasCrudo : 1;
  const recurso = hojas(registro[PIEZA.recurso]);
  const pieza = {
    tipo,
    pv,
    clave,
    variante,
    tamano,
    ...(esFormato ? { formato: formatoOForma } : { forma: typeof formatoOForma === 'string' ? formatoOForma : null }),
    bucle: repeticion === c.bucle,
    fotogramas,
    recurso: recurso.length ? recurso[0] : null,
    procedencia: recurso.slice(1).filter((x) => typeof x === 'string'),
    mundos: hojas(registro[PIEZA.mundos]).filter((x) => esTerminal(x)),
    animado: esFormato && c.animados.includes(formatoOForma),
    tiempo,
    repeticion: typeof repeticion === 'string' ? repeticion : null,
    crudo: registro,
  };
  if (t.clave && !Object.hasOwn(pieza, t.clave)) pieza[t.clave] = clave; // el nombre de la clave del tipo (paso, accion, primitiva, mundo), si no pisa un campo propio
  return pieza;
}

/**
 * Las piezas de un modelo, planas y con su mundo: lo que referencian sus posiciones 1-9 (registros de la época, o del
 * eje si se da) y, si el modelo es un registro del eje (`id`), lo anclado en cada una de esas posiciones que sea una
 * pieza. Una posición que no es una lista de referencias (una hoja: «sin piezas») no tiene piezas.
 */
export function piezasDeModelo(registro, { eje = null, id = null, cabecera: cab, ...opciones } = {}) {
  const epoca = epocaDe(opciones);
  const c = cab ?? cabecera(opciones);
  const fuera = [];
  const alcanza = (ref) => epoca.registros?.get(ref) ?? eje?.obtener(ref)?.payload ?? null;
  for (let pv = 1; pv < 10; pv++) {
    const posicion = registro?.[pv];
    const refs = Array.isArray(posicion) ? posicion.filter(esReferencia) : esReferencia(posicion) ? [posicion] : [];
    for (const r of refs) {
      const p = leerPieza(alcanza(r.ref), { pv, cabecera: c });
      if (p) fuera.push({ ...p, donde: r.ref });
    }
    if (id && eje) {
      for (const h of eje.sobre(id, direccion([pv]))) {
        const p = leerPieza(h.payload, { pv, cabecera: c });
        if (p) fuera.push({ ...p, donde: h.id });
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
 * `yo` (la preferencia cuya posición dice la cabecera: un nombre de la época, o el id o el nombre de un registro del
 * eje que sea un modelo), luego los de la cadena de la época (epoch.9.7.0.2: el animado genérico y el sobrio), sin
 * repetir. `yo` es la identidad o lo que devuelve contrato.yo(). Cada uno, { nombre, nivel, nota, donde, registro,
 * piezas, cabecera }.
 */
export function modelo(eje, yo, opciones = {}) {
  const epoca = epocaDe(opciones);
  const raiz = raizDe(epoca);
  const c = cabecera(opciones);
  const deLaEpoca = modelosDeLaEpoca(opciones);
  const conf = configuracion(eje, yo, opciones);
  const descripcion = c.preferencia ? resolver(raiz, c.preferencia) : undefined;
  const etiqueta = texto(hoja(descripcion?.[0]));
  const nombrado = etiqueta ? conf[etiqueta] : undefined;
  const nombres = [nombrado, ...c.cadena].filter((x) => typeof x === 'string' && x.length > 0);
  const resolverNombre = (n) => {
    const propio = deLaEpoca.find((m) => m.nombre === n);
    if (propio) return propio;
    if (!eje) return null;
    if (RE_ID.test(n)) {
      const ev = eje.obtener(n);
      return ev && esModelo(ev.payload, c) ? modeloDe(ev.payload, ev.id, c, { eje, id: ev.id, ...opciones }) : null;
    }
    for (const id of eje.orden) {
      const ev = eje.obtener(id);
      if (esModelo(ev.payload, c) && hoja(ev.payload[0]) === n) return modeloDe(ev.payload, ev.id, c, { eje, id: ev.id, ...opciones });
    }
    return null;
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
  return fuera;
}

/** El valor numérico de una clave para ordenar los pasos: la comodín es la más baja. */
const numero = (clave) => (typeof clave === 'number' ? clave : -Infinity);

/**
 * La primera pieza que exista en la cadena `modelos` (lo que da modelo()) para un tipo, un mundo (pv) y una clave (el
 * paso de madurez, la acción, la primitiva o el punto de vista del icono), con una orientación. En cada modelo, por
 * orden: la orientación pedida y, si no la hay, las de la cabecera (la primera es la de respaldo); con una clave
 * numérica, la pieza del paso pedido o la del paso inferior más cercano (la comodín es la más baja); con una palabra,
 * la exacta o la comodín; entre varias, la de mayor tamaño mínimo que quepa en `tamano` (sin tamaño, todas caben).
 * Solo si ningún modelo responde en ese mundo devuelve null: el sobrio, completo por forma, siempre responde.
 * → { modelo, nivel, tipo, pv, clave, <nombre de la clave>, variante, tamano, formato | forma, recurso, bucle, fotogramas, … }
 */
export function pieza(modelos, tipo, pv, clave, variante, { tamano } = {}) {
  const pedida = clave === undefined || clave === null ? CUALQUIERA : clave;
  for (const m of modelos ?? []) {
    const candidatas = m.piezas.filter((p) => p.tipo === tipo && p.pv === pv && (tamano === undefined || !(p.tamano > tamano)));
    if (!candidatas.length) continue;
    const orientaciones = [...new Set([variante, ...(m.cabecera?.variantes ?? []), ...candidatas.map((p) => p.variante)].filter((v) => typeof v === 'string'))];
    for (const v of orientaciones) {
      const lista = candidatas.filter((p) => p.variante === v);
      let mejores;
      if (typeof pedida === 'number') {
        const caben = lista.filter((p) => p.clave === CUALQUIERA || (typeof p.clave === 'number' && p.clave <= pedida));
        const mayor = Math.max(...caben.map((p) => numero(p.clave)));
        mejores = caben.filter((p) => numero(p.clave) === mayor);
      } else {
        const exactas = lista.filter((p) => p.clave === pedida);
        mejores = exactas.length ? exactas : lista.filter((p) => p.clave === CUALQUIERA);
      }
      if (!mejores.length) continue;
      const elegida = mejores.reduce((a, b) => (b.tamano > a.tamano ? b : a));
      const { crudo: _crudo, tiempo: _tiempo, repeticion: _repeticion, ...plana } = elegida;
      return { modelo: m.nombre, nivel: m.nivel, ...plana };
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
  modeloObj.piezas.forEach((p) => {
    const donde = 'pieza ' + p.tipo + ' ' + String(p.clave) + ' ' + p.variante + ' (mundo ' + p.pv + ')';
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
export const POSICIONES = Object.freeze({ pieza: PIEZA, cabecera: CABECERA, modelos: SITIO.modelos });

/** ¿Es `x` una lista de referencias (la forma de una posición de un modelo de la época)? */
export const esListaDeReferencias = (x) => esLista(x) && x.every(esReferencia);
