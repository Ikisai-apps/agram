// La carta, versión 1: el núcleo puro. Pinta un registro X con un tamaño, en un punto de vista k, SIN LÓGICA PROPIA:
// todo lo que decide algo (qué puntos de vista caben, cómo se llama cada posición, en qué orden van los ocupantes,
// qué nivel tiene el registro, qué representación cabe, qué acciones hay, qué falta en el camino, qué pieza se pinta)
// lo pide al núcleo: contrato, acciones, local, pasos y modelos. Aquí solo se mide el espacio, se pide y se ordena en
// un árbol de nodos planos (sin DOM) que carta/dom.js convierte en HTML y test/carta.test.js comprueba en Node.
//
// En animado (etapa 5, la fase 2 del arte), cada PV lleva además: su ETAPA (la pieza grande del mundo, por el paso
// de madurez del foco reescalado a los pasos del modelo, con la orientación de su lado), su MARCO (el del mundo), en
// bloque y en foco su FONDO (el de la etapa inferior más cercana) y su PERSONAJE (el muñequito del rol por defecto
// del mundo: esperar en bucle en lo enfocado, actuar cuando llega una transacción nueva, celebrar una vez cuando el
// paso propio del PV llega a su «de», y parado en los demás), los ELEMENTOS de sus ocupantes y los EFECTOS de los
// movimientos nuevos del diario (la primitiva del libro llevada a la clave de la pieza por la correspondencia de la
// cabecera). Qué rol, qué efecto y cuántas animaciones a la vez son datos (la cabecera y la configuración).
//
//   arbol(estado, eje, yo, medidas, opciones)        → el árbol de la carta para quien mira (async: el camino lo es)
//   formulario(eje, X, accion, yo, valores, opciones) → los campos del formulario de una acción del aro
//   enviar(eje, X, accion, valores, yo, firmar, …)    → transaccion y, si pasa, firma y asienta
//   preferencias(eje, yo, valores, opciones)          → la candidata del registro «preferences» para editar la configuración
//
// Lo único que este módulo sabe por sí mismo es la GEOMETRÍA de la pantalla, que es diseño de VG cerrado en el encargo
// de la carta y no un dato del dominio: el 0 en el centro y el 5 detrás; la X en las esquinas (1 arriba a la izquierda,
// 2 arriba a la derecha, 3 abajo a la izquierda, 4 abajo a la derecha); la cruz en los lados (6 izquierda, 7 derecha, 8
// arriba, 9 abajo); y qué lado mira cada uno (1, 3 y 6 el lado del PV1; 2, 4 y 7 el del PV2; el resto, el centro). Las
// palabras de las orientaciones, los tamaños, las etiquetas, los niveles, los órdenes y las disposiciones son de la
// época: no hay ninguna escrita aquí.

import * as contrato from '../src/contrato.js';
import * as acciones from '../src/acciones.js';
import * as pasosDe from '../src/pasos.js';
import * as modelos from '../src/modelos.js';
import { partirClave } from '../src/tokens.js';
import { esReferencia, esLista, esDecupla, indicesDe, direccion } from '../src/btml.js';
import { t } from './textos.js';

/** El tipo de una pieza del modelo de visualización que la carta pide (vocabulario de la cabecera epoch.9.7.0.4). */
const PIEZA = Object.freeze({ elemento: 'elemento', munequito: 'munequito', icono: 'icono', etapa: 'etapa', fondo: 'fondo', marco: 'marco', movimiento: 'movimiento' });
/** Las acciones del muñequito que la carta pide (las claves de las piezas munequito: arte/MANIFIESTO.md §1): en reposo, cuando llega algo, cuando el paso se cierra. */
const ACCION = Object.freeze({ esperar: 'esperar', actuar: 'actuar', celebrar: 'celebrar' });
/** Cómo se reproduce una pieza animada: parada en su fotograma, en bucle, o una vez. */
export const ANIMAR = Object.freeze({ no: 'no', bucle: 'bucle', una: 'una' });
/** Cuántas animaciones a la vez si la configuración no lo dice ni la época trae el defecto. */
const LIMITE_DE_ANIMACIONES = 10;

/**
 * La geometría (diseño de VG). `grupo`: dónde va; `lado`: el índice de la orientación en epoch.9.7.0.3 (0 el centro,
 * 1 el lado del PV1, 2 el del PV2); `fila`: arriba o abajo. Los centros no son laterales: el 0 es el anverso y el 5
 * el reverso. `celda`: [fila, columna] en la matriz 3×3 de Mapped (1 arriba a la izquierda, 8 arriba, 2 arriba a la
 * derecha, 6 izquierda, 7 derecha, 3 abajo a la izquierda, 9 abajo, 4 abajo a la derecha; el 0 y el 5 en el centro);
 * `borde`: dónde va su rosetón en el ordenador (el de cada lateral, su celda; el 0 arriba al centro y el 5 abajo al
 * centro, VG 10-11).
 */
export const GEOMETRIA = Object.freeze({
  0: { grupo: 'nucleo', lado: 0, cara: 'anverso', celda: [1, 1], borde: [0, 1] },
  5: { grupo: 'nucleo', lado: 0, cara: 'reverso', celda: [1, 1], borde: [2, 1] },
  1: { grupo: 'x', lado: 1, fila: 'arriba', celda: [0, 0] },
  2: { grupo: 'x', lado: 2, fila: 'arriba', celda: [0, 2] },
  3: { grupo: 'x', lado: 1, fila: 'abajo', celda: [2, 0] },
  4: { grupo: 'x', lado: 2, fila: 'abajo', celda: [2, 2] },
  6: { grupo: 'cruz', lado: 1, fila: 'medio', celda: [1, 0] },
  7: { grupo: 'cruz', lado: 2, fila: 'medio', celda: [1, 2] },
  8: { grupo: 'cruz', lado: 0, fila: 'arriba', celda: [0, 1] },
  9: { grupo: 'cruz', lado: 0, fila: 'abajo', celda: [2, 1] },
});
export const CENTROS = Object.freeze(Object.keys(GEOMETRIA).map(Number).filter((pv) => GEOMETRIA[pv].grupo === 'nucleo'));
export const LATERALES = Object.freeze(Object.keys(GEOMETRIA).map(Number).filter((pv) => GEOMETRIA[pv].grupo !== 'nucleo'));

/**
 * Las medidas por defecto (VG): el hueco comprimido, 48 px (un dato: un número o un icono); la tarjeta, 160 px (con
 * imagen); el bloque, lo que le toque de pantalla. Son píxeles de la pantalla, no datos del dominio: quien llama los
 * puede cambiar.
 */
export const MEDIDAS = Object.freeze({ ancho: 400, alto: 700, hueco: 48, tarjeta: 160, linea: 30 });

/**
 * Lo que se pinta de un PV lateral, de menos a más: 0 oculto, 1 comprimido (un dato), 2 tarjeta (los ocupantes que
 * caben), 3 bloque (la lista o la matriz, paginada); el siguiente gesto entra en el PV. En el móvil (apilada) son los
 * pasos de tamaño; en Mapped los pasos son los de la época (epoch.8.6, `escalaDeTamanos`) y esto es solo lo que cabe
 * dentro de cada uno.
 */
export const NIVEL = Object.freeze({ oculto: 0, comprimido: 1, tarjeta: 2, bloque: 3 });

const corto = (id) => String(id ?? '').slice(0, 8);
const hojas = (x) => (x === undefined || x === null ? [] : Array.isArray(x) ? x : [x]);

/** El evento de X en el eje, o null. */
const eventoDe = (eje, X) => (typeof X === 'string' ? eje?.obtener(X) ?? null : X && typeof X === 'object' && 'payload' in X ? X : null);

/** La dirección de una referencia en corto: «1.2», o '' si es la raíz. */
const dirCorta = (dir) => {
  try {
    return dir ? indicesDe(dir).join('.') : '';
  } catch {
    return '';
  }
};

/**
 * El tamaño de la época (epoch.9.5.2) que cabe en un hueco de `px` píxeles: el mayor cuyo mínimo en píxeles no lo
 * pasa. El mínimo en píxeles de cada tamaño lo pone la carta por su orden: el primero el hueco, el segundo la tarjeta,
 * los siguientes, múltiplos de la tarjeta (el bloque es al menos dos tarjetas).
 */
function tamanoQueCabe(px, medidas, opciones) {
  const lista = contrato.tamanos(opciones);
  let elegido = lista[0] ?? null;
  lista.forEach((t, k) => {
    const minimo = k === 0 ? medidas.hueco : medidas.tarjeta * k;
    if (px >= minimo) elegido = t;
  });
  return elegido;
}

/** El tamaño de la época que corresponde a un paso de nivel (1 comprimido → el primero, 2 tarjeta → el segundo, 3 bloque → el tercero). */
function tamanoDeNivel(nivel, opciones) {
  const lista = contrato.tamanos(opciones);
  return lista[Math.min(Math.max(nivel, 1), lista.length) - 1] ?? null;
}

/**
 * La representación de X que cabe en un tamaño: la mayor cuyo mínimo no pasa del tamaño y cuyo formato se puede
 * pintar: en sobrio, solo el formato de una hoja (el primero de la época, texto); en animado, también las que traen un
 * recurso. → { texto, tamano, formato, recurso } o null.
 */
function representacionQueCabe(eje, X, tamano, { animado, opciones }) {
  const todas = contrato.representaciones(eje, X, opciones);
  const deHoja = todas.find((r) => r.tamano === 0 && !r.recurso)?.formato ?? null;
  const caben = todas.filter((r) => r.tamano <= (tamano?.tamano ?? 0) && (animado || (!r.recurso && r.formato === deHoja)));
  if (!caben.length) return null;
  return caben.reduce((a, b) => (b.tamano >= a.tamano ? b : a));
}

/** Un valor en texto legible, como lo dice el núcleo en el idioma de quien mira (contrato.legible); `tipo`, el de la posición o el parámetro. */
const legibleDe = (eje, o, tipo, opciones) => contrato.legible(eje, o, tipo, opciones);

/**
 * Un ocupante como nodo: { tipo: 'hoja' | 'referencia' | 'decupla' | 'lista', texto, ref, dir, X, representacion,
 * elemento }; el texto es el legible del núcleo. En animado, `elemento` es la pieza suelta del mundo (`pv`) para el
 * ocupante: un registro referenciado, por su propia madurez; lo demás, la comodín.
 */
function nodoOcupante(eje, o, tamano, ctx, tipoDato, { pv = null, lado = 0, posicion = pv, anidar = ctx.estado?.anidar ?? 0 } = {}) {
  const l = legibleDe(eje, o, tipoDato, ctx.opciones);
  const elementoDe = (X) => {
    if (!ctx.animado || pv === null || !LATERALES.includes(pv)) return null;
    const m = X ? contrato.madurez(eje, X, ctx.opciones) : null;
    return conRecurso(piezaDe(ctx, PIEZA.elemento, pv, m?.nivel ?? null, lado, tamano, { de: m?.de ?? undefined }));
  };
  if (esReferencia(o)) {
    const X = eje?.obtener(o.ref) ? o.ref : null;
    return {
      tipo: 'referencia',
      pv: posicion, // el dígito de la posición que ocupa en su padre: de él sale su color (contrato.colores)
      anidados: X && anidar > 0 ? anidadosDe(eje, X, tamano, ctx, anidar - 1) : [],
      texto: l.texto,
      ref: o.ref,
      dir: dirCorta(o.dir),
      X,
      representacion: X ? representacionQueCabe(eje, X, tamano, ctx) : null,
      autor: X ? eje.obtener(X).autor : null,
      elemento: elementoDe(X),
    };
  }
  if (Array.isArray(o) && esDecupla(o)) return { tipo: 'decupla', pv: posicion, texto: l.texto, hojas: (l.partes.posiciones ?? []).map((p) => p?.texto ?? ''), elemento: elementoDe(null) };
  if (esLista(o)) return { tipo: 'lista', pv: posicion, texto: l.texto, elemento: elementoDe(null) };
  return { tipo: 'hoja', pv: posicion, texto: l.texto, valor: o, elemento: elementoDe(null) };
}

/**
 * Los ocupantes anidados de un registro: por cada punto de vista lateral que tenga ocupantes, los que caben (los de
 * un hueco comprimido), cada uno con el dígito de su posición en su padre y, mientras quede `anidar`, los suyos. Así
 * 1 → 4 → 2 lleva los dígitos 1, 4 y 2 a cualquier profundidad (estado.anidar dice cuántos niveles se despliegan).
 */
function anidadosDe(eje, X, tamano, ctx, anidar) {
  const fuera = [];
  for (const pv of LATERALES) {
    const o = contrato.ocupantes(eje, X, pv, 0, ctx.paso, ctx.opciones);
    if (!o.total) continue;
    const tipoDato = contrato.tipo(eje, X, pv, ctx.opciones);
    fuera.push({ pv, total: o.total, lista: o.ocupantes.map((x) => nodoOcupante(eje, x, tamano, ctx, tipoDato, { posicion: pv, anidar })) });
  }
  return fuera;
}

/** Los pasos de X por punto de vista: { [pv]: { nombre, k, de } }, con el paso de todo elemento (pv «*») como respaldo en `comun`. */
function pasosPorPv(eje, X, opciones) {
  const todos = pasosDe.pasos(eje, X, opciones);
  const porPv = {};
  let comun = null;
  for (const [nombre, p] of Object.entries(todos)) {
    if (typeof p.pv === 'number') porPv[p.pv] = { nombre, k: p.k, de: p.de };
    else comun = { nombre, k: p.k, de: p.de };
  }
  return { porPv, comun };
}

/** La pieza del modelo para un PV: por tipo, mundo y clave, con la orientación de su lado y el tamaño; `rol` y `de` como en modelos.pieza; null en sobrio. */
function piezaDe(ctx, tipo, pv, clave, lado, tamano, { rol, de } = {}) {
  if (!ctx.animado || !ctx.cadena.length) return null;
  const variante = ctx.variantes[lado] ?? ctx.variantes[0];
  const p = modelos.pieza(ctx.cadena, tipo, pv, clave, variante, { tamano: tamano?.tamano, rol, de });
  if (!p) return null;
  const { crudo: _c, ...plana } = p;
  return plana;
}

/** La posición del modelo donde viven los marcos y los iconos: el centro (el reverso, el segundo de los centros de la geometría). */
const CENTRO_DEL_MODELO = CENTROS[1] ?? CENTROS[0];

/**
 * El rol del personaje de un PV de X. GANCHO: hoy el rol no sale del registro (nada en la época lo dice todavía); se
 * devuelve null y la carta usa el rol por defecto del mundo, que es un dato de la cabecera (epoch.9.7.0.4: la
 * correspondencia del muñequito, modelos.rolPorDefecto). Cuando el registro diga su rol, es aquí donde se lee.
 */
function rolDeRegistro(_eje, _X, _pv, _ctx) {
  return null;
}

/** El rol con que se pide el personaje de un PV: el del registro si lo dice, si no el por defecto del mundo. */
function rolDe(ctx, eje, X, pv) {
  return rolDeRegistro(eje, X, pv, ctx) ?? modelos.rolPorDefecto(ctx.cabecera, PIEZA.munequito, pv);
}

/** La etapa de un PV: la pieza grande del mundo por el paso de madurez del foco (k de de, reescalado por el modelo), orientada por su lado. */
const etapaDe = (ctx, pv, lado, tamano) => piezaDe(ctx, PIEZA.etapa, pv, ctx.madurez?.nivel ?? null, lado, tamano, { de: ctx.madurez?.de ?? undefined });
/** El fondo de un PV: el de la etapa inferior más cercana a la madurez del foco (la fase 2 trae las de 5 y 10); solo con recurso. */
const fondoDe = (ctx, pv, tamano) => conRecurso(piezaDe(ctx, PIEZA.fondo, pv, ctx.madurez?.nivel ?? null, 0, tamano, { de: ctx.madurez?.de ?? undefined }));
/** El marco de un PV: el de su mundo (en el 5 del modelo, por mundo); el del centro, el neutro (la comodín). */
const marcoDe = (ctx, pv, tamano) => conRecurso(piezaDe(ctx, PIEZA.marco, CENTRO_DEL_MODELO, pv, 0, tamano));
/** Una pieza solo si trae recurso (una forma sobria no se pinta como fondo, marco ni efecto). */
const conRecurso = (p) => (p && p.recurso ? p : null);

/** Las transacciones nuevas del diario que tocan un PV de X (lo que la app marca en estado.nuevos), ya repartidas por PV: ctx.nuevosPorPv. */
function nuevosPorPvDe(eje, X, nuevos, opciones) {
  const porPv = new Map();
  if (!nuevos || !nuevos.size) return porPv;
  const total = contrato.diario(eje, X, 0, 0, opciones).total;
  if (!total) return porPv;
  for (const e of contrato.diario(eje, X, 0, total, opciones).entradas) {
    if (!nuevos.has(e.id)) continue;
    const pv = pvDondeCuelga(eje, X, e.id);
    if (pv === null) continue;
    if (!porPv.has(pv)) porPv.set(pv, []);
    porPv.get(pv).push(e);
  }
  return porPv;
}

/** El PV de X bajo el que cuelga una transacción del diario: el primer dígito del «en» del hijo directo de X en su cadena de anclas; X mismo o lo anclado en su 0, el centro (0); null si no cuelga de X. */
function pvDondeCuelga(eje, X, id) {
  let ev = eje.obtener(id);
  if (!ev) return null;
  if (ev.id === X) return CENTROS[0];
  while (ev && ev.sobre !== X) ev = ev.sobre ? eje.obtener(ev.sobre) : null;
  if (!ev) return null;
  try {
    return ev.en ? indicesDe(ev.en)[0] ?? CENTROS[0] : CENTROS[0];
  } catch {
    return CENTROS[0];
  }
}

/** ¿Es una serie del tiempo (T)? La que tiene escala (tokens.partirClave); el T de cada escritura se quema siempre y no es lo que una transacción consume. */
const esDeTiempo = (serie) => { try { return typeof serie === 'string' && partirClave(serie).escala !== undefined; } catch { return false; } };

/**
 * Los efectos que un PV reproduce por lo nuevo del diario: por cada primitiva distinta de los movimientos declarados
 * (sin `clase`, que es la asignación de T y la obtención de P, y sin el T que cuesta escribir: acompañan a toda
 * escritura y no son lo que la transacción hace), la pieza de movimiento cuya
 * clave da la correspondencia de la cabecera para ese mundo (acunar → crear-abajo, o crear-pasado/futuro/arriba
 * según el mundo). Los efectos sirven en todos los mundos (*); el centro no es un mundo y pide por `mundoDelCentro`.
 * → { entradas: [ids], efectos: [{ primitiva, clave, pieza }], consumido }: consumido si todo lo declarado que no es
 * tiempo se quema (sale de alguien y no llega a nadie): la pieza se oculta al acabar el efecto.
 */
function nuevosDe(ctx, pv, lado, tamano, mundoDelCentro) {
  const entradas = ctx.nuevosPorPv.get(pv) ?? [];
  if (!entradas.length) return null;
  // Lo declarado: sin la asignación de T y la obtención de P (clase) y sin el tiempo que cuesta escribir (la serie T de cada escritura).
  const declarados = entradas.flatMap((e) => e.movimientos.filter((m) => !m.clase && !esDeTiempo(m.serie)));
  const primitivas = [...new Set(declarados.map((m) => m.primitiva))];
  const mundo = LATERALES.includes(pv) ? pv : mundoDelCentro;
  const efectos = primitivas.map((primitiva) => {
    const clave = modelos.corresponde(ctx.cabecera, PIEZA.movimiento, primitiva, mundo);
    return { primitiva, clave, pieza: conRecurso(piezaDe(ctx, PIEZA.movimiento, mundo, clave, lado, tamano)) };
  }).filter((e) => e.pieza);
  // Lo consumido: todo lo declarado sale de alguien y no llega a nadie (la forma de una quema en el libro).
  const consumido = declarados.length > 0 && declarados.every((m) => m.de && (m.a === null || m.a === undefined));
  return { entradas: entradas.map((e) => e.id), efectos, consumido };
}

/**
 * El personaje de un PV: el muñequito del rol (rolDe) con la acción que toca: actuar (una vez) si hay transacciones
 * nuevas en el PV, celebrar (una vez) si el paso propio del PV ha llegado a su «de», si no esperar: en bucle si el PV
 * está enfocado (bloque o foco), parado en su fotograma en los demás. → { rol, accion, animar, pieza } o null.
 */
function personajeDe(ctx, eje, X, pv, lado, tamano, { enfocado, nuevos, paso }) {
  const rol = rolDe(ctx, eje, X, pv);
  const cerrado = paso && typeof paso.k === 'number' && typeof paso.de === 'number' && paso.de > 0 && paso.k >= paso.de;
  const accion = nuevos ? ACCION.actuar : cerrado ? ACCION.celebrar : ACCION.esperar;
  const animar = accion !== ACCION.esperar ? ANIMAR.una : enfocado ? ANIMAR.bucle : ANIMAR.no;
  const pieza = piezaDe(ctx, PIEZA.munequito, pv, accion, lado, tamano, { rol });
  if (!pieza) return null;
  return { rol, accion, animar, pieza };
}

/**
 * El nodo de un punto de vista lateral de X en su nivel. En Mapped (`mapa`), la carta ya ha medido su caja: `cuantos`
 * son los datos que caben en ella (los del paso, recortados por lo que mide) y `pagina` la que se ve (sin scroll: se
 * pasa de página, no se carga debajo); la disposición de dentro la dice la división de la época también en el grupo.
 */
function nodoLateral(eje, X, pv, nivel, ctx, medidas, hueco, mapa = null) {
  const g = GEOMETRIA[pv];
  const lado = ctx.variantes[g.lado] ?? ctx.variantes[0] ?? null;
  const nodo = {
    tipo: 'pv', pv, X, grupo: g.grupo, lado, fila: g.fila ?? null, nivel,
    etiqueta: contrato.etiqueta(eje, X, pv, ctx.opciones),
    ayuda: contrato.ayuda(eje, X, pv, ctx.opciones),
    tamano: nivel >= NIVEL.comprimido ? tamanoDeNivel(nivel, ctx.opciones) : null,
    paso: ctx.pasos.porPv[pv] ?? ctx.pasos.comun ?? null,
    medida: medidaDe(ctx, pv),
  };
  if (nivel === NIVEL.oculto) return nodo;
  const paso = ctx.paso;
  const todo = contrato.ocupantes(eje, X, pv, 0, 0, ctx.opciones); // solo el total
  // Comprimido: un dato. El paso del PV si lo hay (su valor discreto), si no cuántos ocupantes tiene.
  const propio = ctx.pasos.porPv[pv];
  nodo.comprimido = propio && typeof propio.k === 'number'
    ? { dato: propio.k, de: propio.de, que: propio.nombre }
    : { dato: todo.total, de: null, que: nodo.etiqueta };
  nodo.pieza = piezaDe(ctx, PIEZA.elemento, pv, ctx.pasos.comun?.k ?? null, g.lado, nodo.tamano);
  if (ctx.animado) {
    // La etapa del mundo por la madurez del foco (el sello en comprimido, el intermedio en tarjeta y bloque, el
    // ilustrado donde lo hay), el marco del mundo y los efectos de lo nuevo; en bloque, el fondo y el personaje.
    nodo.etapa = etapaDe(ctx, pv, g.lado, nodo.tamano);
    nodo.marco = marcoDe(ctx, pv, nodo.tamano);
    nodo.nuevos = nuevosDe(ctx, pv, g.lado, nodo.tamano, ctx.mundoDelCentro);
    nodo.consumido = Boolean(nodo.nuevos?.consumido);
  }
  if (nivel < NIVEL.tarjeta) return nodo;
  // Tarjeta y bloque: los ocupantes que caben, paginados por el paso de la configuración (en Mapped, por páginas).
  const cuantos = mapa ? mapa.cuantos : nivel >= NIVEL.bloque ? paso * (ctx.estado.paginas?.[pv] ?? 1) : nodo.tamano?.datos ?? paso;
  const pagina = mapa ? paginaDe(ctx, eje, X, pv, cuantos) : null;
  const o = contrato.ocupantes(eje, X, pv, pagina ? pagina.desde : 0, cuantos, ctx.opciones);
  const tipoDato = contrato.tipo(eje, X, pv, ctx.opciones);
  nodo.ocupantes = {
    total: o.total, desde: o.desde, cuantos: o.cuantos, orden: o.orden,
    lista: o.ocupantes.map((x) => nodoOcupante(eje, x, tamanoDeNivel(nivel - 1, ctx.opciones), ctx, tipoDato, { pv, lado: g.lado })),
    cargarMas: !mapa && o.total > o.desde + o.ocupantes.length,
    pagina: pagina ? { actual: pagina.actual, de: pagina.de } : null,
  };
  if (mapa && nivel < NIVEL.bloque) nodo.disposicion = contrato.division(eje, X, { datos: Math.max(1, o.ocupantes.length || 1), forma: hueco, ...ctx.opciones }).disposicion;
  if (ctx.animado) nodo.personaje = personajeDe(ctx, eje, X, pv, g.lado, nodo.tamano, { enfocado: nivel >= NIVEL.bloque, nuevos: Boolean(nodo.nuevos), paso: propio ?? null });
  if (nivel >= NIVEL.bloque) {
    // Dentro del bloque, lista o matriz según la forma del hueco: lo decide la época (epoch.8.3.2).
    const d = contrato.division(eje, X, { datos: Math.max(1, o.ocupantes.length || 1), forma: hueco, ...ctx.opciones });
    nodo.disposicion = d.disposicion;
    if (ctx.animado) nodo.fondo = fondoDe(ctx, pv, nodo.tamano);
    nodo.munequito = nodo.personaje?.pieza ?? null;
  }
  // El diario de lo llegado, en el PV del pasado (la cruz, lado del PV1): lo que entró bajo X por llegada.
  if (g.grupo === 'cruz' && g.lado === 1) {
    const d = contrato.diario(eje, X, 0, cuantos, ctx.opciones);
    // Cada asiento, legible: la primitiva del libro y la cantidad con su serie como la dice el núcleo.
    nodo.diario = { total: d.total, entradas: d.entradas.map((e) => ({ id: e.id, t: e.t, autor: e.autor, movimientos: e.movimientos.map((m) => m.primitiva + ' ' + legibleDe(eje, m, null, ctx.opciones).texto), ancla: e.ancla })) };
    // Las opiniones ancladas en este registro, si es el proyecto donde se anclan (acciones.opiniones): con sus respuestas.
    if (ctx.proyecto === X) {
      const cuenta = (l) => l.reduce((n, r) => n + 1 + cuenta(r.respuestas), 0);
      const lista = acciones.opiniones(eje, X, ctx.opciones);
      if (lista.length) nodo.opiniones = lista.map((o) => ({ id: o.id, autor: o.autor, t: o.t, texto: o.texto, clasificacion: o.clasificacion, respuestas: cuenta(o.respuestas) }));
    }
  }
  return nodo;
}

/**
 * La medida que enseña un PV en la fila de arriba de su carta (VG, 10-11): su paso propio si la tabla de pasos le da
 * uno (epoch.9.8: el 4 su ciclo, el 7 su escala, el 8 su cuota) y, si no, el de todo elemento (la madurez). Así el PV4,
 * el sitio de las acciones, dice en qué etapa del ciclo está y no la medida genérica. → { nombre, k, de, propio } o null.
 */
function medidaDe(ctx, pv) {
  const propio = ctx.pasos.porPv[pv];
  const p = propio && typeof propio.k === 'number' ? propio : ctx.pasos.comun;
  return p && typeof p.k === 'number' ? { nombre: p.nombre, k: p.k, de: p.de ?? null, propio: p === propio } : null;
}

/** Los campos del anverso: cada PV lateral con su etiqueta y su primer ocupante en texto legible (lo que rellena el 0 desde los demás). */
function camposDe(eje, X, ctx) {
  return LATERALES.map((pv) => {
    const o = contrato.ocupantes(eje, X, pv, 0, 1, ctx.opciones);
    const tipo = contrato.tipo(eje, X, pv, ctx.opciones);
    return {
      pv,
      etiqueta: contrato.etiqueta(eje, X, pv, ctx.opciones),
      ayuda: contrato.ayuda(eje, X, pv, ctx.opciones),
      marcador: contrato.marcador(eje, X, pv, ctx.opciones),
      tipo,
      valor: o.ocupantes.length ? legibleDe(eje, o.ocupantes[0], tipo, ctx.opciones).texto : '',
      total: o.total,
    };
  });
}

/**
 * El nodo del centro: el anverso (PV0, la representación que cabe y sus campos), el reverso (PV5, cómo encaja) o un PV
 * abierto como foco. En Mapped (`mapa`), un PV abierto es la pantalla completa: dentro, la división de la época con los
 * datos de ese paso (el máximo de Mapped), por páginas de lo que cabe.
 */
function nodoCentro(eje, X, pv, ctx, medidas, hueco, mapa = null) {
  const ev = eventoDe(eje, X);
  const g = GEOMETRIA[pv] ?? { grupo: 'nucleo', lado: 0 };
  const px = Math.min(hueco.ancho, hueco.alto);
  const tamano = tamanoQueCabe(px, medidas, ctx.opciones);
  const base = {
    tipo: 'nucleo', pv, X, cara: g.cara ?? 'pv', tamano,
    etiqueta: contrato.etiqueta(eje, X, pv, ctx.opciones),
    ayuda: contrato.ayuda(eje, X, pv, ctx.opciones),
    representacion: representacionQueCabe(eje, X, tamano, ctx),
    autor: ev?.autor ?? null,
    t: ev?.t ?? null,
    madurez: contrato.madurez(eje, X, ctx.opciones),
    // El nombre de la plantilla de X, en el idioma (contrato.texto: «template <nombre>»); su clave canónica aparte.
    plantilla: nombreDePlantillaDe(eje, X, ctx),
    pasos: ctx.pasos,
    leido: Boolean(ctx.estado.leido),
  };
  if (ctx.animado) {
    base.marco = marcoDe(ctx, null, tamano); // el centro no es un mundo: el marco neutro (la comodín)
    base.nuevos = nuevosDe(ctx, pv, g.lado, tamano, ctx.mundoDelCentro);
    base.consumido = Boolean(base.nuevos?.consumido);
  }
  if (g.cara === 'anverso') return { ...base, campos: camposDe(eje, X, ctx) };
  if (g.cara === 'reverso') {
    const o = contrato.ocupantes(eje, X, pv, 0, ctx.paso, ctx.opciones);
    const tipoDato = contrato.tipo(eje, X, pv, ctx.opciones);
    return {
      ...base,
      ocupantes: { total: o.total, orden: o.orden, lista: o.ocupantes.map((x) => nodoOcupante(eje, x, tamano, ctx, tipoDato, { posicion: pv })) },
      ancla: ev ? { sobre: ev.sobre ?? null, en: ev.en ? dirCorta(ev.en) : '', sobreTexto: ev.sobre ? legibleDe(eje, { ref: ev.sobre }, null, ctx.opciones).texto : null } : null,
      validacion: contrato.validar(eje, X, ctx.opciones),
    };
  }
  // Un PV lateral abierto como foco: su lista entera (paginada), con la disposición que dice la época para este hueco.
  const cuantos = mapa ? mapa.cuantos : ctx.paso * (ctx.estado.paginas?.[pv] ?? 1);
  const pagina = mapa ? paginaDe(ctx, eje, X, pv, cuantos) : null;
  const o = contrato.ocupantes(eje, X, pv, pagina ? pagina.desde : 0, cuantos, ctx.opciones);
  const tipoDato = contrato.tipo(eje, X, pv, ctx.opciones);
  const d = contrato.division(eje, X, { datos: mapa ? mapa.datos : Math.max(1, o.ocupantes.length || 1), forma: hueco, ...ctx.opciones });
  const escenario = ctx.animado && LATERALES.includes(pv) ? {
    lado: ctx.variantes[g.lado] ?? ctx.variantes[0] ?? null,
    etapa: etapaDe(ctx, pv, g.lado, tamano),
    marco: marcoDe(ctx, pv, tamano),
    fondo: fondoDe(ctx, pv, tamano),
    personaje: personajeDe(ctx, eje, X, pv, g.lado, tamano, { enfocado: true, nuevos: Boolean(base.nuevos), paso: ctx.pasos.porPv[pv] ?? null }),
  } : {};
  return {
    ...base,
    ...escenario,
    ocupantes: { total: o.total, desde: o.desde, cuantos: o.cuantos, orden: o.orden, lista: o.ocupantes.map((x) => nodoOcupante(eje, x, tamanoDeNivel(2, ctx.opciones), ctx, tipoDato, { pv, lado: g.lado })), cargarMas: !mapa && o.total > o.desde + o.ocupantes.length, pagina: pagina ? { actual: pagina.actual, de: pagina.de } : null },
    disposicion: d.disposicion,
    division: mapa ? { pvs: d.pvs, datos: d.datos, cargarMas: d.cargarMas } : null,
    medida: medidaDe(ctx, pv),
  };
}

/** El nombre de la plantilla de datos de X en el idioma, o null si no tiene. */
function nombreDePlantillaDe(eje, X, ctx) {
  const clave = contrato.nombreDePlantilla(contrato.plantilla(eje, X, ctx.opciones));
  return clave === undefined ? null : contrato.texto(eje, contrato.claves.plantilla(clave), ctx.opciones.idioma, { original: clave, epoca: ctx.opciones.epoca });
}

/** El nombre de una acción del aro en el idioma, y su id (lo que la carta lanza: el id nombra la plantilla en transaccion). */
function accionDe(nombreCanonico, opciones) {
  const p = acciones.plantillasDeTransaccion(opciones).find((x) => x.nombre === nombreCanonico);
  return { id: p?.id ?? nombreCanonico, nombre: contrato.texto(null, contrato.claves.plantilla(nombreCanonico), opciones.idioma, { original: nombreCanonico, epoca: opciones.epoca }) };
}

/** El aro sobre X: ocho huecos, uno por PV lateral, con la acción por defecto y las demás (acciones.acciones). Cada acción, por su id y su nombre en el idioma. */
function nodoAro(eje, X, yo, ctx) {
  const abierto = ctx.estado.aro?.pv ?? null;
  const huecos = LATERALES.map((pv) => {
    const lista = acciones.acciones(eje, X, pv, yo, ctx.opciones);
    const porDefecto = lista.find((a) => a.porDefecto) ?? lista[0] ?? null;
    const resumen = (a) => ({ id: a.id, nombre: a.etiqueta, lectura: a.lectura, camino: a.camino, faltan: a.parametros.filter((p) => p.falta).map((p) => p.etiqueta) });
    return {
      pv,
      lado: ctx.variantes[GEOMETRIA[pv].lado] ?? null,
      etiqueta: contrato.etiqueta(eje, X, pv, ctx.opciones),
      accion: porDefecto ? resumen(porDefecto) : null,
      otras: lista.filter((a) => a !== porDefecto).map(resumen),
      abierto: abierto === pv,
      icono: piezaDe(ctx, PIEZA.icono, CENTROS[1] ?? 5, pv, GEOMETRIA[pv].lado, tamanoDeNivel(1, ctx.opciones)),
    };
  });
  return { X, texto: representacionQueCabe(eje, X, tamanoDeNivel(1, ctx.opciones), ctx)?.texto ?? corto(X), huecos };
}

/** El idioma de quien mira: el que se pide o el de su configuración (la preferencia «language»). */
const idiomaDe = (eje, yo, opciones) => opciones.idioma ?? contrato.configuracion(eje, yo, opciones).language;

/**
 * Los campos del formulario de una acción del aro (por su id o su nombre canónico) sobre X para `yo`: cada parámetro
 * con su nombre canónico, su etiqueta y su ayuda en el idioma de yo, tipo, si es requerido, su validación, su valor
 * (el dado, o el defecto que resuelve el núcleo), ese valor legible (contrato.legible) y si su tipo es simple (se
 * edita en texto, contrato.desdeLegible) o se edita en BTML.
 * → { X, accion (el id), nombre, pv, campos: [{ nombre, etiqueta, tipo, requerido, ayuda, validacion, posicion, valor, legible, simple, falta }], lectura, camino } o null.
 */
export function formulario(eje, X, accion, yo, valores = {}, opciones = {}) {
  const plantilla = acciones.plantillaDeTransaccion(accion, opciones);
  if (!plantilla) return null;
  const o = { ...opciones, idioma: idiomaDe(eje, yo, opciones) };
  const pv = Number(hojas(plantilla[8])[0]);
  const canonico = acciones.nombreDeAccion(plantilla);
  const ofrecida = acciones.acciones(eje, X, pv, yo, o).find((a) => a.nombre === canonico);
  const defectos = new Map((ofrecida?.parametros ?? []).map((p) => [p.nombre, p.valor]));
  const campos = acciones.parametros(plantilla, o).map((p) => {
    const valor = valores[p.nombre] !== undefined ? valores[p.nombre] : defectos.get(p.nombre);
    return {
      nombre: p.nombre, etiqueta: p.etiqueta, tipo: p.tipo, requerido: p.requerido, ayuda: p.ayuda, validacion: p.validacion, posicion: p.posicion,
      valor: valor === undefined ? null : valor,
      legible: valor === undefined ? '' : legibleDe(eje, valor, p.tipo, o).texto,
      simple: contrato.esTipoSimple(p.tipo, o),
      falta: p.requerido && valor === undefined,
    };
  });
  const { id, nombre } = accionDe(canonico, o);
  return { X, accion: id, nombre, pv, campos, lectura: acciones.esLectura(plantilla), camino: acciones.esCamino(plantilla), ofrecida: Boolean(ofrecida) };
}

/**
 * Lanza una acción: construye, firma con `firmar` (una función async (evento) → evento firmado, o nada: el núcleo
 * valida la candidata ya firmada) y valida con acciones.transaccion; si pasa y hay evento, lo asienta con eje.anadir. Devuelve lo que da transaccion
 * más `asentado` (el evento guardado) o, si el eje lo rechaza al asentar, el motivo tal cual.
 */
export async function enviar(eje, X, accion, valores, yo, firmar, opciones = {}) {
  const r = await acciones.transaccion(eje, accion, { X, ...valores }, yo, { ...opciones, ...(typeof firmar === 'function' ? { firmar } : {}) });
  if (!r.ok || !r.evento) return { ...r, asentado: null };
  try {
    const asentado = await eje.anadir(r.evento); // transaccion ya lo firmó con `firmar`
    return { ...r, asentado };
  } catch (e) {
    return { ...r, ok: false, asentado: null, motivos: [{ regla: null, mensaje: String(e.message ?? e).replace(/^evento (rechazado|mal formado): /, '') }] };
  }
}

/**
 * La plantilla «preferences» de la época, la que describe mi configuración: la posición la dice la cabecera de los
 * modelos (epoch.9.7.0.5: la preferencia `model` vive dentro de ella). → { nombre, registro, donde } o null.
 */
export function plantillaDePreferencias(opciones = {}) {
  const sitio = modelos.cabecera(opciones).preferencia;
  if (!sitio) return null;
  const donde = direccion(indicesDe(sitio).slice(0, -1));
  return contrato.plantillas(null, opciones).find((x) => x.donde === donde) ?? null;
}

/**
 * La candidata del registro de preferencias de `yo` con los valores dados sobre los actuales: la plantilla
 * «preferences» de la época (la posición la dice la cabecera de los modelos, epoch.9.7.0.5: la preferencia `model`
 * vive dentro de ella) dice sus posiciones, la etiqueta de cada d es la clave de la configuración y la posición que no
 * es una preferencia es su tipo (B4). Devuelve { payload, nombre, campos: [{ pv, clave, etiqueta, ayuda, marcador,
 * numero, valor }], sobre, en, de } para que la carta la escriba como un registro más, anclado en el 9 del alta
 * (`clave` es la etiqueta canónica, la clave de la configuración; `etiqueta` y `ayuda`, en el idioma de yo); null si
 * yo no tiene alta.
 */
export function preferencias(eje, yo, valores = {}, opciones = {}) {
  const alta = eje?.alta(yo);
  if (!alta) return null;
  const p = plantillaDePreferencias(opciones);
  if (!p) return null;
  const o = { ...opciones, idioma: idiomaDe(eje, yo, opciones) };
  const T = (que, etiqueta, original) => contrato.texto(eje, contrato.claves.parametro(p.nombre, etiqueta, que), o.idioma, { original, epoca: o.epoca });
  const actual = contrato.configuracion(eje, yo, opciones);
  const defectos = contrato.configuracion(eje, null, opciones);
  const payload = [[p.nombre]];
  const campos = [];
  // Las preferencias las dice el núcleo (contrato.clavesDeConfiguracion): también las que no tienen defecto (el
  // servidor y el eje compartido, etapa 3), que se pintan vacías; la posición que no es una preferencia es el tipo (B4).
  const deLaEpoca = new Set(contrato.clavesDeConfiguracion(opciones).map((c) => c.clave));
  p.registro.forEach((desc, d) => {
    if (d === 0 || !Array.isArray(desc) || !esDecupla(desc)) return;
    const clave = hojas(desc[0])[0];
    if (!deLaEpoca.has(clave)) { payload[d] = [p.nombre]; return; } // no es una preferencia: el tipo (B4)
    const numero = typeof hojas(defectos[clave])[0] === 'number';
    const dado = valores[clave] !== undefined ? hojas(valores[clave]) : hojas(actual[clave]);
    const limpio = dado.map((v) => (numero && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v)).filter((v) => v !== '' && v !== undefined && v !== null);
    // Vacía y sin defecto, la posición queda sin escribir (BTML no tiene posiciones vacías).
    const v = limpio.length ? limpio : hojas(defectos[clave]);
    if (v.length) payload[d] = v;
    campos.push({ pv: d, clave, etiqueta: T('label', clave, clave), ayuda: T('help', clave, hojas(desc[9]).slice(-1)[0] ?? ''), marcador: hojas(defectos[clave]), numero, valor: v.length === 1 ? v[0] : v });
  });
  // El registro acaba en el primer hueco: lo de detrás de una posición sin valor no se puede escribir (BTML no tiene
  // huecos), y una preferencia sin valor es la de la época (sync ledger sin sync url no comparte nada).
  const hueco = payload.findIndex((x) => x === undefined);
  if (hueco >= 0) payload.length = hueco;
  return { payload, nombre: contrato.texto(eje, contrato.claves.plantilla(p.nombre), o.idioma, { original: p.nombre, epoca: o.epoca }), campos, sobre: alta.id, en: direccion([9]), de: actual.de };
}

/**
 * Los interruptores de la barra: cada preferencia de la plantilla «preferences» cuya validación admite exactamente dos
 * valores (contrato.clavesDeConfiguracion, `valores`: hoy el pintado, sobrio o animado), con su etiqueta y cada valor en
 * el idioma («template <plantilla> param <clave> option <valor>»); `valor` es el que rige. Tocar uno escribe la
 * preferencia como lo hace la configuración (preferencias(), un registro más en el 9 del alta) y repinta.
 */
function interruptoresDe(configuracion, opciones) {
  const p = plantillaDePreferencias(opciones);
  if (!p) return [];
  const T = (que, clave, original) => contrato.texto(null, contrato.claves.parametro(p.nombre, clave, que), opciones.idioma, { original, epoca: opciones.epoca });
  return contrato.clavesDeConfiguracion(opciones).filter((c) => c.valores?.length === 2).map((c) => ({
    clave: c.clave,
    etiqueta: T('label', c.clave, c.clave),
    valor: hojas(configuracion[c.clave] ?? c.defecto)[0] ?? null,
    opciones: c.valores.map((v) => ({ valor: v, texto: T('option ' + v, c.clave, v) })),
  }));
}

/**
 * Los rosetones: diez mosaicos muy comprimidos de mi propio foco (mi alta), uno por PV, el 0 y el 5 incluidos. El
 * orden es el de las dos tiras del móvil (VG, 10-11): arriba el tetraedro de la X con su centro (1, 2, 0, 3, 4),
 * abajo la cruz con el suyo (6, 7, 5, 8, 9). En el ordenador, cada uno en su `sitio` (su esquina o lateral).
 */
export const ORDEN_ROSETONES = Object.freeze([1, 2, 0, 3, 4, 6, 7, 5, 8, 9]);
function rosetonesDe(eje, yoDatos, ctx, medidas) {
  if (!yoDatos) return [];
  const alta = yoDatos.alta;
  const pasos = pasosPorPv(eje, alta, ctx.opciones);
  return ORDEN_ROSETONES.map((pv) => {
    const nivel = ctx.estado.rosetones?.[pv] ?? NIVEL.comprimido;
    const propio = pasos.porPv[pv];
    const total = contrato.ocupantes(eje, alta, pv, 0, 0, ctx.opciones).total;
    const nodo = {
      pv, X: alta, grupo: GEOMETRIA[pv].grupo, lado: ctx.variantes[GEOMETRIA[pv].lado] ?? null, fila: GEOMETRIA[pv].fila ?? null, nivel,
      // Dónde va en el ordenador (VG, 10-11): en su esquina o lateral, como su PV; el 0 arriba al centro y el 5 abajo.
      sitio: { fila: (GEOMETRIA[pv].borde ?? GEOMETRIA[pv].celda)[0], columna: (GEOMETRIA[pv].borde ?? GEOMETRIA[pv].celda)[1], centro: CENTROS.includes(pv) },
      etiqueta: contrato.etiqueta(eje, alta, pv, ctx.opciones),
      comprimido: propio && typeof propio.k === 'number' ? { dato: propio.k, de: propio.de, que: propio.nombre } : { dato: total, de: null, que: null },
    };
    if (nivel >= NIVEL.tarjeta) {
      const o = contrato.ocupantes(eje, alta, pv, 0, tamanoDeNivel(2, ctx.opciones)?.datos ?? ctx.paso, ctx.opciones);
      const tipoDato = contrato.tipo(eje, alta, pv, ctx.opciones);
      nodo.ocupantes = { total: o.total, lista: o.ocupantes.map((x) => nodoOcupante(eje, x, tamanoDeNivel(1, ctx.opciones), ctx, tipoDato, { posicion: pv })) };
    }
    return nodo;
  });
}

/** El camino de X para yo, como lo da el núcleo, con cada paso marcado como mío, de espera o hecho; lo que se lanza, por su id y su nombre en el idioma. */
async function caminoDe(eje, X, yo, ctx) {
  if (!yo) return { pasos: [], niveles: null };
  const c = await acciones.camino(eje, X, yo, ctx.opciones);
  return {
    pasos: c.pasos.map((p) => ({ fuente: p.fuente, falta: p.falta, hecho: Boolean(p.hecho), espera: p.espera ?? null, regla: p.regla ?? null, porque: p.porque ?? null, propuesta: p.propuesta ?? null, invalida: p.invalida ?? null, mio: Boolean(p.hacer) && !p.espera && !p.hecho, hacer: p.hacer ? { ...accionDe(p.hacer.plantilla, ctx.opciones), X: p.hacer.X, parametros: p.hacer.parametros, lectura: Boolean(p.hacer.lectura) } : null, pasa: p.pasa, motivos: p.motivos })),
    niveles: c.niveles ?? null,
  };
}

/** Lo que el libro local sabe: lo gastado hoy, lo que queda, cuántas interacciones esperan a englobarse. */
function localDe(libro, t) {
  if (!libro) return null;
  const ahora = t ?? new Date().toISOString();
  return { gastadoHoy: libro.gastadoHoy(ahora), quedaHoy: libro.quedaHoy(ahora), pendientes: libro.recorrido().length, anterior: libro.anterior, serie: libro.serie };
}

// ---------- Mapped: los pasos de tamaño, el reparto de la pantalla y los dos mandos (VG, 10-11) ----------

/**
 * Los pasos de tamaño de la época (epoch.8.6, contrato.pasosDeTamano) con lo que la carta necesita saber de ellos,
 * todo leído de sus datos: `partida`, el primero en que cabe un dato (el punto: el de quien aún no se ha tocado);
 * `conEspacio`, el primero que ocupa pantalla (el grupo); `completa`, el que ocupa la pantalla entera en una esquina y
 * en un lado (un solo PV); `tope`, el mayor por debajo de ese (el bloque: la pantalla en 3×3), hasta donde llegan los
 * mandos de todos. Cambiar la tabla en una copia de la época cambia todo esto.
 */
export function escalaDeTamanos(opciones = {}) {
  const pasos = contrato.pasosDeTamano(opciones);
  const completa = pasos.findIndex((p) => p.esquina >= 1 && p.lado >= 1);
  const partida = Math.max(0, pasos.findIndex((p) => p.datos > 0));
  const conEspacio = pasos.findIndex((p) => p.esquina > 0 || p.lado > 0);
  const tope = Math.max(partida, (completa >= 0 ? completa : pasos.length) - 1);
  return { pasos, partida, conEspacio: conEspacio >= 0 ? conEspacio : tope, tope, completa };
}

/** El paso de tamaño de un PV en Mapped: el que guarda el estado, o el de partida. */
const pasoGuardado = (estado, pv, escala) => Math.min(Math.max(estado?.niveles?.[pv] ?? escala.partida, 0), Math.max(0, escala.pasos.length - 1));

/** La fracción de pantalla de un PV en un paso: la de una esquina en la X, la de un lado en la cruz. */
const fraccionDe = (pv, paso) => (paso ? (GEOMETRIA[pv]?.grupo === 'x' ? paso.esquina : paso.lado) : 0);

/**
 * Lo que cada PV quiere de pantalla, antes de repartirla. «En matriz» si alguno está en el tope (el bloque): entonces
 * la pantalla queda en 3×3 y los demás ocupan su celda entera, como si estuvieran al menos en el primer paso con
 * espacio (se rellenan con lo que tengan); si no, cada uno quiere lo de su paso y el punto no ocupa nada. El lado de
 * lo que quiere un PV es la raíz de su fracción (un cuarto de pantalla es media anchura y media altura). El centro (el
 * foco) quiere, en matriz, la celda de un lado en el tope (el 0 en el centro del 3×3); fuera de ella, lo que quede.
 * → { matriz, efectivo: { [pv]: paso }, lado: { [pv]: número }, columnas: [3], filas: [3] } (lo que quiere cada banda).
 */
function deseos(niveles, pvs, escala) {
  const laterales = pvs.filter((pv) => LATERALES.includes(pv));
  const guardado = (pv) => pasoGuardado({ niveles }, pv, escala);
  const matriz = laterales.some((pv) => guardado(pv) >= escala.tope);
  const efectivo = {};
  const lado = {};
  for (const pv of laterales) {
    const k = guardado(pv);
    efectivo[pv] = matriz && escala.pasos[k]?.datos > 0 ? Math.max(k, escala.conEspacio) : k;
    lado[pv] = Math.sqrt(Math.max(0, fraccionDe(pv, escala.pasos[efectivo[pv]])));
  }
  const centro = matriz ? Math.sqrt(Math.max(0, escala.pasos[escala.tope]?.lado ?? 0)) : 0;
  const banda = (eje, i) => Math.max(0, ...laterales.filter((pv) => GEOMETRIA[pv].celda[eje] === i).map((pv) => lado[pv]), i === 1 ? centro : 0);
  return { matriz, efectivo, lado, columnas: [0, 1, 2].map((i) => banda(1, i)), filas: [0, 1, 2].map((i) => banda(0, i)) };
}

/**
 * Reparte un eje de la pantalla (las tres columnas o las tres filas) entre lo que quieren sus bandas, sin pasar nunca
 * de 1: si sobra, el centro se lo queda (el foco se rellena); si falta, la banda de `fija` (la del PV tocado más
 * recientemente) se queda lo suyo y las demás se reparten el resto en proporción; sin ninguna fija, todas en
 * proporción (la cruz se encoge a la vez que la X: los mandos de todos).
 */
function repartirEje(quiere, fija) {
  const suma = quiere.reduce((a, b) => a + b, 0);
  if (suma <= 1) return quiere.map((q, i) => (i === 1 ? q + (1 - suma) : q));
  if (fija !== null && fija !== undefined && quiere[fija] < 1) {
    const otras = suma - quiere[fija];
    const queda = 1 - quiere[fija];
    return quiere.map((q, i) => (i === fija ? q : otras > 0 ? (q * queda) / otras : 0));
  }
  return quiere.map((q) => q / suma);
}

/**
 * El reparto de la pantalla de Mapped: las fracciones de las tres columnas y las tres filas (cada eje suma 1: nunca
 * se pide más pantalla de la que hay, y nunca hay scroll) y la caja de cada PV y del centro, en fracciones de la
 * pantalla { x, y, ancho, alto }. En matriz, cada PV llena su celda; fuera de ella, cada PV ocupa lo de su paso pegado
 * a su esquina o a su lado, y un punto no tiene caja (va junto al foco). `recientes`: los PV tocados uno a uno, del
 * más antiguo al más reciente (el último gana lo suyo).
 */
export function repartir(niveles, pvs, escala, { recientes = [] } = {}) {
  const q = deseos(niveles, pvs, escala);
  const ultimo = [...recientes].reverse().find((pv) => pvs.includes(pv) && LATERALES.includes(pv) && q.lado[pv] > 0);
  const columnas = repartirEje(q.columnas, ultimo === undefined ? null : GEOMETRIA[ultimo].celda[1]);
  const filas = repartirEje(q.filas, ultimo === undefined ? null : GEOMETRIA[ultimo].celda[0]);
  const inicio = (lista, i) => lista.slice(0, i).reduce((a, b) => a + b, 0);
  const celda = ([f, c]) => ({ x: inicio(columnas, c), y: inicio(filas, f), ancho: columnas[c], alto: filas[f] });
  const cajas = {};
  for (const pv of Object.keys(q.lado).map(Number)) {
    const lado = q.lado[pv];
    if (!(lado > 0)) { cajas[pv] = null; continue; }
    const r = celda(GEOMETRIA[pv].celda);
    if (q.matriz) { cajas[pv] = r; continue; }
    // Pegado a su esquina o a su lado: a la izquierda o arriba en la primera banda, a la derecha o abajo en la última, centrado en la del medio.
    const [f, c] = GEOMETRIA[pv].celda;
    const ancho = Math.min(lado, r.ancho);
    const alto = Math.min(lado, r.alto);
    const x = c === 0 ? r.x : c === 2 ? r.x + r.ancho - ancho : r.x + (r.ancho - ancho) / 2;
    const y = f === 0 ? r.y : f === 2 ? r.y + r.alto - alto : r.y + (r.alto - alto) / 2;
    cajas[pv] = { x, y, ancho, alto };
  }
  return { matriz: q.matriz, efectivo: q.efectivo, columnas, filas, cajas, centro: celda(GEOMETRIA[CENTROS[0]].celda), reciente: ultimo ?? null };
}

/**
 * Un paso de tamaño en un solo PV (el clic sobre él, sus botoncitos, el arrastre desde su esquina): sube o baja
 * `delta` pasos entre el de partida y el tope; pasar del tope es la pantalla completa (`completa`: la app pone ese PV
 * como foco). Si al crecer los PV de su fila (al ensanchar) o de su columna (al alargar) ya no caben juntos, sin contar
 * el foco, compiten con él los que se tocaron antes uno a uno y están en un paso igual o mayor: gana el más reciente y
 * cada uno de esos baja un paso (VG, 10-11). Puro: devuelve el estado nuevo
 * { niveles, recientes, completa }, no lo guarda.
 */
export function ampliar(estado, pv, delta, opciones = {}) {
  const escala = escalaDeTamanos(opciones);
  const pvs = opciones.pvs ?? LATERALES;
  const niveles = { ...(estado?.niveles ?? {}) };
  const antes = (estado?.recientes ?? []).filter((x) => x !== pv);
  const nuevo = pasoGuardado(estado, pv, escala) + delta;
  if (escala.completa >= 0 && nuevo >= escala.completa) {
    niveles[pv] = escala.tope;
    return { niveles, recientes: [...antes, pv], completa: true };
  }
  niveles[pv] = Math.max(escala.partida, Math.min(escala.tope, nuevo));
  if (delta <= 0) return { niveles, recientes: antes, completa: false };
  const q = deseos(niveles, pvs, escala);
  const [f, c] = GEOMETRIA[pv].celda;
  // Lo que piden los PV en cada banda (sin el foco, que se queda lo que sobre): si no cabe, hay competición.
  const banda = (eje, i) => Math.max(0, ...Object.keys(q.lado).map(Number).filter((x) => GEOMETRIA[x].celda[eje] === i).map((x) => q.lado[x]));
  const desborda = (eje) => banda(eje, 0) + banda(eje, 1) + banda(eje, 2) > 1 + 1e-9;
  const caidos = new Set();
  for (const eje of [1, 0]) {
    if (!desborda(eje)) continue;
    // Los rivales: los tocados antes que comparten su fila (al ensanchar) o su columna (al alargar), en otra banda.
    for (const otro of antes) {
      const [fo, co] = GEOMETRIA[otro]?.celda ?? [];
      const rival = eje === 1 ? fo === f && co !== c : co === c && fo !== f;
      // Compite quien está en un paso igual o mayor que el que acaba de alcanzar el más reciente.
      if (rival && !caidos.has(otro) && pasoGuardado({ niveles }, otro, escala) >= niveles[pv] && pasoGuardado({ niveles }, otro, escala) > escala.partida) {
        niveles[otro] = pasoGuardado({ niveles }, otro, escala) - 1;
        caidos.add(otro);
      }
    }
  }
  return { niveles, recientes: [...antes, pv], completa: false };
}

/**
 * Los puntitos del foco (y su mando para bajar): un paso a todos los PV a la vez, entre el de partida y el tope (la
 * pantalla en 3×3); ya en el tope, otra pulsación no hace nada. Nadie es «el más reciente»: todos en proporción.
 */
export function ampliarTodos(estado, delta, opciones = {}) {
  const escala = escalaDeTamanos(opciones);
  const niveles = { ...(estado?.niveles ?? {}) };
  for (const pv of opciones.pvs ?? LATERALES) niveles[pv] = Math.max(escala.partida, Math.min(escala.tope, pasoGuardado(estado, pv, escala) + delta));
  return { niveles, recientes: [], completa: false };
}

/** Cuántos datos caben en una caja de `px` píxeles: filas de una línea (menos la cabecera) por columnas de una tarjeta. */
function capacidad(px, m) {
  const filas = Math.max(1, Math.floor((px.alto - m.linea * 2) / m.linea));
  const columnas = Math.max(1, Math.floor(px.ancho / m.tarjeta));
  return filas * columnas;
}

/** La página de ocupantes que se ve de un PV en Mapped (estado.paginas: la página, desde 1): { actual, de, desde }. */
function paginaDe(ctx, eje, X, pv, cuantos) {
  const total = contrato.ocupantes(eje, X, pv, 0, 0, ctx.opciones).total;
  const de = Math.max(1, Math.ceil(total / Math.max(1, cuantos)));
  const actual = Math.min(Math.max(1, ctx.estado.paginas?.[pv] ?? 1), de);
  return { actual, de, desde: (actual - 1) * cuantos };
}

/** Lo que se pinta dentro de un paso de Mapped: oculto si no caben datos, comprimido si no ocupa pantalla (el punto), bloque desde el tope, tarjeta entre medias. */
function nivelDePaso(k, escala) {
  const p = escala.pasos[k];
  if (!p || p.datos <= 0) return NIVEL.oculto;
  if (k < escala.conEspacio) return NIVEL.comprimido;
  return k >= escala.tope ? NIVEL.bloque : NIVEL.tarjeta;
}

/** El paso de tamaño como lo lleva el árbol: { indice, nombre, texto, fraccion, datos }. */
const pasoDelArbol = (pv, k, escala) => {
  const p = escala.pasos[k];
  return p ? { indice: k, nombre: p.nombre, texto: p.texto ?? p.nombre, fraccion: fraccionDe(pv, p), datos: p.datos } : null;
};

/**
 * El árbol de la carta para `yo` mirando el foco de `estado` en una pantalla de `medidas`. `estado`:
 *   foco: { X, pv }          el registro y el PV del centro (el 0 anverso, el 5 reverso, otro: ese PV abierto como foco)
 *   niveles: { [pv]: k }     el paso de tamaño de cada PV lateral: en el móvil, NIVEL (por defecto, comprimido); en
 *                            Mapped, el índice en los pasos de la época (epoch.8.6; por defecto, el de partida: el punto)
 *   recientes: [pv]          Mapped: los PV tocados uno a uno, del más antiguo al más reciente (el último gana lo suyo)
 *   paginas: { [pv]: n }     cuántas páginas de ocupantes se han cargado en cada PV (en Mapped, la página que se ve)
 *   aro: { X, pv } | null    el aro abierto sobre un registro (pv: el hueco desplegado)
 *   formulario: { X, accion, valores, motivos, resultado } | null
 *   rosetones: { [pv]: 1-2 } el paso de cada rosetón de identidad
 *   local: LibroLocal | null el libro local de yo (solo se lee)
 *   leido: boolean           si la lente «leído» del 0 está abierta
 *   nuevos: Set<id>          las transacciones del diario llegadas desde la última vez (lo que el animado anima: efectos y actuar)
 * En Mapped, el foco en un PV lateral es ese PV a pantalla completa (el paso que sigue al tope).
 * `medidas`: { ancho, alto, hueco, tarjeta, linea } en píxeles. `opciones.epoca`, la época que se lee; `opciones.t`, el reloj.
 */
export async function arbol(estado, eje, yo, medidas = {}, opciones = {}) {
  const m = { ...MEDIDAS, ...medidas };
  const X = typeof estado.foco === 'string' ? estado.foco : estado.foco?.X;
  const ev = eventoDe(eje, X);
  if (!ev) return { tipo: 'carta', X: X ?? null, vacio: true, avisos: [t('noHayFoco')] };
  const yoDatos = yo ? contrato.yo(eje, yo, { t: opciones.t, epoca: opciones.epoca }) : null;
  const configuracion = contrato.configuracion(eje, yo, opciones);
  const defectos = contrato.configuracion(eje, null, opciones);
  const animado = configuracion.render !== undefined && configuracion.render !== defectos.render;
  const cabecera = modelos.cabecera(opciones);
  // El idioma de quien mira (su preferencia «language»): todo texto de la época pasa por el núcleo con él.
  const idioma = idiomaDe(eje, yo, opciones);
  const nuevos = estado.nuevos instanceof Set ? estado.nuevos : new Set(Array.isArray(estado.nuevos) ? estado.nuevos : []);
  // Cuántas animaciones a la vez: la preferencia «animations» de quien mira (su registro de preferencias), si no el
  // defecto de la época (epoch.9.3.7), si no el de la carta.
  const limiteDe = (c) => (typeof c?.animations === 'number' && c.animations > 0 ? c.animations : null);
  const limite = (configuracion.de && limiteDe(configuracion)) || limiteDe(defectos) || LIMITE_DE_ANIMACIONES;
  const ctx = {
    estado, opciones: { ...opciones, idioma }, animado,
    variantes: cabecera.variantes,
    cabecera,
    cadena: animado ? modelos.modelo(eje, yo, opciones) : [],
    madurez: animado ? contrato.madurez(eje, X, opciones) : null,
    nuevosPorPv: animado ? nuevosPorPvDe(eje, X, nuevos, opciones) : new Map(),
    limite,
    // El paso de «cargar más»: el de la época (epoch.8.3.3) o, si quien mira lo ha escrito en sus preferencias, el suyo.
    paso: configuracion.de && typeof configuracion.step === 'number' && configuracion.step > 0 ? configuracion.step : contrato.paso(opciones),
    pasos: pasosPorPv(eje, X, opciones),
    // El proyecto donde yo ancla sus opiniones (su ajuste «opinions anchor»): en su pasado se listan (docs/CONTRATO.md §12.7).
    proyecto: yo ? acciones.proyectoDeOpiniones(eje, yo, opciones) : null,
  };
  // Cuántos datos caben en la pantalla, en huecos comprimidos; la época dice qué puntos de vista y cómo se disponen.
  const cabenEnPantalla = Math.max(1, Math.floor(m.ancho / m.hueco) * Math.floor(m.alto / m.hueco));
  const d = contrato.division(eje, X, { datos: cabenEnPantalla, forma: { ancho: m.ancho, alto: m.alto }, ...opciones });
  const disposiciones = contrato.division(eje, X, { datos: 1, forma: { ancho: 1, alto: 1 }, ...opciones }).disposicion; // la de un hueco cuadrado
  const apilada = d.disposicion !== disposiciones; // más alto que ancho: las franjas apiladas (Sequenced); si no, la matriz (Mapped)
  const pvsCentro = d.pvs.filter((pv) => CENTROS.includes(pv));
  const pvsLaterales = d.pvs.filter((pv) => LATERALES.includes(pv));
  ctx.mundoDelCentro = pvsLaterales[0] ?? LATERALES[0]; // los efectos sirven en todos los mundos; el centro pide por el primero
  const pvPedido = typeof estado.foco === 'object' && estado.foco && typeof estado.foco.pv === 'number' ? estado.foco.pv : CENTROS[0];
  const pvCentro = pvsCentro.includes(pvPedido) || !CENTROS.includes(pvPedido) ? pvPedido : pvsCentro[0] ?? CENTROS[0];
  let laterales;
  let centro;
  let mapa = null;
  if (apilada) {
    // El móvil (Sequenced): las franjas, cada una media pantalla; los pasos de tamaño son los de siempre (NIVEL).
    laterales = pvsLaterales.map((pv) => nodoLateral(eje, X, pv, estado.niveles?.[pv] ?? NIVEL.comprimido, ctx, m, { ancho: m.ancho, alto: m.alto / 2 }));
    centro = nodoCentro(eje, X, pvCentro, ctx, m, { ancho: m.ancho, alto: m.alto / 3 });
  } else {
    // Mapped: sin scroll; la pantalla se reparte entre los PV por sus pasos de tamaño (epoch.8.6) y se avanza hacia adentro.
    const escala = escalaDeTamanos(ctx.opciones);
    const px = (caja) => ({ ancho: caja.ancho * m.ancho, alto: caja.alto * m.alto });
    const completa = LATERALES.includes(pvCentro) && pvsLaterales.includes(pvCentro);
    if (completa) {
      // Un PV a pantalla completa: solo él, con flechas a sus vecinos (la geometría de Mapped) y «volver»; sin rosetones.
      const todo = { ancho: m.ancho, alto: m.alto };
      const paso = escala.pasos[escala.completa] ?? escala.pasos[escala.tope] ?? null;
      const cuantos = Math.max(1, Math.min(capacidad(todo, m), paso?.datos ?? ctx.paso, contrato.division(eje, X, { datos: paso?.datos ?? ctx.paso, ...ctx.opciones }).datos));
      centro = nodoCentro(eje, X, pvCentro, ctx, m, todo, { cuantos, datos: paso?.datos ?? ctx.paso });
      laterales = [];
      mapa = {
        completa: { pv: pvCentro, paso: pasoDelArbol(pvCentro, escala.completa, escala), vecinos: [...pvsLaterales, ...pvsCentro].filter((pv) => pv !== pvCentro).map((pv) => ({ pv, etiqueta: contrato.etiqueta(eje, X, pv, ctx.opciones), fila: GEOMETRIA[pv].celda[0], columna: GEOMETRIA[pv].celda[1], centro: CENTROS.includes(pv) })), volver: CENTROS[0] },
        pasos: escala.pasos, matriz: false, columnas: [0, 1, 0], filas: [0, 1, 0], centro: { x: 0, y: 0, ancho: 1, alto: 1 }, puntos: null,
      };
    } else {
      const r = repartir(estado.niveles ?? {}, pvsLaterales, escala, { recientes: estado.recientes ?? [] });
      laterales = pvsLaterales.map((pv) => {
        const guardado = pasoGuardado(estado, pv, escala);
        const efectivo = r.efectivo[pv] ?? guardado;
        const nivel = nivelDePaso(efectivo, escala);
        const caja = r.cajas[pv] ?? null;
        const hueco = caja ? px(caja) : { ancho: m.hueco, alto: m.hueco };
        const cuantos = Math.max(1, Math.min(escala.pasos[efectivo]?.datos ?? 1, capacidad(hueco, m), nivel >= NIVEL.bloque ? ctx.paso : Infinity));
        const n = nodoLateral(eje, X, pv, nivel, ctx, m, hueco, { cuantos });
        return { ...n, pasoDeTamano: pasoDelArbol(pv, guardado, escala), caja, relleno: Boolean(r.matriz && caja), celda: GEOMETRIA[pv].celda, crece: guardado < (escala.completa >= 0 ? escala.completa : escala.tope), mengua: guardado > escala.partida };
      });
      centro = nodoCentro(eje, X, pvCentro, ctx, m, px(r.centro));
      // Los puntitos del foco: los diez PV en su paso, junto a la información del foco; tocarlos sube un paso a todos.
      const puntos = d.pvs.map((pv) => {
        const k = LATERALES.includes(pv) ? pasoGuardado(estado, pv, escala) : null;
        return { pv, etiqueta: contrato.etiqueta(eje, X, pv, ctx.opciones), paso: k === null ? null : pasoDelArbol(pv, k, escala) };
      });
      const niveles = pvsLaterales.map((pv) => pasoGuardado(estado, pv, escala));
      mapa = {
        completa: null, pasos: escala.pasos, matriz: r.matriz, columnas: r.columnas, filas: r.filas, centro: r.centro, reciente: r.reciente,
        puntos: { lista: puntos, sube: niveles.some((k) => k < escala.tope), baja: niveles.some((k) => k > escala.partida) },
      };
    }
  }
  const aro = estado.aro?.X && eje.obtener(estado.aro.X) ? nodoAro(eje, estado.aro.X, yo, ctx) : null;
  const form = estado.formulario?.accion && eje.obtener(estado.formulario.X) ? formulario(eje, estado.formulario.X, estado.formulario.accion, yo, estado.formulario.valores ?? {}, ctx.opciones) : null;
  return {
    tipo: 'carta',
    X,
    yo: yo ?? null,
    idioma,
    disposicion: d.disposicion,
    apilada,
    pvs: d.pvs,
    cargarMas: d.cargarMas,
    medidas: m,
    animado,
    limite,
    colores: contrato.colores(opciones), // epoch.9.5.4: el color de cada PV, un dato de la época
    configuracion,
    // Los interruptores de la barra: las preferencias de dos valores (hoy el pintado, sobrio o animado), cada valor en el idioma.
    interruptores: interruptoresDe(configuracion, ctx.opciones),
    centro,
    centros: pvsCentro,
    laterales,
    mapa,
    // Los rosetones de mi foco; en la pantalla completa de un PV no se ven.
    rosetones: mapa?.completa ? [] : rosetonesDe(eje, yoDatos, ctx, m),
    aro,
    formulario: form ? { ...form, motivos: estado.formulario.motivos ?? [], resultado: estado.formulario.resultado ?? null } : null,
    camino: await caminoDe(eje, X, yo, ctx),
    local: localDe(estado.local, opciones.t),
    tiempo: yoDatos?.tiempo ?? null,
    identidades: eje.identidades().map((id) => ({ id, persona: eje.esPersona(id), alta: eje.alta(id)?.id ?? null })),
    avisos: [],
  };
}
