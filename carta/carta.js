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
import * as exterior from '../src/exterior.js';
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
 * Las medidas de una pantalla (VG, 11-11: el móvil apaisado enseña Mapped y todo cabe sin scroll). `ancho` y `alto` son los
 * píxeles útiles (el alto, sin la barra). En apaisado y bajo (menos de ALTO_BAJO px) el hueco, la tarjeta y la línea se reducen en
 * proporción al alto que queda (con un mínimo), para que la matriz 3 × 3, los rosetones y el centro quepan; en vertical
 * (Sequenced) y en el ordenador son las de siempre (MEDIDAS). Son píxeles de pantalla, no datos del dominio.
 */
export const ALTO_BAJO = 500;
export const FACTOR_MINIMO = 0.6;
export function medidasDePantalla(ancho, alto) {
  const base = { ancho: Math.max(240, ancho), alto: Math.max(320, alto) };
  if (ancho <= alto || base.alto >= ALTO_BAJO) return base;
  const k = Math.max(FACTOR_MINIMO, base.alto / ALTO_BAJO);
  return { ...base, hueco: Math.round(MEDIDAS.hueco * k), tarjeta: Math.round(MEDIDAS.tarjeta * k), linea: Math.round(MEDIDAS.linea * k) };
}

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
/**
 * La marca «◆ verificado» de un registro (contrato.verificado: los tres relojes), solo si lo está; una marca discreta,
 * nunca un dato de la carta: { verificado: true, confirmaciones?, minimas, enFirme? } o {}. `confirmaciones` es la
 * profundidad de su bloque (si el eje conoce alturas) y `enFirme` que alcanza las que pide el eje.
 */
function marcaDeVerificado(eje, X, opciones) {
  const v = contrato.verificado(eje, X, opciones);
  if (!v?.ok) return {};
  return { verificado: true, ...(v.profundidad !== null ? { confirmaciones: v.profundidad } : {}), ...(v.enFirme ? { enFirme: true, minimas: exterior.ajustesDelEje(eje, opciones).confirmaciones } : {}) };
}

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
  const todas = contrato.representaciones(eje, X, opciones).filter(modelos.representacionAdmitida);
  const deHoja = todas.find((r) => r.tamano === 0 && !r.recurso)?.formato ?? null;
  const caben = todas.filter((r) => r.tamano <= (tamano?.tamano ?? 0) && (animado || (!r.recurso && r.formato === deHoja)));
  if (!caben.length) return null;
  return conArchivo(caben.reduce((a, b) => (b.tamano >= a.tamano ? b : a)));
}

/**
 * Una representación con lo que la carta necesita para pintarla (issue #21): `archivo`, el id del archivo adjunto si su
 * recurso es `archivo:<sha256>` (la app lo baja con la clave de lectura); `aislada`, si su formato se pinta solo dentro
 * de un <iframe sandbox> sin scripts (modelos.pintaEnSandbox: SEG-14). Lo decide el núcleo; aquí no se nombra ningún formato.
 */
function conArchivo(r) {
  if (!r) return r;
  const archivo = modelos.idDeArchivo(r.recurso);
  return archivo || modelos.pintaEnSandbox(r.formato) ? { ...r, archivo, aislada: modelos.pintaEnSandbox(r.formato) } : r;
}

/**
 * La representación del foco en el anverso del PV0 (issues #21, #24): la que se pinta aislada (el HTML adjunto: la
 * landing de un proyecto) si la tiene, la última que se adjuntó, en cualquier modo y tamaño; si no, la que cabe
 * (representacionQueCabe: la imagen o el texto).
 */
function representacionDelFoco(eje, X, tamano, ctx) {
  const aisladas = contrato.representaciones(eje, X, ctx.opciones).filter((r) => modelos.pintaEnSandbox(r.formato) && modelos.representacionAdmitida(r));
  return aisladas.length ? conArchivo(aisladas[aisladas.length - 1]) : representacionQueCabe(eje, X, tamano, ctx);
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
    // El arte propio del ocupante primero (#25): un registro con su icono se ve con él; lo demás, el general del mundo.
    return conRecurso(piezaDe(ctx, PIEZA.elemento, pv, m?.nivel ?? null, lado, tamano, { de: m?.de ?? undefined, elemento: X ?? null }));
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
      t: X ? eje.obtener(X).t ?? null : null, // la hora del escrito (la conversación del 3 y las cuentas del 6 y el 7 la enseñan)
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

/**
 * La pieza del modelo para un PV: por tipo, mundo y clave, con la orientación de su lado y el tamaño; `rol` y `de` como en
 * modelos.pieza; null en sobrio. La cadena empieza por el arte propio del `elemento` que se pinta (#25: sus piezas
 * ancladas, modelos.propio; por defecto, el foco X) y sigue con la de quien mira (ctx.cadena: su modelo, el general, el
 * animado genérico, el sobrio). En el pintado «propio» (ctx.soloPropio) no hay cadena detrás: solo se aceptan piezas
 * cuyo origen es el propio elemento, y sin arte propio no se pinta nada (los fondos, muñequitos y dibujos generales, apagados).
 */
function piezaDe(ctx, tipo, pv, clave, lado, tamano, { rol, de, elemento = ctx.X } = {}) {
  if (!ctx.animado) return null;
  const suyo = propioDe(ctx, elemento);
  const cadena = ctx.soloPropio ? (suyo ? [suyo] : []) : suyo ? [suyo, ...ctx.cadena] : ctx.cadena;
  if (!cadena.length) return null;
  const variante = ctx.variantes[lado] ?? ctx.variantes[0];
  const p = modelos.pieza(cadena, tipo, pv, clave, variante, { tamano: tamano?.tamano, rol, de });
  if (!p || (ctx.soloPropio && p.origen !== suyo?.donde)) return null;
  const { crudo: _c, ...plana } = p;
  return plana;
}

/** El arte propio de un registro (modelos.propio), una vez por pintado: null si no es un registro del eje o no lleva. */
function propioDe(ctx, X) {
  const id = esReferencia(X) ? X.ref : X;
  if (typeof id !== 'string' || !ctx.eje) return null;
  ctx.propios ??= new Map();
  if (!ctx.propios.has(id)) ctx.propios.set(id, modelos.propio(ctx.eje, id, ctx.opciones));
  return ctx.propios.get(id);
}

/**
 * El retrato de un elemento: su pieza `elemento` PROPIA (cualquier paso y nombre) en un mundo, o null. Es lo que lo
 * representa allí donde se le ve entero: su ocupante en una celda o banda, y la tarjeta central cuando es el pulsado (#25).
 */
function retratoDe(ctx, elemento, pv, lado, tamano) {
  const suyo = ctx.animado ? propioDe(ctx, elemento) : null;
  if (!suyo) return null;
  const p = modelos.pieza([suyo], PIEZA.elemento, pv, null, ctx.variantes[lado] ?? ctx.variantes[0], { tamano: tamano?.tamano });
  if (!p?.recurso) return null;
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

/**
 * El PV de X bajo el que cuelga una transacción del diario, del núcleo (contrato.pvDeEntrada, encargo «datos3»): el de
 * la posición que modificó (el primer dígito de su «en») o, si se anclaba en la raíz, la posición de su padre a la que
 * se refiere (`{ ref, dir }`); X mismo o lo anclado en su 0, el centro (0); null si no cuelga de X.
 */
function pvDondeCuelga(eje, X, id) {
  return contrato.pvDeEntrada(eje, X, id);
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
  return efectosDeEntradas(ctx, entradas, LATERALES.includes(pv) ? pv : mundoDelCentro, lado, tamano, ctx.X);
}

/** Los efectos de unas entradas nuevas del diario en un mundo (lo que hace nuevosDe para un PV): { entradas, efectos, consumido }. */
function efectosDeEntradas(ctx, entradas, mundo, lado, tamano, elemento = ctx.X) {
  // Lo declarado: sin la asignación de T y la obtención de P (clase) y sin el tiempo que cuesta escribir (la serie T de cada escritura).
  const declarados = entradas.flatMap((e) => e.movimientos.filter((m) => !m.clase && !esDeTiempo(m.serie)));
  const primitivas = [...new Set(declarados.map((m) => m.primitiva))];
  const efectos = primitivas.map((primitiva) => {
    const clave = modelos.corresponde(ctx.cabecera, PIEZA.movimiento, primitiva, mundo);
    return { primitiva, clave, pieza: conRecurso(piezaDe(ctx, PIEZA.movimiento, mundo, clave, lado, tamano, { elemento })) };
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
  const pieza = piezaDe(ctx, PIEZA.munequito, pv, accion, lado, tamano, { rol, elemento: X });
  if (!pieza) return null;
  return { rol, accion, animar, pieza };
}

/**
 * El personaje del sitio X.<lugar> en animado (VG, 12-11, issue #38): el muñeco del elemento (modelos.propio) y, si el
 * nodo no tiene arte propio, el del modelo `general` (la cadena de piezaDe), parado, en el hueco donde en sobrio está el
 * interrogante. → { rol, accion, pieza } o null (sobrio, o sin arte).
 */
function personajeDelSitio(ctx, eje, X, pv, lado) {
  if (!ctx.animado) return null;
  const p = personajeDe(ctx, eje, X, pv, lado, tamanoDeNivel(NIVEL.comprimido, ctx.opciones), { enfocado: false, nuevos: false, paso: null });
  return p?.pieza?.recurso ? { rol: p.rol, accion: p.accion, pieza: p.pieza } : null;
}

/**
 * El sitio de un cuadrante (PV, sub-PV, caja del 3, celda, fila de Sequenced): el nodo X.<lugar>, cuya cruceta abre su
 * interrogante (sobrio) o su muñeco (animado, misma acción y mismo sitio; el muñeco es una capa del botón). → { X, lugar, personaje? }.
 */
function sitioDe(ctx, eje, X, lugar, pv) {
  const s = { X, lugar };
  const personaje = personajeDelSitio(ctx, eje, X, pv, GEOMETRIA[pv]?.lado ?? 0);
  return personaje ? { ...s, personaje } : s;
}

/** El sitio de un hijo (sub-PV, caja o celda) en el nivel de una rejilla: el nodo R.<camino>.<dígito> (hasta ocho dígitos; la cruceta del sitio no admite más). */
function sitioDeHijo(R, pv, base, digito) {
  const camino = [pv, ...(base ?? []), digito];
  return camino.length < 9 && camino.every((k) => Number.isInteger(k) && k >= 0 && k <= 9) ? { X: R, lugar: camino.join('.') } : null;
}

/**
 * El personaje del 0 (VG, 12-11, #38: «la barra superior desaparece»): el sitio 0 de MI alta, con las opciones de lo que
 * era la barra como sus posiciones (quién soy, sobrio o animado, configuración, sincronía…: dom.js htmlSitio). Sin alta
 * (nadie ha entrado), el 0 del propio foco. `general` lo marca para que su cruceta lleve esas opciones.
 */
function sitioCero(eje, ctx, X) {
  const alta = ctx.yo ? eje.alta(ctx.yo)?.id ?? null : null;
  return { ...sitioDe(ctx, eje, alta ?? X, '0', 0), general: true };
}

/**
 * El nodo de un punto de vista lateral de X en su nivel. En Mapped (`mapa`), la carta ya ha medido su caja: `cuantos`
 * son los datos que caben en ella (los del paso, recortados por lo que mide) y `pagina` la que se ve (sin scroll: se
 * pasa de página, no se carga debajo); la disposición de dentro la dice la división de la época también en el grupo.
 */
function nodoLateral(eje, X, pv, nivel, ctx, medidas, hueco, mapa = null, { secuencia = false, rejilla = true } = {}) {
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
  // El personaje del sitio (VG, 12-11, #38): cada cuadrante abierto tiene su responsable, el nodo X.<pv>.
  nodo.sitio = sitioDe(ctx, eje, X, String(pv), pv);
  // Tarjeta y bloque: los ocupantes que caben, paginados por el paso de la configuración (en Mapped, por páginas).
  const cuantos = mapa ? mapa.cuantos : nivel >= NIVEL.bloque ? paso * (ctx.estado.paginas?.[pv] ?? 1) : nodo.tamano?.datos ?? paso;
  const pagina = mapa ? paginaDe(ctx, eje, X, pv, cuantos) : null;
  // Las listas verticales del 6 y el 7 (el hilo de Sequenced, sus bloques de Mapped), en el orden que la época declara
  // para ese mundo (epoch.8.7, VG 11-11 #18: lo más cercano al presente arriba); la carta no ordena, lo pide.
  const vertical = ordenVertical(eje, pv, ctx);
  const o = contrato.ocupantes(eje, X, pv, pagina ? pagina.desde : 0, cuantos, vertical);
  const tipoDato = contrato.tipo(eje, X, pv, ctx.opciones);
  nodo.ocupantes = {
    total: o.total, desde: o.desde, cuantos: o.cuantos, orden: o.orden,
    lista: o.ocupantes.map((x) => nodoOcupante(eje, x, tamanoDeNivel(nivel - 1, ctx.opciones), ctx, tipoDato, { pv, lado: g.lado })),
    cargarMas: !mapa && o.total > o.desde + o.ocupantes.length,
    pagina: pagina ? { actual: pagina.actual, de: pagina.de } : null,
  };
  if (mapa && nivel >= NIVEL.bloque && rejillaCabe(eje, pv, hueco, medidas, ctx.opciones)) {
    nodo.rejilla = rejillaDe(eje, X, pv, ctx, { pagina: ctx.estado.paginas?.[pv] ?? 1, hueco, entrar: false });
  }
  if (secuencia && rejilla && nivel >= NIVEL.bloque) {
    // Sequenced (el móvil en vertical): la fila abierta enseña el segundo nivel del PV como Mapped (rejillaDe: los hijos con
    // su nombre, sus ocupantes y la regla del vacío), entrando y subiendo por estado.profundidad; en una columna si no cabe.
    const r = rejillaDe(eje, X, pv, ctx, { ruta: rutaDe(ctx.estado, eje, pv, ctx.opciones), pagina: ctx.estado.paginas?.[pv] ?? 1, hueco, entrar: true, modo: 'sequenced' });
    if (r) {
      r.enColumna = enColumnaDe(r, medidas, hueco);
      if (r.forma === 'matriz') r.escribir = accionPorDefecto(eje, r.X, pv, ctx);
      nodo.rejilla = r;
    }
  }
  // La regla del vacío también en la lista: sin ocupantes, el paso del camino que la llenaría (Sequenced).
  if (secuencia && !nodo.rejilla && !o.total) Object.assign(nodo, { vacio: true, escribir: accionPorDefecto(eje, X, pv, ctx) });
  if (mapa && nivel < NIVEL.bloque) nodo.disposicion = contrato.division(eje, X, { datos: Math.max(1, o.ocupantes.length || 1), forma: hueco, ...ctx.opciones }).disposicion;
  if (ctx.animado) nodo.personaje = personajeDe(ctx, eje, X, pv, g.lado, nodo.tamano, { enfocado: nivel >= NIVEL.bloque, nuevos: Boolean(nodo.nuevos), paso: propio ?? null });
  if (nivel >= NIVEL.bloque) {
    // Dentro del bloque, lista o matriz según la forma del hueco: lo decide la época (epoch.8.3.2).
    const d = contrato.division(eje, X, { datos: Math.max(1, o.ocupantes.length || 1), forma: hueco, ...ctx.opciones });
    nodo.disposicion = d.disposicion;
    if (ctx.animado) nodo.fondo = fondoDe(ctx, pv, nodo.tamano);
    nodo.munequito = nodo.personaje?.pieza ?? null;
    // Mapped, el bloque en animado (VG, 11-11, #16): como la pantalla completa, capas sobre la misma rejilla sobria
    // (capasDeRejilla): el dibujo del mundo en cada hijo; el fondo, la etapa y el marco los pinta el bloque. Sin
    // personaje (solo a pantalla completa) y lo nuevo, sobre el bloque entero (nodo.nuevos).
    if (ctx.animado && mapa && nodo.rejilla) capasDeRejilla(eje, X, pv, nodo.rejilla, ctx, nodo, nodo.tamano, { personaje: false, efectos: false });
    // Sequenced, la fila abierta en animado (VG, 11-11, #7: «menos sobrecargado, pero algo»): las mismas capas, el dibujo
    // del mundo en cada hijo; el fondo y la etapa los pinta la fila. Sin muñequito ni movimientos (sin efectos por hijo).
    if (ctx.animado && secuencia && nodo.rejilla) capasDeRejilla(eje, X, pv, nodo.rejilla, ctx, nodo, nodo.tamano, { personaje: false, efectos: false });
  }
  // El diario de lo llegado, en el PV del pasado (la cruz, lado del PV1): lo que entró bajo X por llegada.
  if (g.grupo === 'cruz' && g.lado === 1) {
    const d = contrato.diario(eje, X, 0, cuantos, vertical);
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
 * Las opciones con que se piden las listas verticales de un PV: las de siempre más el orden que la época declara para
 * ese mundo (epoch.8.7, la novena posición de su fila: el 6, lo más reciente primero; el 7, lo más próximo primero), si
 * declara alguno. La carta no ordena: pasa el nombre del orden a contrato.ocupantes y contrato.diario.
 */
function ordenVertical(eje, pv, ctx) {
  const orden = contrato.divisionDelMundo(eje, pv, ctx.opciones)?.orden;
  return orden ? { ...ctx.opciones, orden } : ctx.opciones;
}

/**
 * La medida que enseña un PV en la fila de arriba de su carta (VG, 10-11): su paso propio si la tabla de pasos le da
 * uno (epoch.9.8: el 4 su ciclo, el 7 su escala, el 8 su cuota) y, si no, el de todo elemento (la madurez). Así el PV4,
 * el sitio de las acciones, dice en qué etapa del ciclo está y no la medida genérica. → { nombre, k, de, propio } o null.
 */
function medidaDe(ctx, pv) {
  return medidaDePasos(ctx.pasos, pv);
}

/** La medida de un PV con los pasos de un registro cualquiera (pasosPorPv): el paso propio del PV o, si no, el de todo elemento. */
function medidaDePasos(pasos, pv) {
  const propio = pasos.porPv[pv];
  const p = propio && typeof propio.k === 'number' ? propio : pasos.comun;
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
    estilo: estiloDe(eje, X, pv, ctx), // los dos estilos del registro (X.0.9 y X.5.0), saneados: la carta los emite como CSS
    // El personaje del centro (VG, 12-11, #38): el del 0 es la configuración general (la cruceta del 0 de mi alta, donde estaba la barra); el del 5 y el de un PV abierto, sus nodos.
    sitio: g.cara === 'anverso' ? sitioCero(eje, ctx, X) : sitioDe(ctx, eje, X, g.cara === 'reverso' ? '5' : String(pv), pv),
  };
  if (ctx.animado) {
    base.marco = marcoDe(ctx, null, tamano); // el centro no es un mundo: el marco neutro (la comodín)
    base.nuevos = nuevosDe(ctx, pv, g.lado, tamano, ctx.mundoDelCentro);
    base.consumido = Boolean(base.nuevos?.consumido);
  }
  // El anverso (issues #21, #24): arriba la representación del foco (su HTML adjunto si lo tiene) y un solo input, el del 0;
  // los campos de los laterales siguen en el árbol para las filas de Sequenced (en Mapped están en los mundos).
  if (g.cara === 'anverso') return { ...base, representacion: representacionDelFoco(eje, X, tamano, ctx), textoDelFoco: representacionQueCabe(eje, X, tamanoDeNivel(1, ctx.opciones), ctx)?.texto ?? null, campos: camposDe(eje, X, ctx) };
  if (g.cara === 'reverso') {
    const o = contrato.ocupantes(eje, X, pv, 0, ctx.paso, ctx.opciones);
    const tipoDato = contrato.tipo(eje, X, pv, ctx.opciones);
    return {
      ...base,
      ocupantes: { total: o.total, orden: o.orden, lista: o.ocupantes.map((x) => nodoOcupante(eje, x, tamano, ctx, tipoDato, { posicion: pv })) },
      ancla: ev ? { sobre: ev.sobre ?? null, en: ev.en ? dirCorta(ev.en) : '', sobreTexto: ev.sobre ? legibleDe(eje, { ref: ev.sobre }, null, ctx.opciones).texto : null } : null,
      validacion: contrato.validar(eje, X, ctx.opciones),
      // «verificado» (los tres relojes, contrato.verificado): solo si lo está; una marca discreta, nunca un dato de la carta.
      ...marcaDeVerificado(eje, X, ctx.opciones),
    };
  }
  // Un PV lateral abierto como foco: su lista entera (paginada), con la disposición que dice la época para este hueco.
  const cuantos = mapa ? mapa.cuantos : ctx.paso * (ctx.estado.paginas?.[pv] ?? 1);
  const pagina = mapa ? paginaDe(ctx, eje, X, pv, cuantos) : null;
  const o = contrato.ocupantes(eje, X, pv, pagina ? pagina.desde : 0, cuantos, ordenVertical(eje, pv, ctx)); // la lista vertical del 6 y el 7, en su orden (#18)
  const tipoDato = contrato.tipo(eje, X, pv, ctx.opciones);
  const d = contrato.division(eje, X, { datos: mapa ? mapa.datos : Math.max(1, o.ocupantes.length || 1), forma: hueco, ...ctx.opciones });
  const escenario = ctx.animado && LATERALES.includes(pv) ? {
    lado: ctx.variantes[g.lado] ?? ctx.variantes[0] ?? null,
    etapa: etapaDe(ctx, pv, g.lado, tamano),
    marco: marcoDe(ctx, pv, tamano),
    fondo: fondoDe(ctx, pv, tamano),
    personaje: personajeDe(ctx, eje, X, pv, g.lado, tamano, { enfocado: true, nuevos: Boolean(base.nuevos), paso: ctx.pasos.porPv[pv] ?? null }),
  } : {};
  // A pantalla completa, el animado son capas sobre la misma rejilla sobria (capasDeRejilla): el fondo, la etapa, los dibujos, el personaje, los efectos y el marco.
  if (ctx.animado && LATERALES.includes(pv) && mapa?.rejilla) capasDeRejilla(eje, X, pv, mapa.rejilla, ctx, escenario, tamano);
  return {
    ...base,
    ...escenario,
    ocupantes: { total: o.total, desde: o.desde, cuantos: o.cuantos, orden: o.orden, lista: o.ocupantes.map((x) => nodoOcupante(eje, x, tamanoDeNivel(2, ctx.opciones), ctx, tipoDato, { pv, lado: g.lado })), cargarMas: !mapa && o.total > o.desde + o.ocupantes.length, pagina: pagina ? { actual: pagina.actual, de: pagina.de } : null },
    disposicion: d.disposicion,
    division: mapa ? { pvs: d.pvs, datos: d.datos, cargarMas: d.cargarMas } : null,
    rejilla: mapa?.rejilla ?? null,
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

/**
 * Un valor de una opción (contrato.opciones) como lo escribe Pointed (escritura.item): una referencia, «@id» o «@id:dirección»;
 * lo demás, su texto. Lo que se manda al campo (app.js campo) al elegirla.
 */
const textoPointed = (v) => (esReferencia(v) ? '@' + v.ref + (v.dir && v.dir !== '0000000000' ? ':' + v.dir : '') : typeof v === 'string' && /^[0-9a-f]{64}$/.test(v) ? '@' + v : String(v));
/** Las opciones de la posición pv de X (contrato.opciones) como las pinta la carta: { valor (lo que se escribe), texto }. */
const opcionesDe = (eje, X, pv, ctx) => contrato.opciones(eje, X, pv, { yo: ctx.yo, ...ctx.opciones }).map((o) => ({ valor: textoPointed(o.valor), texto: o.texto }));

/**
 * El aro sobre X: ocho sitios, uno por PV lateral, dispuestos como la matriz 3 × 3 sin centro (`celda`: [fila, columna] de
 * GEOMETRIA; el centro es el propio elemento). Cada sitio trae su acción por defecto (`accionPorDefecto`: la primera de
 * acciones.acciones, lo que hace un clic), las demás (`alternativas`) y los valores posibles de su posición (`opciones`:
 * contrato.opciones, para escribirlos): lo que despliega el clic mantenido. `accion` y `otras` son los mismos que
 * `accionPorDefecto` y `alternativas`. El centro es el campo del elemento (su 0): `valor` (lo que dice ahora), `opciones0`
 * (lo que se despliega debajo al editarlo) y `opciones5` (las del 5, su reverso, encima); `editando`, si está en edición
 * (estado.aro.editar). Cada acción, por su id y su nombre en el idioma. El árbol no sabe de píxeles: dónde cae el aro en la
 * pantalla lo calcula la app al abrirlo.
 */
function nodoAro(eje, X, yo, ctx) {
  const abierto = ctx.estado.aro?.pv ?? null;
  const huecos = LATERALES.map((pv) => {
    const lista = acciones.acciones(eje, X, pv, yo, ctx.opciones);
    const porDefecto = lista.find((a) => a.porDefecto) ?? lista[0] ?? null;
    const resumen = (a) => ({ id: a.id, nombre: a.etiqueta, lectura: a.lectura, camino: a.camino, faltan: a.parametros.filter((p) => p.falta && !p.archivo).map((p) => p.etiqueta) }); // lo que sale de subir un archivo no «falta»: lo pone el selector
    const accion = porDefecto ? resumen(porDefecto) : null;
    const otras = lista.filter((a) => a !== porDefecto).map(resumen);
    const opciones = opcionesDe(eje, X, pv, ctx);
    return {
      pv,
      celda: [...GEOMETRIA[pv].celda],
      lado: ctx.variantes[GEOMETRIA[pv].lado] ?? null,
      etiqueta: contrato.etiqueta(eje, X, pv, ctx.opciones),
      accion,
      otras,
      accionPorDefecto: accion,
      alternativas: otras,
      opciones,
      abierto: abierto === pv && (otras.length > 0 || opciones.length > 0),
      icono: piezaDe(ctx, PIEZA.icono, CENTROS[1] ?? 5, pv, GEOMETRIA[pv].lado, tamanoDeNivel(1, ctx.opciones), { elemento: X }),
    };
  });
  const [anverso, reverso] = CENTROS;
  const texto = representacionQueCabe(eje, X, tamanoDeNivel(1, ctx.opciones), ctx)?.texto ?? corto(X);
  const centro = {
    pv: anverso,
    etiqueta: contrato.etiqueta(eje, X, anverso, ctx.opciones),
    valor: texto,
    opciones0: opcionesDe(eje, X, anverso, ctx),
    opciones5: reverso === undefined ? [] : opcionesDe(eje, X, reverso, ctx),
    pv5: reverso ?? null,
    editando: Boolean(ctx.estado.aro?.editar),
  };
  return { X, texto, huecos, centro };
}

/**
 * El aro sobre un hueco vacío (issue #22): un clic mantenido sobre un hijo vacío o el espacio libre de un mundo abre el
 * aro con un input nuevo en el centro; lo que se escriba crea el elemento en la posición `pv` de R (lo escribe la app
 * como cualquier campo, carta/app.js campo). Sin sitios: el elemento aún no existe; al crearlo, la app abre su aro.
 */
function nodoAroNuevo(eje, R, pv, ctx) {
  const etiqueta = contrato.etiqueta(eje, R, pv, ctx.opciones);
  const de = legibleDe(eje, { ref: R }, null, ctx.opciones).texto;
  return {
    X: R, nuevo: true, texto: t('aroNuevoDe', { que: etiqueta, de }), huecos: [],
    centro: { pv, nuevo: true, etiqueta, de, ayuda: contrato.ayuda(eje, R, pv, ctx.opciones), valor: '', opciones0: opcionesDe(eje, R, pv, ctx), opciones5: [], pv5: null, editando: true },
  };
}

/** El idioma de quien mira: el que se pide o el de su configuración (la preferencia «language»). */
const idiomaDe = (eje, yo, opciones) => opciones.idioma ?? contrato.configuracion(eje, yo, opciones).language;

/**
 * Dónde anclará en X el registro que escribe una acción (su 5: el dígito o camino de X), como dirección; null si el camino
 * lleva huecos {parámetro} o el registro donde ancla es otro (una fórmula): entonces no se sabe aún quiénes son sus hermanos.
 */
function anclaDeAccion(plantilla) {
  const [ruta, otro] = hojas(plantilla?.[5]);
  if (otro !== undefined || typeof ruta !== 'string' || !/^\d(\.\d)*$/.test(ruta)) return null;
  return direccion(ruta.split('.').map(Number));
}

/**
 * Las opciones de un parámetro de una acción sobre X (contrato.opciones con `parametro`), como las pinta el formulario:
 * { valor (lo que va en el input: el id de un registro o de una identidad, el texto), texto }. Una referencia a una
 * posición de un registro no se escribe en el input de un tipo simple: no sale.
 */
function opcionesDeParametro(eje, X, p, en, yo, o) {
  return contrato.opciones(eje, X, null, { ...o, yo, parametro: { ...p, ...(en ? { en } : {}) } })
    .filter((x) => !(esReferencia(x.valor) && x.valor.dir && x.valor.dir !== '0000000000'))
    .map((x) => ({ valor: esReferencia(x.valor) ? x.valor.ref : String(x.valor), texto: x.texto }));
}

/**
 * Los campos del formulario de una acción del aro (por su id o su nombre canónico) sobre X para `yo`: cada parámetro
 * con su nombre canónico, su etiqueta y su ayuda en el idioma de yo, tipo, si es requerido, su validación, su valor
 * (el dado, o el defecto que resuelve el núcleo), ese valor legible (contrato.legible) y si su tipo es simple (se
 * edita en texto, contrato.desdeLegible) o se edita en BTML.
 * `opciones` de cada campo: los valores posibles del parámetro (opcionesDeParametro), el desplegable con «otro…» del formulario.
 * → { X, accion (el id), nombre, pv, campos: [{ nombre, etiqueta, tipo, requerido, ayuda, validacion, posicion, valor, legible, simple, falta, opciones }], lectura, camino } o null.
 */
export function formulario(eje, X, accion, yo, valores = {}, opciones = {}) {
  const plantilla = acciones.plantillaDeTransaccion(accion, opciones);
  if (!plantilla) return null;
  const o = { ...opciones, idioma: idiomaDe(eje, yo, opciones) };
  const pv = Number(hojas(plantilla[8])[0]);
  const canonico = acciones.nombreDeAccion(plantilla);
  const ofrecida = acciones.acciones(eje, X, pv, yo, o).find((a) => a.nombre === canonico);
  const defectos = new Map((ofrecida?.parametros ?? []).map((p) => [p.nombre, p.valor]));
  const en = anclaDeAccion(plantilla);
  const campos = acciones.parametros(plantilla, o).map((p) => {
    const valor = valores[p.nombre] !== undefined ? valores[p.nombre] : defectos.get(p.nombre);
    return {
      nombre: p.nombre, etiqueta: p.etiqueta, tipo: p.tipo, requerido: p.requerido, ayuda: p.ayuda, validacion: p.validacion, posicion: p.posicion,
      archivo: acciones.archivoDe(p), // un parámetro que sale de subir un archivo (su referencia o su formato): la app abre el selector
      valor: valor === undefined ? null : valor,
      legible: valor === undefined ? '' : legibleDe(eje, valor, p.tipo, o).texto,
      simple: contrato.esTipoSimple(p.tipo, o),
      falta: p.requerido && valor === undefined,
      opciones: opcionesDeParametro(eje, X, p, en, yo, o),
    };
  });
  const { id, nombre } = accionDe(canonico, o);
  const lectura = acciones.esLectura(plantilla);
  const camino = acciones.esCamino(plantilla);
  return { X, accion: id, nombre, pv, campos, lectura, camino, ofrecida: Boolean(ofrecida), ...(opciones.ejecutar && !lectura && !camino ? { ejecucion: ejecucionDe(eje, X, canonico, yo, valores, o) } : {}) };
}

/**
 * El formulario en modo ejecutar (VG 12-11, decisión 7 de #49): abierto desde una celda del 4 o desde un paso del camino
 * del 9, lleva lo que la transacción exige en T por partes (el coste por posición y lo que la plantilla mueve de T), la
 * denominación que lo cubre (la propuesta del núcleo, o la que parte de la escala elegida en el desplegable de las escalas
 * del calendario: `opciones.ejecutar.escala`) y el estado del botón por el rango de X (contrato.botonDeEjecutar).
 * → { partes, coste, exigido, posiciones, propuesta, denominacion, escala, cubre, alcanza, escalas, boton, motivos } o
 * null si el núcleo no puede calcularlo (los motivos los dará el envío).
 */
function ejecucionDe(eje, X, accion, yo, valores, o) {
  const escala = o.ejecutar?.escala ?? null;
  const e = acciones.ejecucion(eje, accion, { X, ...valores }, yo, { ...o, ...(escala ? { denominacion: escala } : {}) });
  if (!e.ok) return null;
  return {
    partes: e.partes, coste: e.coste, exigido: e.exigido, posiciones: e.posiciones, propuesta: e.propuesta, denominacion: e.denominacion,
    escala: escala ?? e.propuesta.desde, elegida: Boolean(escala), cubre: e.cubre, alcanza: e.alcanza, escalas: e.escalas,
    boton: contrato.botonDeEjecutar(eje, X, o),
  };
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
 * Previsualiza una acción (un paso del camino, encargo «datos3»): construye, firma con `firmar` y valida con
 * acciones.transaccion, como enviar, pero no asienta nada (docs/CONTRATO.md §12.3: transaccion valida sin asentar).
 * → { ok, motivos, movimientos: [texto], lectura?, paso? } con los movimientos de la candidata legibles (de → a, cantidad
 * y serie, en el idioma de yo).
 */
export async function previsualizar(eje, X, accion, valores, yo, firmar, opciones = {}) {
  const r = await acciones.transaccion(eje, accion, { X, ...valores }, yo, { ...opciones, ...(typeof firmar === 'function' ? { firmar } : {}) });
  const o = { ...opciones, idioma: idiomaDe(eje, yo, opciones) };
  const quien = (x) => (x === null || x === undefined ? '∅' : legibleDe(eje, x, ['identity'], o).texto);
  const movimientos = (r.evento?.movimientos ?? []).map((m) => `${quien(m.de)} → ${quien(m.a)} · ${m.cantidad} ${m.token}${m.escala ? ':' + m.escala : m.emisor ? ':' + m.emisor + (m.denominacion ? '/' + m.denominacion : '') : m.ambito ? ':' + String(m.ambito).slice(0, 8) : ''}${m.estado ? ' · ' + m.estado + (m.salida ? ' ' + m.salida : '') : ''}`);
  return { ok: Boolean(r.ok), motivos: r.motivos ?? [], movimientos, ...(r.lectura ? { lectura: r.lectura } : {}), ...(r.paso ? { paso: r.paso } : {}) };
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
 * numero, valor, opciones? }], sobre, en, de }; el modelo (#4) lleva `opciones` (los modelos de la época con
 * recursos, sin el sobrio, [{ valor, texto }]), y también una enumeración de la época (#25: el pintado, sus valores
 * en su orden y en el idioma); el modelo, si solo hay uno, no es un campo: se guarda ese para que la carta la escriba como un registro más, anclado en el 9 del alta
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
  // Las que son una enumeración de la época (#25: el pintado, sobrio, propio o todo) son un desplegable con sus valores.
  const enumeraciones = new Map(contrato.clavesDeConfiguracion(opciones).filter((c) => c.valores?.length >= 2).map((c) => [c.clave, c.valores]));
  // «modelo» (#4): una lista de los modelos de la época con recursos (sin el sobrio); con uno solo, no se pregunta.
  const eleccion = modelos.eleccionDeModelo(opciones);
  const nombres = eleccion.modelos.map((m) => m.nombre);
  const sinRecursos = new Set(modelos.modelosDeLaEpoca(opciones).filter((m) => !modelos.conRecursos(m)).map((m) => m.nombre));
  p.registro.forEach((desc, d) => {
    if (d === 0 || !Array.isArray(desc) || !esDecupla(desc)) return;
    const clave = hojas(desc[0])[0];
    if (!deLaEpoca.has(clave)) { payload[d] = [p.nombre]; return; } // no es una preferencia: el tipo (B4)
    const numero = typeof hojas(defectos[clave])[0] === 'number';
    const dado = valores[clave] !== undefined ? hojas(valores[clave]) : hojas(actual[clave]);
    const limpio = dado.map((v) => (numero && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v)).filter((v) => v !== '' && v !== '-' && v !== undefined && v !== null);
    // Vacía y sin defecto, la posición queda sin escribir (BTML no tiene posiciones vacías).
    let v = limpio.length ? limpio : hojas(defectos[clave]);
    let lista = null;
    if (clave === eleccion.clave && nombres.length) {
      // El sobrio (o un modelo sin recursos de la época) no se elige: vale el defecto si está en la lista, si no el primero.
      const defecto = hojas(defectos[clave]).find((x) => nombres.includes(x)) ?? nombres[0];
      const elegido = typeof v[0] === 'string' && !sinRecursos.has(v[0]) ? v[0] : defecto;
      v = [nombres.length === 1 ? nombres[0] : elegido];
      lista = [...nombres, ...(nombres.includes(v[0]) ? [] : [v[0]])].map((x) => ({ valor: x, texto: T('option ' + x, clave, x) }));
    } else if (enumeraciones.has(clave)) {
      const valoresDe = enumeraciones.get(clave);
      lista = [...valoresDe, ...(v.length && !valoresDe.includes(v[0]) ? [v[0]] : [])].map((x) => ({ valor: x, texto: T('option ' + x, clave, x) }));
    }
    if (v.length) payload[d] = v;
    if (lista && lista.length < 2) return; // un solo paquete de arte: se guarda el que hay y no se pregunta
    campos.push({ pv: d, clave, etiqueta: T('label', clave, clave), ayuda: T('help', clave, hojas(desc[9]).slice(-1)[0] ?? ''), marcador: hojas(defectos[clave]), numero, valor: v.length === 1 ? v[0] : v, ...(lista ? { opciones: lista } : {}) });
  });
  // BTML no tiene huecos: una posición sin valor y sin defecto que queda delante de otra con valor (el servidor, sin dar,
  // delante del eje compartido: con «relay url» de los ajustes del exterior basta el eje) se escribe «-», que se lee como
  // vacío (más abajo); el registro acaba en el último valor.
  while (payload.length && payload[payload.length - 1] === undefined) payload.length -= 1;
  for (let d = 1; d < payload.length; d++) if (payload[d] === undefined) payload[d] = ['-'];
  return { payload, nombre: contrato.texto(eje, contrato.claves.plantilla(p.nombre), o.idioma, { original: p.nombre, epoca: o.epoca }), campos, sobre: alta.id, en: direccion([9]), de: actual.de };
}

/**
 * El pintado de quien mira (#25): la preferencia `render` es una enumeración de la época (epoch.9.3.2, «="sober" in it.2
 * or "own" in it.2 or "animated" in it.2») cuyo ORDEN es el del pintado: el primero (el defecto) no pinta arte; el
 * último, todo (lo propio de cada elemento y, detrás, la cadena de quien mira); los de en medio, solo lo propio de cada
 * elemento. Un valor que la enumeración no tiene y no es el defecto (un registro antiguo) vale como el último.
 * → { animado: se pinta arte, soloPropio: solo el propio }.
 */
function pintadoDe(configuracion, defectos, opciones) {
  const valor = hojas(configuracion.render)[0];
  const defecto = hojas(defectos.render)[0];
  if (valor === undefined || valor === defecto) return { animado: false, soloPropio: false };
  // La enumeración del pintado: la de la preferencia cuyo defecto es el de quien no ha elegido (el carta no escribe su clave).
  const valores = contrato.clavesDeConfiguracion(opciones).find((c) => c.valores?.includes(defecto) && c.valores.includes(valor))?.valores ?? [];
  const k = valores.indexOf(valor);
  return { animado: true, soloPropio: k > 0 && k < valores.length - 1 };
}

/**
 * Los interruptores del 5 del 0 de mi alta (antes, de la barra): cada preferencia de la plantilla «preferences» cuya validación es una enumeración
 * (contrato.clavesDeConfiguracion, `valores`: hoy el pintado, sobrio, propio o todo), con su etiqueta y cada valor en el
 * idioma («template <plantilla> param <clave> option <valor>»), en el orden de la época; `valor` es el que rige. Tocar
 * uno escribe la preferencia como lo hace la configuración (preferencias(), un registro más en el 9 del alta) y repinta.
 */
function interruptoresDe(configuracion, opciones) {
  const p = plantillaDePreferencias(opciones);
  if (!p) return [];
  const T = (que, clave, original) => contrato.texto(null, contrato.claves.parametro(p.nombre, clave, que), opciones.idioma, { original, epoca: opciones.epoca });
  return contrato.clavesDeConfiguracion(opciones).filter((c) => c.valores?.length >= 2).map((c) => ({
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
 * como foco; los tamaños y los recientes no cambian, así que volver deja el 3×3 como estaba). Si al crecer los PV de su fila (al ensanchar) o de su columna (al alargar) ya no caben juntos, sin contar
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
  // Pasar del tope es entrar en el PV, no un toque de tamaño (#17): el 3×3 queda como estaba, y al volver cada PV tiene
  // su caja de antes. Si entrar contara como «el más reciente», al volver ese PV ganaría lo suyo en su fila y su
  // columna y encogería a los demás (ir al 7 y volver vaciaba el 4, y al revés).
  if (escala.completa >= 0 && nuevo >= escala.completa) return { niveles: { ...(estado?.niveles ?? {}) }, recientes: [...(estado?.recientes ?? [])], completa: true };
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
const esPvDelPasado = (pv) => GEOMETRIA[pv]?.grupo === 'cruz' && GEOMETRIA[pv]?.lado === 1;

/**
 * Los pasos por los que se ha bajado en la rejilla de un PV (estado.profundidad[pv]), sin pasar de su profundidad: el id
 * de un registro en el que se entró (o { X, d }, con el dígito de la celda donde estaba) o { d }, un dígito por el que se
 * bajó dentro del mismo registro (encargo «lecturas»: 1 → 1.1 → 1.1.1 → 1.1.1.1). Lo que no existe se salta.
 */
function rutaDe(estado, eje, pv, opciones) {
  const d = contrato.divisionDelMundo(eje, pv, opciones);
  const tope = Math.max(0, (d?.profundidad ?? 1) - 1);
  const ruta = [];
  for (const p of estado.profundidad?.[pv] ?? []) {
    if (ruta.length >= tope) break;
    const paso = typeof p === 'string' ? { X: p, d: null } : p && typeof p === 'object' ? { X: typeof p.X === 'string' ? p.X : null, d: Number.isInteger(p.d) ? p.d : null } : null;
    if (paso && (paso.X ? eje.obtener(paso.X) : paso.d !== null)) ruta.push(paso);
  }
  return ruta;
}

/**
 * Dónde está la rejilla tras bajar por `ruta` (encargo «lecturas», issue #12): el registro que se divide (R: el último en
 * que se entró, o X), los dígitos bajados dentro de él (`base`: sus hijos son R.<base>.<dígito>) y la dirección entera
 * desde X (`direccion`: el mundo y el dígito de cada nivel, con la que se lee lo derivado), o null si un registro en que
 * se entró no dice en qué celda estaba y no se encuentra entre lo anclado.
 */
function lugarDe(eje, X, pv, ruta, ctx) {
  let R = X;
  let base = [];
  let direccion = [pv];
  ruta.forEach((p, i) => {
    if (!p.X) { base = [...base, p.d]; if (direccion) direccion = [...direccion, p.d]; return; }
    let d = p.d;
    if (d === null) {
      const hijos = contrato.divisionDelMundo(eje, pv, { nivel: i + 1, ...ctx.opciones })?.hijos ?? [];
      d = hijos.find((k) => contrato.ocupantes(eje, R, [...base, k], 0, Infinity, ctx.opciones).ocupantes.some((o) => o?.ref === p.X)) ?? null;
    }
    direccion = direccion && d !== null ? [...direccion, d] : null;
    R = p.X;
    base = [];
  });
  return { R, base, direccion };
}

/**
 * La geometría de las celdas de un nivel: sale de su forma (epoch.8.7) y de sus hijos, no de un número escrito. Una
 * tabla por forma, con la geometría y cómo se colocan sus celdas (las formas sobrias del segundo nivel, VG 10-11
 * noche, mockup v3). cruceta: las cuatro esquinas (2 × 2) y el pulsado como tarjeta central flotante encima del
 * cruce; escalera y conversación: una columna de hijos; columnas: una por hijo, cada una con el nivel siguiente dentro;
 * rejilla: tres columnas (3 × 2 con seis hijos); matriz: 10 × 10 con sus dos ejes nombrados; franjas: una columna por
 * escala de T que mide el calendario y una fila por hilo (más la de los nombres); cielo y camino: las diez cajas
 * nivel.grado en dos filas. Lo que no está aquí (la lente, el JSON) no se divide.
 */
const enColumnas = (columnas, minimo = 1) => (d) => (d.hijos.length ? { columnas, filas: Math.max(minimo, Math.ceil(d.hijos.length / columnas)) } : null);
const unaColumna = (d) => (d.hijos.length ? { columnas: 1, filas: d.hijos.length } : null);
const porFranjas = (d) => (d.bandas?.length ? { columnas: d.bandas.length, filas: Math.max(1, d.hilos?.length ?? 0) + 1 } : null);
const enDosFilas = (d) => (d.bandas?.length ? { columnas: Math.ceil(d.bandas.length / Math.min(2, d.bandas.length)), filas: Math.min(2, d.bandas.length) } : null);
const FORMAS = {
  cruceta: { geometria: enColumnas(2, 2), celdas: celdasDeHijos, flotante: true },
  escalera: { geometria: unaColumna, celdas: celdasDeHijos },
  conversacion: { geometria: unaColumna, celdas: (...a) => celdasDeConversacion(...a) },
  columnas: { geometria: (d) => (d.hijos.length ? { columnas: d.hijos.length, filas: 1 } : null), celdas: celdasDeHijos, siguiente: true },
  rejilla: { geometria: enColumnas(3), celdas: celdasDeHijos },
  matriz: { geometria: () => ({ columnas: 10, filas: 10 }), celdas: celdasDeMatriz },
  franjas: { geometria: porFranjas, celdas: franjasDeRejilla, alReves: true },
  cielo: { geometria: enDosFilas, celdas: cieloDeRejilla },
  camino: { geometria: enDosFilas, celdas: caminoDeRejilla },
};
const geometriaDe = (d) => FORMAS[d.forma]?.geometria(d) ?? null;
/** Lo que mide la fila del 3 por tema (encargo pv3): sus hijos son cajas de personas. */
const MIDE_GRUPOS = 'groups';

/** Las posiciones de un registro (los dígitos de la geometría, del 0 al 9). */
const POSICIONES = Object.freeze(Object.keys(GEOMETRIA).map(Number).sort((a, b) => a - b));

/** El estilo propio y el de los de abajo de X (los dos datos, ya saneados; contrato.estilo), una sola vez por registro y mundo. */
function estiloDe(eje, X, pv, ctx) {
  const memo = (ctx.estilos ??= new Map());
  const clave = X + '|' + pv;
  if (!memo.has(clave)) memo.set(clave, { propio: contrato.estilo(eje, X, { de: 'propio', ...ctx.opciones }), hijos: contrato.estilo(eje, X, { de: 'hijos', pv, ...ctx.opciones }) });
  return memo.get(clave);
}

/** ¿Tiene X algo que enseñar al entrar en él en el mundo `pv` (a ese nivel)? La regla del vacío: si todos sus hijos están vacíos, no se baja. */
const tieneHijos = (eje, X, pv, nivel, ctx) => contrato.hijosDe(eje, X, pv, { nivel, cuantos: 1, ...ctx.opciones }).some((h) => !h.vacio);

/**
 * La acción por defecto del punto de vista `pv` sobre R (acciones.acciones: la primera cuya condición pasa para quien
 * mira), con su nombre en el idioma: la que llenaría un hueco vacío (el paso del camino «escribir aquí · …» de la regla
 * del vacío). null si no hay ninguna. Una vez por registro y PV.
 */
function accionPorDefecto(eje, R, pv, ctx) {
  const memo = (ctx.porDefecto ??= new Map());
  const clave = R + '|' + pv;
  if (!memo.has(clave)) {
    const lista = typeof R === 'string' && eje.obtener(R) ? acciones.acciones(eje, R, pv, ctx.yo, ctx.opciones) : [];
    const a = lista.find((x) => x.porDefecto) ?? lista[0] ?? null;
    memo.set(clave, a ? { id: a.id, nombre: a.etiqueta } : null);
  }
  return memo.get(clave);
}

/**
 * El contexto con que se piden los nodos de la rejilla: siempre el sobrio. La forma del segundo nivel es la misma en
 * sobrio y en animado (el animado son solo capas añadidas sobre este mismo DOM, capasDeRejilla), así que sus ocupantes no llevan la
 * pieza suelta del mundo ni una representación con recurso.
 */
const sobrioDe = (ctx) => (ctx.animado ? (ctx.comoSobrio ??= { ...ctx, animado: false, cadena: [] }) : ctx);

/** Los ocupantes de una celda como nodos; cada uno que es un registro con algo dentro entra (mientras queden niveles). */
function nodosDeCelda(eje, R, ocupantes, pv, digito, d, ctx, entrar, base = []) {
  const tipoDato = contrato.tipo(eje, R, base.length ? [...base, digito] : digito, ctx.opciones);
  const sobrio = sobrioDe(ctx);
  return ocupantes.map((x) => {
    const n = nodoOcupante(eje, x, tamanoDeNivel(2, ctx.opciones), sobrio, tipoDato, { pv: digito, lado: GEOMETRIA[digito]?.lado ?? 0, posicion: digito, anidar: 0 });
    n.entra = Boolean(entrar && d.entra && n.tipo === 'referencia' && n.X && tieneHijos(eje, n.X, pv, d.nivel + 1, ctx));
    if (n.X) n.estilo = estiloDe(eje, n.X, pv, ctx);
    return n;
  });
}

/**
 * Lo derivado de una celda (contrato.hijosDe con la dirección: contrato.leerRuta), como nodos con su marca: `derivado` y
 * `por`, la cadena de lecturas que lo justifica («1 cuánto › 3 con quién»), tal cual la da el núcleo. No se entra en ellos.
 * `relacion` (VG 12-11: el 4 distingue lo directo de lo heredado; el 6, el hilo del diario) sale del `nivel` que da el
 * núcleo en el último paso: «arriba» (su hilo), «directo» (colgado del nodo) o «heredado» (más abajo).
 */
function derivadosDeCelda(eje, h, ctx) {
  const sobrio = sobrioDe(ctx);
  const relacionDe = (n) => (typeof n !== 'number' || n === 0 ? null : n < 0 ? 'arriba' : n === 1 ? 'directo' : 'heredado');
  return (h.derivados ?? []).map((x) => ({
    ...nodoOcupante(eje, x.valor, tamanoDeNivel(2, ctx.opciones), sobrio, null, { pv: h.digito, lado: GEOMETRIA[h.digito]?.lado ?? 0, posicion: h.digito, anidar: 0 }),
    derivado: true,
    por: x.por.map((p) => p.pv + ' ' + (p.nombre ?? p.regla)).join(' › '),
    relacion: relacionDe(x.por[x.por.length - 1]?.nivel),
    entra: false,
  }));
}

/** Los hijos del nivel siguiente de un registro (contrato.hijosDe al nivel + 1), solo su nombre y cuántos tiene; los vacíos, con su paso del camino. */
function hijosSiguientes(eje, X, pv, nivel, ctx) {
  return contrato.hijosDe(eje, X, pv, { nivel, cuantos: 0, ...ctx.opciones }).map((h) => ({
    digito: h.digito, nombre: h.nombre, total: h.total, vacio: h.vacio, escribir: h.vacio ? accionPorDefecto(eje, X, h.digito, ctx) : null,
  }));
}

/**
 * La tarjeta central flotante de la cruceta: el elemento pulsado (R) encima del cruce. Su cara 0 es su nombre (el
 * legible del núcleo) y su medida en este mundo (el paso propio del PV o la madurez; con `de`, la barra); su cara 5,
 * el reverso del centro: la plantilla, el ancla y los pasos.
 */
function centroFlotante(eje, R, pv, ctx) {
  const ev = eventoDe(eje, R);
  const pasos = R === ctx.X ? ctx.pasos : pasosPorPv(eje, R, ctx.opciones);
  return {
    X: R,
    pv,
    texto: legibleDe(eje, { ref: R }, null, ctx.opciones).texto,
    etiqueta: contrato.etiqueta(eje, R, pv, ctx.opciones),
    medida: medidaDePasos(pasos, pv),
    plantilla: nombreDePlantillaDe(eje, R, ctx),
    ancla: ev ? { sobre: ev.sobre ?? null, en: ev.en ? dirCorta(ev.en) : '', sobreTexto: ev.sobre ? legibleDe(eje, { ref: ev.sobre }, null, ctx.opciones).texto : null } : null,
    pasos: [...Object.values(pasos.porPv), ...(pasos.comun ? [pasos.comun] : [])],
  };
}

/**
 * Lo que el núcleo mide de un hijo (contrato.hijosDe, encargo «datos», issue #11), tal cual: en el 2, el P de su mirada
 * (`votos`: comprometidos y reposicionables, si hay alguno) y, si el criterio del dueño dice esa mirada, el recuento
 * (`meta`: umbral, valor, pasa, faltan); en el 3, el precio de su zona de atención (`precio`). En el 1 (encargo
 * «datos2»): el coste (`coste`), la capacidad con lo comprometido y lo disponible (`capacidad`) y lo que entra y sale
 * por serie (`flujo`: [{ serie, texto, entra, sale }], el nombre de la serie, legible). Nada si no lo da.
 */
function medidaDeHijo(h, eje, ctx) {
  const m = {};
  if ((h.comprometidos ?? 0) + (h.reposicionables ?? 0) > 0) m.votos = { comprometidos: h.comprometidos, reposicionables: h.reposicionables };
  if (typeof h.umbral === 'number') m.meta = { umbral: h.umbral, valor: h.valor, pasa: h.pasa, faltan: h.faltan };
  if (h.precio) m.precio = h.precio;
  if (h.coste) m.coste = h.coste;
  if (typeof h.capacidad === 'number') m.capacidad = { capacidad: h.capacidad, comprometido: h.comprometido, disponible: h.disponible, franja: h.franja ?? '' };
  if ((h.entradas?.length ?? 0) + (h.salidas?.length ?? 0) > 0) {
    const filas = new Map();
    const fila = (serie) => filas.get(serie) ?? filas.set(serie, { serie, texto: legibleDe(eje, serie, null, ctx.opciones).texto || serie, entra: 0, sale: 0 }).get(serie);
    for (const x of h.entradas ?? []) fila(x.serie).entra = x.cantidad;
    for (const x of h.salidas ?? []) fila(x.serie).sale = x.cantidad;
    m.flujo = [...filas.values()];
  }
  return m;
}

/**
 * Las celdas de un nivel con hijos (cruceta, escalera, columnas, rejilla, conversación): una por hijo, con su nombre a
 * esa profundidad y sus ocupantes (contrato.hijosDe). Un hijo sin ocupantes es `vacio`: se pinta con su nombre
 * apagado, no se entra y lleva `escribir`, la acción por defecto de su PV (el paso del camino que lo llenaría). Cada
 * celda lleva el dígito del hijo (`pv`) y, de él, el color. En la cruceta, además, la tarjeta central (`flotante`); en
 * las columnas, dentro de cada una, el nivel siguiente de cada ocupante que es un registro (`siguiente`).
 */
function celdasDeHijos(eje, R, pv, d, g, ctx, { entrar, base = [], direccion = null, raiz = R }) {
  const forma = FORMAS[d.forma];
  const celdas = contrato.hijosDe(eje, R, pv, { nivel: d.nivel, cuantos: ctx.paso, base, filtros: ctx.estado?.filtrosDelTres ?? {}, ...(direccion ? { direccion, raiz } : {}), ...ctx.opciones }).map((h, i) => {
    // El 3 por tema (encargo pv3): la caja es de personas, cada una con su marcador (doy, recibo) y, al entrar, su conversación.
    if (h.personas) return celdaDeCaja(eje, R, pv, d, g, h, i, ctx, entrar, base);
    const ocupantes = nodosDeCelda(eje, R, h.ocupantes, pv, h.digito, d, ctx, entrar && !h.vacio, base);
    // Lo que el núcleo mide de cada hijo (encargo «datos», issue #11): el estado de cada paquete del 3, en su ocupante.
    if (h.estados) ocupantes.forEach((o, k) => { if (h.estados[k]) o.estado = h.estados[k]; });
    const celda = { fila: Math.floor(i / g.columnas), columna: i % g.columnas, pv: h.digito, nombre: h.nombre, vacio: h.vacio, total: h.total, ocupantes, ocupante: ocupantes[0] ?? null, entra: ocupantes.some((o) => o.entra), escribir: h.vacio ? accionPorDefecto(eje, R, h.digito, ctx) : null, sitio: sitioDeHijo(R, pv, base, h.digito), ...medidaDeHijo(h, eje, ctx) };
    // Lo que deriva del libro (encargo «lecturas»), detrás de lo anclado: la misma forma, con su marca y su porqué.
    if (h.derivados?.length) { celda.derivados = derivadosDeCelda(eje, h, ctx); celda.totalDerivados = h.totalDerivados; }
    // Bajar por el dígito (encargo «lecturas»): la celda se divide a su vez, R.<base>.<dígito>, mientras queden niveles.
    if (entrar && d.entra && !h.vacio) celda.bajar = h.digito;
    if (forma.siguiente) celda.siguiente = ocupantes.filter((o) => o.tipo === 'referencia' && o.X).map((o) => ({ X: o.X, texto: o.texto, hijos: hijosSiguientes(eje, o.X, pv, d.nivel + 1, ctx) }));
    return celda;
  });
  return { celdas, vacia: celdas.every((c) => c.vacio), pagina: null, ...(forma.flotante ? { flotante: centroFlotante(eje, R, pv, ctx) } : {}) };
}

/**
 * Una caja del 3 por tema (encargo pv3, VG 12-11; contrato.hijosDe con «groups»): las personas que caen en ella, en el
 * orden del núcleo (primero quienes tienen R mía, luego quienes usan la suya), cada una con su marcador (`doy`, `recibo`:
 * el canal de R de la pareja); un clic entra en su conversación (su alta, con el dígito de la caja), mantener abre el aro
 * de su alta y arrastrarla a otra caja la reclasifica (la app: «move to group»). La caja lleva el botón que cicla (`filtro`:
 * todos, doy, recibo), sus mínimos (`minimo`, `fuera`: cuántos cayeron al 0) y su sitio, el nodo R.3.d (el interrogante
 * que abre su cruceta). En la caja no se baja por el dígito: dentro hay personas, no lo anclado.
 */
function celdaDeCaja(eje, R, pv, d, g, h, i, ctx, entrar, base = []) {
  const personas = h.personas.map((p) => ({
    tipo: 'persona', identidad: p.identidad, texto: p.texto, X: p.alta, pv: h.digito, caja: h.digito, doy: p.doy, recibo: p.recibo, porque: p.porque, cae: p.cae ?? null,
    entra: Boolean(entrar && d.entra && p.alta),
  }));
  return {
    fila: Math.floor(i / g.columnas), columna: i % g.columnas, pv: h.digito, caja: h.digito, nombre: h.nombre, vacio: h.vacio, total: h.total,
    ocupantes: [], ocupante: null, personas, entra: personas.some((p) => p.entra), escribir: null,
    filtro: h.filtro, minimo: h.minimo, fuera: h.fuera, rangoPendiente: h.rangoPendiente, sitio: sitioDeHijo(R, pv, base, h.digito),
  };
}

/** Los nombres de las capas de la conversación con una persona (textos de la interfaz): 0 el chat, 1 recursos, 2 criterios, 3 favoritos, 4 trabajo. */
const CAPAS = Object.freeze({ 0: 'capaChat', 1: 'capaRecursos', 2: 'capaCriterios', 3: 'capaFavoritos', 4: 'capaTrabajo' });

/**
 * La conversación del 3 con una persona (encargo pv3; contrato.conversacionDelTres): R es el alta de la persona en la
 * que se entró desde su caja (el dígito de la caja es el último de la dirección); una celda por capa, en una columna: el
 * chat (cada mensaje con su autor, su hora y el estado de su paquete) y, acumulativo del 4 hacia el 1 según la caja, el
 * trabajo, los favoritos, los criterios y los recursos compartidos (con el aro sobre cada uno). Sin «groups» en lo que
 * mide la fila, la conversación de siempre (celdasDeHijos).
 */
function celdasDeConversacion(eje, R, pv, d, g, ctx, opciones) {
  const { raiz = R, direccion = null } = opciones;
  if (!d.mide?.includes(MIDE_GRUPOS) || raiz === R) return celdasDeHijos(eje, R, pv, d, g, ctx, opciones);
  const caja = Array.isArray(direccion) && direccion.length > 1 ? direccion[direccion.length - 1] : undefined;
  const c = contrato.conversacionDelTres(eje, raiz, R, { caja, ...ctx.opciones });
  if (!c) return celdasDeHijos(eje, R, pv, d, g, ctx, opciones);
  const sobrio = sobrioDe(ctx);
  const celdas = c.capas.map((k, i) => {
    const ocupantes = k.items.map((it) => ({ ...nodoOcupante(eje, { ref: it.ref }, tamanoDeNivel(2, ctx.opciones), sobrio, null, { pv: k.capa, lado: GEOMETRIA[k.capa]?.lado ?? 0, posicion: k.capa, anidar: 0 }), ...(it.estado ? { estado: it.estado } : {}), entra: false }));
    return { fila: i, columna: 0, pv: k.capa, capaDelTres: k.capa, nombre: t(CAPAS[k.capa]), vacio: ocupantes.length === 0, total: ocupantes.length, ocupantes, ocupante: ocupantes[0] ?? null, entra: false, escribir: null };
  });
  return { celdas, vacia: celdas.every((x) => x.vacio), pagina: null, columnas: 1, filas: Math.max(1, celdas.length), persona: { identidad: c.persona, texto: c.texto, caja: c.caja, nombre: c.nombre, alta: R } };
}

/**
 * El personaje del sitio (encargo pv3, VG 12-11, issue #38): la cruceta del propio nodo X.<lugar> (acciones.sitio), con
 * sus diez posiciones en la geometría de la cruz (1-4 en las esquinas, 6-9 en la cruz, 0 y 5 en el centro), cada una
 * con su nombre, su valor y la acción que la configura (la app abre su formulario con los parámetros del sitio).
 */
function nodoSitio(eje, s, yo, ctx) {
  const n = acciones.sitio(eje, s.X, s.lugar, yo, ctx.opciones);
  if (!n) return null;
  return {
    X: n.X, lugar: n.direccion, general: Boolean(s.general), texto: legibleDe(eje, { ref: n.X }, null, ctx.opciones).texto,
    posiciones: n.posiciones.map((p) => ({ ...p, valor: p.valor.map(String).join(' · '), celda: GEOMETRIA[p.posicion].celda })),
  };
}

/**
 * El estado de cada anuncio del 4 de R por las estaciones de la fábrica (acciones.estaciones): «ejecutada» lo que ya
 * pasó, «autorizada» lo pendiente que su estación da por autorizado (encargo «datos2», issue #11: el recuento del
 * anuncio pasa), «propuesta» lo demás anunciado y pendiente.
 */
function estadosDeEstaciones(eje, R, ctx) {
  const estados = new Map();
  for (const e of acciones.estaciones(eje, R, ctx.opciones)) {
    for (const id of e.pendientes) estados.set(id, (e.autorizados ?? []).includes(id) ? 'autorizada' : 'propuesta');
    for (const id of e.hechos) estados.set(id, 'ejecutada');
  }
  return estados;
}

/** El estado de una celda de la matriz: el de sus ejecuciones si todas dicen el mismo; si no, ninguno (cada una lleva el suyo). */
function estadoDeCelda(nodos) {
  const estados = [...new Set(nodos.map((n) => n.estado ?? null))];
  return estados.length === 1 ? estados[0] : null;
}

/** Cuántos movimientos enseña una celda abierta de la matriz del 4 (VG 12-11, #49.8: «hasta diez»); los demás, contados. */
const EJECUCIONES_EN_CELDA_ABIERTA = 10;

/**
 * La matriz 10 × 10 del 4, con sus dos ejes nombrados y la diagonal marcada. Encargo «el4» (VG 12-11, #41): si la fila de
 * la época mide la ejecución («execution» en lo que mide, epoch.8.7), las filas son los oficios y las columnas la
 * ejecución, con sus nombres de la época (`d.ejes`, contrato.ejesDeLaMatriz, en el idioma), cada ejecución de la fábrica
 * de R va en la celda de su oficio y de lo que mueve (acciones.ejecuciones: `oficio`, `ejecucion`) y la diagonal son las
 * celdas de la escalera dulce (contrato.escalera: la fila k con la columna k+1 (la 9 con la 0)), cada una con su peldaño (`escalon`). La
 * celda es su lista, cada una con su estación (propuesta, autorizada, ejecutada); pulsarla la abre (`estado.celdaMatriz`
 * de R, a pantalla completa): `abierta`, su lista hasta diez, con su estación, y cuántas más. Lo que el núcleo no sabe
 * colocar va aparte, en la fila «sin posición» (`sinPosicion`), sin inventar celda. Sin ejes pero con «pv» en lo que mide
 * (encargo «datos2»), como antes: columnas = el PV de la plantilla, filas = la posición que modifica. Sin una cosa ni
 * otra, los ocupantes del PV van por orden, por filas, en páginas de matrices enteras («‹ n de m ›»).
 */
function celdasDeMatriz(eje, R, pv, d, g, ctx, { pagina, entrar }) {
  const conEjes = Boolean(d.ejes?.filas?.length && d.ejes?.columnas?.length);
  const escalones = new Map((conEjes ? contrato.escalera(ctx.opciones) : []).map((p) => [p.fila + '.' + p.columna, p]));
  const celdas = [];
  // Con ejes, el orden de pintado es el de los ejes (filas 0 … 9, columnas 1 … 9 y el 0 al final: la escalera baja por la diagonal visual); sin ellos, 0 … 9.
  const digitosDe = (eje_, n) => (conEjes ? eje_.slice(0, n).map((x) => x.indice) : Array.from({ length: n }, (_, k) => k));
  for (const fila of digitosDe(d.ejes?.filas ?? [], g.filas)) {
    for (const columna of digitosDe(d.ejes?.columnas ?? [], g.columnas)) {
      const p = escalones.get(fila + '.' + columna);
      celdas.push({ fila, columna, pv, ocupantes: [], ocupante: null, entra: false, diagonal: conEjes ? Boolean(p) : fila === columna, estado: null, ...(p ? { escalon: { peldano: p.indice, nivel: p.nivel, grado: p.grado, nombre: p.nombre, direccion: p.direccion } } : {}) });
    }
  }
  const ejes = conEjes
    ? {
      columnas: d.ejes.columnas.slice(0, g.columnas).map((c) => ({ pv: c.indice, etiqueta: c.texto ?? c.nombre })),
      filas: d.ejes.filas.slice(0, g.filas).map((f) => ({ digito: f.indice, nombre: f.texto ?? f.nombre })),
      oficios: true,
    }
    : {
      columnas: POSICIONES.slice(0, g.columnas).map((k) => ({ pv: k, etiqueta: contrato.etiqueta(eje, null, k, ctx.opciones) })),
      filas: POSICIONES.slice(0, g.filas).map((k) => ({ digito: k, nombre: contrato.etiqueta(eje, null, [0, k], ctx.opciones) })),
    };
  if (conEjes || (d.mide ?? []).includes('pv')) {
    const lista = acciones.ejecuciones(eje, R, ctx.opciones);
    const nodos = nodosDeCelda(eje, R, lista.map((x) => x.ocupante), pv, pv, d, ctx, entrar);
    const sinPosicion = [];
    lista.forEach((x, i) => {
      const n = nodos[i];
      n.estado = x.estacion;
      n.accion = x.accion;
      if (n.X) Object.assign(n, marcaDeVerificado(eje, n.X, ctx.opciones));
      const [fila, columna] = conEjes ? [x.oficio, x.ejecucion] : [x.posicion, x.pv];
      const celda = fila === null || fila === undefined || columna === null || columna === undefined ? null : celdas.find((c) => c.fila === fila && c.columna === columna);
      if (celda) celda.ocupantes.push(n);
      else sinPosicion.push(n);
    });
    for (const c of celdas) {
      c.ocupante = c.ocupantes[0] ?? null;
      c.entra = c.ocupantes.some((n) => n.entra);
      c.estado = c.ocupantes.length ? estadoDeCelda(c.ocupantes) : null;
      c.total = c.ocupantes.length;
      if (conEjes && entrar && c.total) c.abrir = c.fila + '.' + c.columna;
    }
    // La celda abierta (VG 12-11, #49.8): su lista de movimientos, hasta diez, cada uno con el color de su estación.
    const pedida = conEjes && entrar && ctx.estado?.celdaMatriz?.X === R ? celdas.find((c) => c.abrir && c.abrir === ctx.estado.celdaMatriz.celda) : null;
    const abierta = pedida
      ? { fila: pedida.fila, columna: pedida.columna, oficio: ejes.filas.find((f) => f.digito === pedida.fila)?.nombre ?? null, ejecucion: ejes.columnas.find((k) => k.pv === pedida.columna)?.etiqueta ?? null, lista: pedida.ocupantes.slice(0, EJECUCIONES_EN_CELDA_ABIERTA), mas: Math.max(0, pedida.total - EJECUCIONES_EN_CELDA_ABIERTA), escalon: pedida.escalon ?? null, ...ejecutarEnCelda(eje, R, pedida, ctx) }
      : null;
    return { celdas, ejes, sinPosicion, pagina: { actual: 1, de: 1 }, ...(abierta ? { abierta } : {}) };
  }
  const de = Math.max(1, Math.ceil(contrato.ocupantes(eje, R, pv, 0, 0, ctx.opciones).total / celdas.length));
  const actual = Math.min(Math.max(1, pagina), de);
  const o = contrato.ocupantes(eje, R, pv, (actual - 1) * celdas.length, celdas.length, ctx.opciones);
  const nodos = nodosDeCelda(eje, R, o.ocupantes, pv, pv, d, ctx, entrar);
  const estados = nodos.some((n) => n.X) ? estadosDeEstaciones(eje, R, ctx) : new Map();
  nodos.forEach((n, i) => { celdas[i].ocupantes = [n]; celdas[i].ocupante = n; celdas[i].entra = n.entra; celdas[i].estado = (n.X && estados.get(n.X)) ?? null; });
  return { celdas, ejes, pagina: { actual, de } };
}

/**
 * Lo que se reparte en las franjas del 6 y el 7: los ocupantes del PV que son registros; en el pasado (el 6), las
 * entradas del diario; en el futuro (el 7), lo que lee el PV (contrato.leer, encargo «datos3»: lo anclado en su 7 y lo
 * que en el subárbol se refiere a una fecha, por esa fecha); si no hay nada de eso, lo que cuelga de R (su hilo).
 * → [{ id, nodo }], cada nodo con el estado de su futuro si lo tiene.
 */
function itemsDeBandas(eje, R, pv, ctx) {
  const items = [];
  const total = contrato.ocupantes(eje, R, pv, 0, 0, ctx.opciones).total;
  const todos = esPvDelPasado(pv) ? contrato.ocupantes(eje, R, pv, 0, Math.max(1, total), ctx.opciones).ocupantes : contrato.leer(eje, R, pv, { ...ctx.opciones, yo: ctx.yo ?? undefined }).lista.map((x) => x.valor);
  const tipoDato = contrato.tipo(eje, R, pv, ctx.opciones);
  const sobrio = sobrioDe(ctx);
  const nodoRef = (x) => nodoOcupante(eje, x, tamanoDeNivel(2, ctx.opciones), sobrio, tipoDato, { pv, lado: GEOMETRIA[pv]?.lado ?? 0, posicion: pv, anidar: 0 });
  const conEstado = (id, nodo) => { const e = contrato.estadoDeEntrada(eje, id, ctx.opciones); return e ? { ...nodo, estado: e } : nodo; };
  for (const x of todos) if (esReferencia(x) && eje.obtener(x.ref)) items.push({ id: x.ref, nodo: conEstado(x.ref, nodoRef(x)) });
  if (esPvDelPasado(pv)) {
    for (const e of contrato.diario(eje, R, 0, 1e9, ctx.opciones).entradas) {
      const m = e.movimientos.map((a) => a.primitiva + ' ' + legibleDe(eje, a, null, ctx.opciones).texto).join(' · ');
      items.push({ id: e.id, nodo: { tipo: 'entrada', pv, texto: m || e.id.slice(0, 8), t: e.t, autor: e.autor, ref: e.id, ...(e.estado ? { estado: e.estado } : {}) } });
    }
    // #45 (VG 12-11): el 6 lee también el hilo, de dónde cuelga R hacia arriba (lo que da contrato.leer con nivel negativo).
    for (const x of contrato.leer(eje, R, pv, { ...ctx.opciones, yo: ctx.yo ?? undefined }).derivado) {
      if (!(x.por[x.por.length - 1]?.nivel < 0) || !esReferencia(x.valor) || !eje.obtener(x.valor.ref)) continue;
      items.push({ id: x.valor.ref, nodo: { ...nodoRef(x.valor), arriba: true } });
    }
  } else if (!items.length) {
    for (const h of eje.sobre(R)) items.push({ id: h.id, nodo: conEstado(h.id, nodoRef({ ref: h.id })) });
  }
  return items;
}

/** Recorta una lista a lo que cabe: si pasa, la última que cabe se cambia por una cuenta mayor con cuántas representa (`mas`). */
function recortar(caja, caben) {
  if (caja.items.length <= caben) return;
  caja.mas = caja.items.length - (caben - 1);
  caja.items = caja.items.slice(0, caben - 1);
}

/**
 * Las franjas del 6 y el 7: una franja VERTICAL por escala de T que el calendario mide (la más lejana a la izquierda y
 * la más cercana a ahora a la derecha en el 6; al revés en el 7) y cuatro HILOS horizontales que las atraviesan, en el
 * orden de `d.hilos` (cada uno, el PV del que cuelga lo ensartado). Cada cuenta se ensarta en su franja (por el paso
 * de la época, pasos.escala) y en el hilo del PV del que cuelga bajo R (pvDondeCuelga); si no cuelga de ninguno de
 * los hilos, en el primero, marcada `hiloSupuesto`. Lo que no cabe en un cruce se cuenta en una cuenta mayor (`mas`).
 * La franja de cada cuenta es la del núcleo (contrato.franjaDeEntrada, encargo «datos3»): el primer paso de la fila que
 * da valor (el 7: la fecha a la que se refiere; si no, su escala), y su estado del futuro (`estado`) si lo tiene. VG 12-11
 * (#42): la incongruencia de escala se retiró; la cuenta lleva `rara` solo si sus tres relojes van fuera de orden.
 */
function franjasDeRejilla(eje, R, pv, d, g, ctx, { hueco }) {
  const hilos = (d.hilos ?? []).map((h) => ({ pv: h, etiqueta: contrato.etiqueta(eje, null, h, ctx.opciones) }));
  const cercana = Math.min(...d.bandas.map((b) => b.escala ?? b.indice));
  const altoCruce = hueco.alto / Math.max(1, g.filas);
  const caben = Math.max(1, Math.floor(hueco.ancho / Math.max(1, g.columnas) / ctx.medidas.tarjeta)) * Math.max(1, Math.floor(altoCruce / ctx.medidas.linea) - 1);
  const bandas = d.bandas.map((b) => ({ ...b, ahora: (b.escala ?? b.indice) === cercana, items: [], mas: 0, cruces: (hilos.length ? hilos : [{ pv: null }]).map((h) => ({ hilo: h.pv, items: [], mas: 0 })) }));
  const sinBanda = [];
  for (const it of itemsDeBandas(eje, R, pv, ctx)) {
    const f = contrato.franjaDeEntrada(eje, it.id, pv, { ...ctx.opciones, division: d });
    const banda = f && f.k !== null ? bandas.find((b) => (b.escala ?? b.indice) === f.k) ?? null : null;
    if (!banda) { sinBanda.push(it.nodo); continue; }
    if (f.rara) it.nodo.rara = true;
    const donde = pvDondeCuelga(eje, R, it.id);
    const cruce = banda.cruces.find((c) => c.hilo !== null && c.hilo === donde) ?? banda.cruces[0];
    it.nodo.hilo = cruce.hilo;
    // Lo del hilo hacia arriba no cuelga de R: va en el primero, como cadena de origen (no es un hilo supuesto).
    if (cruce.hilo !== donde && !it.nodo.arriba) it.nodo.hiloSupuesto = true;
    cruce.items.push(it.nodo);
  }
  for (const b of bandas) {
    for (const c of b.cruces) recortar(c, caben);
    b.items = b.cruces.flatMap((c) => c.items);
    b.mas = b.cruces.reduce((n, c) => n + c.mas, 0);
  }
  if (FORMAS[d.forma].alReves && esPvDelPasado(pv)) bandas.reverse(); // la más lejana a la izquierda, hoy a la derecha
  return { bandas, hilos, sinBanda, pagina: null };
}

/**
 * El cielo del 8: las diez cajas nivel.grado de los hitos (d.bandas) en dos filas; en cada una, las estrellas de los
 * comparables de la cohorte de R que caen en ella, con su nombre (contrato.cohorteDe, encargo «datos3»: la cohorte
 * elegida en la carta, `estado.cohorte`, o la que eligió el dueño, o la primera; cada comparable en la caja de su cuota
 * en ella); la estrella de R mismo, `foco`. La caja de R va marcada `foco`; una caja sin nadie lleva el paso del camino
 * del 8 (`escribir`); lo que no mueve nada va aparte (`sinBanda`). Aparte, el paso de R (`cuota`), las posiciones que R
 * tiene escritas (`enElFoco`), la cohorte con las que se pueden elegir (`cohorte`: el selector, si hay más de una) y la
 * base (`base`: quién la escribió y cuándo, o `escrita: false`, calculado al vuelo).
 */
function cieloDeRejilla(eje, R, pv, d, g, ctx, { hueco }) {
  const c = contrato.cohorteDe(eje, R, { ...ctx.opciones, cohorte: ctx.estado?.cohorte ?? undefined });
  // Encargo «el4» (VG 12-11, #39): un solo rango, el del 8; cada comparable va en la caja de su rango (el peldaño de la
  // escalera que ha alcanzado, contrato.rango) y la cuota queda como medida del foco (`cuota`, en el panel).
  const porRango = (d.mide ?? []).includes('rank');
  const cajaDe = (x) => (porRango ? x?.rango : x?.caja);
  const kPropio = typeof cajaDe(c) === 'number' ? cajaDe(c) : null;
  const kCuota = typeof c?.caja === 'number' ? c.caja : null;
  const caben = Math.max(1, Math.floor(hueco.ancho / Math.max(1, g.columnas) / ctx.medidas.tarjeta)) * Math.max(1, Math.floor(hueco.alto / Math.max(1, g.filas) / (ctx.medidas.linea * 2)) - 1);
  const bandas = d.bandas.map((b) => ({ ...b, items: [], mas: 0, foco: kPropio !== null && (b.escala ?? b.indice) === kPropio }));
  const sinBanda = [];
  const tipoDato = contrato.tipo(eje, R, pv, ctx.opciones);
  const sobrio = sobrioDe(ctx);
  const estrella = (x) => ({ ...nodoOcupante(eje, { ref: x.ref }, tamanoDeNivel(2, ctx.opciones), sobrio, tipoDato, { pv, lado: GEOMETRIA[pv]?.lado ?? 0, posicion: pv, anidar: 0 }), ...(x.foco ? { foco: true } : {}), ...(porRango && typeof x.rango === 'number' ? { rango: x.rango } : {}) });
  for (const x of c?.comparables ?? []) {
    const banda = cajaDe(x) === null || cajaDe(x) === undefined ? null : bandas.find((b) => (b.escala ?? b.indice) === cajaDe(x));
    if (banda) banda.items.push(estrella(x)); else sinBanda.push(estrella(x));
  }
  const escribir = accionPorDefecto(eje, R, pv, ctx);
  for (const b of bandas) {
    // La estrella de R, primero: que no la tape la cuenta mayor.
    b.items.sort((x, y) => Number(Boolean(y.foco)) - Number(Boolean(x.foco)));
    recortar(b, caben);
    b.escribir = !b.items.length && !b.mas && !b.foco ? escribir : null;
  }
  const base = c?.base ?? null;
  return {
    bandas, sinBanda, pagina: null,
    cuota: kCuota !== null ? { nombre: d.paso, k: kCuota, de: (d.paso ? pasosDe.tabla(ctx.opciones).find((x) => x.nombre === d.paso)?.de : null) ?? null } : null,
    ...(porRango ? { rango: rangoDeR(eje, R, ctx) } : {}),
    enElFoco: POSICIONES.filter((k) => contrato.ocupantes(eje, R, k, 0, 0, ctx.opciones).total > 0),
    cohorte: c ? { valor: c.cohorte, texto: c.texto, elegida: c.elegida, opciones: c.cohortes.length > 1 ? c.cohortes.map((x) => ({ valor: x.valor, texto: x.texto, actual: x.valor === c.cohorte })) : [] } : null,
    base: base ? { escrita: base.escrita, autor: base.autor ? legibleDe(eje, base.autor, ['identity'], ctx.opciones).texto : null, t: base.t ?? null } : null,
  };
}

/**
 * El camino del 9: primero las diez posiciones nivel.grado para situarse (las mismas cajas que el 8); debajo, la
 * guía (los pasos del camino y la conversación, que la carta pinta como siempre, carta/dom.js htmlCamino y
 * htmlGuia). El núcleo no dice todavía qué posiciones tiene disponibles un registro ni en cuál está («nada asigna
 * nivel ni grado al foco», src/bases.js): ninguna se enciende, cada una lleva el paso del camino del 9 (`escribir`) y
 * aparte va la madurez de R (contrato.madurez).
 */
function caminoDeRejilla(eje, R, pv, d, g, ctx) {
  const escribir = accionPorDefecto(eje, R, pv, ctx);
  const m = contrato.madurez(eje, R, ctx.opciones);
  // Encargo «el4» (VG 12-11, #39): el 9 lee el rango del 8; situarse es elegir entre las posiciones que ese rango deja
  // (las disponibles, del primer peldaño al suyo; la suya, `actual`), sin rango declarado.
  const r = (d.mide ?? []).includes('rank') ? rangoDeR(eje, R, ctx) : null;
  return {
    bandas: d.bandas.map((b) => ({ ...b, items: [], mas: 0, escribir, ...(r ? { disponible: r.disponibles.includes(b.indice), actual: r.peldano === b.indice } : {}) })), camino: true, sinBanda: [], pagina: null,
    madurez: m && m.nivel !== null ? { nombre: m.nombre, nivel: m.nivel, de: m.de } : null,
    ...(r ? { rango: r } : {}),
  };
}

/**
 * Ejecutar desde una celda abierta del 4 (VG 12-11, decisión 7 de #49): la suma de sus transacciones (el valor de cada
 * ejecución crece con lo anclado debajo, contrato.valorDeCelda; todas suman), las plantillas que escriben del oficio de la
 * celda (la fila: el PV de la plantilla) que se ofrecen a quien mira sobre R (cada una abre el formulario en modo
 * ejecutar: lo exigido, la denominación y el botón) y el estado del botón por el rango de R (contrato.botonDeEjecutar).
 */
function ejecutarEnCelda(eje, R, celda, ctx) {
  const valor = contrato.valorDeCelda(eje, celda.ocupantes.map((n) => n.X).filter(Boolean), ctx.opciones);
  const ejecutar = ctx.yo ? acciones.acciones(eje, R, celda.fila, ctx.yo, ctx.opciones).filter((a) => !a.lectura && !a.camino).map((a) => ({ id: a.id, nombre: a.etiqueta ?? a.nombre })) : [];
  return { valor, ejecutar, boton: contrato.botonDeEjecutar(eje, R, ctx.opciones) };
}

/** El rango de R para la carta (contrato.rango): el peldaño, su nivel.grado y su nombre, la dirección medida y las disponibles. */
function rangoDeR(eje, R, ctx) {
  const r = contrato.rango(eje, R, ctx.opciones);
  return r ? { peldano: r.peldano, nivel: r.nivel, grado: r.grado, nombre: r.nombre, direccion: r.direccion, medida: r.medida?.direccion ?? null, exacto: r.exacto, disponibles: r.disponibles } : null;
}

/**
 * La división de cada mundo en pantalla completa (epoch.8.7, contrato.divisionDelMundo): la cruceta aplicada al
 * elemento pulsado. La geometría sale de la forma del nivel y de los hijos (geometriaDe): una celda por hijo, con su
 * dígito (`pv`, de él sale el color), su nombre y sus ocupantes; un hijo sin ocupantes está `vacio` (nombre apagado, no
 * se entra, con el paso del camino que lo llenaría) y, si todos lo están, no se baja. Entrar en un ocupante que es un
 * registro baja un nivel de profundidad (`ruta`: los registros por los que se ha entrado) mientras queden niveles. Las
 * franjas del 6 y el 7, el cielo del 8 y el camino del 9 llevan bandas en lugar de celdas. Nada de esto decide qué
 * hay: lo dan los ocupantes, los pasos, las acciones y el diario del núcleo; y nada depende del modelo (sobrio o
 * animado dan el mismo árbol de la rejilla; en animado, capasDeRejilla solo le añade sus capas). → { pv, forma, columnas, filas, niveles, nivel, entra, ruta, X, estilo,
 * pagina, celdas, flotante?, ejes? } o { …, bandas, sinBanda, hilos?, cuota?, enElFoco?, camino?, madurez? } o null.
 */
function rejillaDe(eje, X, pv, ctx, { ruta = [], pagina = 1, hueco = { ancho: 1, alto: 1 }, entrar = true, modo = 'mapped' } = {}) {
  const d = contrato.divisionDelMundo(eje, pv, { nivel: ruta.length + 1, modo, ...ctx.opciones }); // la forma es la del modo (epoch.8.7, #52)
  const g = d ? geometriaDe(d) : null;
  if (!g || g.columnas * g.filas <= 0) return null;
  const pasos = ruta.map((p) => (typeof p === 'string' ? { X: p, d: null } : p));
  const { R, base: sub, direccion } = lugarDe(eje, X, pv, pasos, ctx);
  const base = {
    pv, forma: d.forma, columnas: g.columnas, filas: g.filas, niveles: d.profundidad, nivel: d.nivel, entra: d.entra && entrar,
    ruta: pasos.map((p) => p.X ?? p.d), X: R, base: sub, direccion: direccion ? direccion.join('.') : null,
    texto: R === X ? null : legibleDe(eje, { ref: R }, null, ctx.opciones).texto, estilo: estiloDe(eje, R, pv, ctx),
    // El personaje del sitio (VG, 12-11, #38): el nodo R.<camino> de lo que la rejilla divide (su cruceta); a nivel 1 es el del propio PV.
    ...([pv, ...sub].length < 9 ? { sitio: { X: R, lugar: [pv, ...sub].join('.') } } : {}),
  };
  return { ...base, ...FORMAS[d.forma].celdas(eje, R, pv, d, g, ctx, { pagina, hueco, entrar, base: sub, direccion, raiz: X }) };
}

/**
 * Lo que la correspondencia de la cabecera dibuja en un mundo para lo que da el núcleo (VG, 11-11): `dado` es uno de
 * los dados del tipo elemento (epoch.9.7.0.4: hijo, ocupante, vacio, actual, hecho, repetido, persona, cerrado) y la
 * fila de ese mundo dice el nombre del elemento (tienda, flor, polvo…). Sin fila en el mundo, nada (la
 * correspondencia solo renombra lo que renombra, y aquí lo no renombrado no se pinta); con fila, la pieza de ese
 * nombre al paso del mundo (`paso`, el de su etapa), solo si el modelo la tiene con recurso.
 */
function elementoDelMundo(ctx, mundo, dado, paso, lado, tamano, elemento = ctx.X) {
  const nombre = modelos.corresponde(ctx.cabecera, PIEZA.elemento, dado, mundo);
  if (nombre === dado) return null;
  const p = conRecurso(piezaDe(ctx, PIEZA.elemento, mundo, paso, lado, tamano, { rol: nombre, elemento }));
  return p && p.subclave === nombre ? p : null;
}

/** ¿Es lo que ocupa una celda una persona? Una hoja que es una identidad del eje que es persona (eje.esPersona). */
const esPersonaOcupante = (eje, o) => o?.tipo === 'hoja' && typeof o.valor === 'string' && eje.esPersona?.(o.valor) === true;

/**
 * Las capas del animado sobre la rejilla de un mundo a pantalla completa (VG, 11-11: «el animado es el sobrio
 * añadiéndole las imágenes animadas y los fondos»). La rejilla `r` es la misma que en sobrio (rejillaDe no depende del
 * modelo); aquí solo se le añade lo que se pinta encima y debajo, sin tocar nada de lo que ya tiene:
 *   r.capas = { fondo, etapa, marco, personaje, respaldo, efectos }: el fondo del mundo (por la madurez del foco, el
 *     del escenario), la etapa del elemento pulsado (R, por su madurez), el marco del mundo, el personaje del rol por
 *     defecto (esperar en bucle; actuar si hay algo nuevo bajo R), su respaldo estático (la pieza «*» de su rol: lo que
 *     se ve si Lottie no carga) y los efectos de lo nuevo que no cae en ningún hijo (van al centro del mundo);
 *   celda.capa / banda.capa = { total, hijo, ocupantes, hecho, efectos }: el dibujo del hijo (o el del vacío), uno por
 *     ocupante (o el de persona), el sello de lo hecho (la estación ejecutada) y los efectos de lo nuevo que cuelga de
 *     ese hijo (pvDondeCuelga);
 *   ocupante.dibujo: en las bandas (las cuentas del 6 y el 7, las estrellas del 8, los pasos del 9), el de cada uno.
 * Qué dibujo va con qué es la correspondencia de la cabecera (elementoDelMundo); dónde va cada capa, CSS. En un bloque
 * de Mapped (#16), `personaje: false` y `efectos: false`: sin muñequito y lo nuevo sobre el bloque entero, no por hijo.
 */
function capasDeRejilla(eje, X, pv, r, ctx, escenario, tamano, { personaje: conPersonaje = true, efectos: conEfectos = true } = {}) {
  const lado = GEOMETRIA[pv].lado;
  const R = r.X ?? X;
  const madurez = R === X ? ctx.madurez : contrato.madurez(eje, R, ctx.opciones);
  const etapa = R === X ? escenario.etapa : piezaDe(ctx, PIEZA.etapa, pv, madurez?.nivel ?? null, lado, tamano, { de: madurez?.de ?? undefined, elemento: R });
  const paso = typeof etapa?.clave === 'number' ? etapa.clave : null; // el paso del mundo: el de su etapa en el modelo
  const dibujo = (dado) => elementoDelMundo(ctx, pv, dado, paso, lado, tamano, R);
  // Cada ocupante que es un registro con arte propio se ve con su retrato (#25); los demás, con el dibujo del mundo.
  const deOcupante = (o) => (o?.X && retratoDe(ctx, o.X, pv, lado, tamano)) || (esPersonaOcupante(eje, o) && dibujo('persona')) || dibujo('ocupante');
  const efectosDe = (entradas) => (entradas?.length ? efectosDeEntradas(ctx, entradas, pv, lado, tamano, R) : null);
  // Las personas de una caja del 3 (encargo pv3): la que es persona, con el dibujo de persona del mundo; una cosa, el de ocupante.
  const dePersona = (p) => (eje.esPersona?.(p.identidad) === true && dibujo('persona')) || dibujo('ocupante');
  for (const c of r.celdas ?? []) {
    const lista = c.personas ?? c.ocupantes ?? (c.ocupante ? [c.ocupante] : []);
    // El muñeco del sitio de la celda, en el mismo sitio que su interrogante (VG, 12-11, #38).
    if (c.sitio) { const pj = personajeDelSitio(ctx, eje, R, pv, lado); if (pj) c.sitio = { ...c.sitio, personaje: pj }; }
    c.capa = {
      total: c.total ?? lista.length,
      hijo: r.forma === 'matriz' ? null : c.vacio || !lista.length ? dibujo('vacio') : dibujo('hijo'),
      ocupantes: lista.map(c.personas ? dePersona : deOcupante).filter(Boolean),
      hecho: c.estado === 'ejecutada' ? dibujo('hecho') : null,
      efectos: null,
    };
  }
  for (const b of r.bandas ?? []) {
    const items = new Set([...(b.items ?? []), ...(b.cruces ?? []).flatMap((x) => x.items)]);
    for (const o of items) o.dibujo = deOcupante(o);
    const llena = Boolean(b.items?.length || b.mas);
    // El cielo sin base escrita (encargo «datos3»): lo calculado al vuelo lleva además el polvo (el dibujo del vacío)
    // bajo sus estrellas; las cajas vacías ya son polvo.
    const polvo = r.base && r.base.escrita === false && llena ? dibujo('vacio') : null;
    b.capa = { total: (b.items?.length ?? 0) + (b.mas ?? 0), hijo: llena ? dibujo('hijo') : b.foco ? null : dibujo('vacio'), ocupantes: polvo ? [polvo] : [], hecho: null, efectos: null };
  }
  // Lo nuevo bajo R, por el dígito del que cuelga (pvDondeCuelga): al hijo de ese dígito si lo hay; si no, al centro del mundo.
  const porDigito = !conEfectos ? new Map() : R === X ? ctx.nuevosPorPv : nuevosPorPvDe(eje, R, ctx.nuevos, ctx.opciones);
  const alCentro = [];
  for (const [digito, entradas] of porDigito) {
    const celda = r.forma === 'matriz' ? null : (r.celdas ?? []).find((c) => c.pv === digito);
    if (celda) celda.capa.efectos = efectosDe(entradas);
    else alCentro.push(...entradas);
  }
  const hayNuevos = [...porDigito.values()].some((l) => l.length > 0);
  const pasos = R === X || !conPersonaje ? ctx.pasos : pasosPorPv(eje, R, ctx.opciones);
  const personaje = conPersonaje ? personajeDe(ctx, eje, R, pv, lado, tamano, { enfocado: true, nuevos: hayNuevos, paso: pasos.porPv[pv] ?? null }) : null;
  const quieto = personaje ? conRecurso(piezaDe(ctx, PIEZA.munequito, pv, modelos.CUALQUIERA, lado, tamano, { rol: personaje.rol, elemento: R })) : null;
  // En la tarjeta central, lo propio del pulsado primero (#25): su etapa propia si la lleva; si no, su retrato (su pieza
  // elemento propia); si no, la etapa del modelo de quien mira.
  const suya = etapa?.propio ? etapa : retratoDe(ctx, R, pv, lado, tamano) ?? etapa;
  r.capas = {
    fondo: escenario.fondo ?? null,
    etapa: conRecurso(suya),
    marco: escenario.marco ?? null,
    personaje: personaje?.pieza?.recurso ? personaje : null,
    respaldo: quieto && quieto.subclave === personaje.rol && !quieto.animado ? quieto : null,
    efectos: efectosDe(alCentro),
  };
  return r;
}

/**
 * ¿Va la rejilla de una fila de Sequenced en una sola columna? Si sus columnas no caben a lo ancho del hueco: una celda
 * con hijos (cruceta, escalera, columnas, rejilla, matriz) necesita dos tarjetas de ancho para leerse; una caja
 * nivel.grado (cielo, camino), media tarjeta. Son píxeles de pantalla, no datos del dominio.
 */
function enColumnaDe(r, medidas, hueco) {
  const minimo = r.celdas ? medidas.tarjeta * 2 : medidas.tarjeta / 2;
  return r.columnas > 1 && r.columnas * minimo > hueco.ancho;
}

/** ¿Cabe la rejilla de `pv` en un hueco, con celdas de al menos `medidas.hueco` píxeles? (en un bloque; si no, la división de 8.3). */
function rejillaCabe(eje, pv, hueco, medidas, opciones) {
  const d = contrato.divisionDelMundo(eje, pv, opciones);
  const g = d ? geometriaDe(d) : null;
  return Boolean(g) && g.columnas * g.filas > 0 && g.columnas * medidas.hueco <= hueco.ancho && g.filas * medidas.hueco <= hueco.alto;
}
/** La zona del hilo de un PV en Sequenced: la cruz de en medio, el lado del PV1 el pasado y el del PV2 el futuro (la geometría); null si no es del hilo. */
const zonaDelHilo = (pv) => (GEOMETRIA[pv]?.grupo === 'cruz' && GEOMETRIA[pv]?.fila === 'medio' ? (GEOMETRIA[pv].lado === 1 ? 'antes' : 'despues') : null);

/**
 * Sequenced (el móvil en vertical, VG 11-11): lo que la columna necesita. Una fila por cada PV de la división (en el
 * orden de sus dígitos), cada una con su nodo: cerrada (comprimido, por defecto) o abierta (bloque, cuando
 * estado.niveles la pone en tarjeta o más), con el segundo nivel del PV (nodoLateral en bloque, con la rejilla). Las
 * filas del hilo (el pasado y el futuro) no se abren: su nodo, en bloque y paginado, va encima y debajo de la tarjeta.
 * La fila de dígitos lleva los mismos PV. → { filas, pasado, futuro, digitos, nodos }.
 */
function secuenciaDe(eje, X, pvs, ctx, m) {
  const hueco = { ancho: m.ancho, alto: m.alto };
  const abierta = (pv) => (ctx.estado.niveles?.[pv] ?? NIVEL.comprimido) >= NIVEL.tarjeta;
  const nodos = {};
  const digitos = [...pvs].sort((a, b) => a - b);
  for (const pv of digitos) {
    const hilo = zonaDelHilo(pv);
    const nivel = hilo || abierta(pv) ? NIVEL.bloque : NIVEL.comprimido;
    const n = nodoLateral(eje, X, pv, nivel, ctx, m, hueco, null, { secuencia: true, rejilla: !hilo });
    if (hilo) {
      // El hilo, por páginas: hay más si quedan ocupantes o entradas del diario por cargar.
      const faltan = (n.ocupantes ? n.ocupantes.total - n.ocupantes.lista.length : 0) + (n.diario ? n.diario.total - n.diario.entradas.length : 0);
      Object.assign(n, { hilo, cargarMas: faltan > 0, faltan });
    }
    nodos[pv] = n;
  }
  const filas = digitos.map((pv) => ({
    pv,
    etiqueta: nodos[pv].etiqueta,
    total: contrato.ocupantes(eje, X, pv, 0, 0, ctx.opciones).total,
    medida: nodos[pv].medida,
    hilo: nodos[pv].hilo ?? null,
    sitio: sitioDe(ctx, eje, X, String(pv), pv),
    abierta: !nodos[pv].hilo && nodos[pv].nivel >= NIVEL.bloque,
    nodo: nodos[pv].hilo ? null : nodos[pv],
  }));
  const deZona = (z) => digitos.map((pv) => nodos[pv]).find((n) => n.hilo === z) ?? null; // antes: el pasado; despues: el futuro
  return { filas, pasado: deZona('antes'), futuro: deZona('despues'), digitos: filas.map((f) => ({ pv: f.pv, etiqueta: f.etiqueta, hilo: f.hilo })), nodos };
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
 *   niveles: { [pv]: k }     el paso de tamaño de cada PV: en el móvil en vertical (Sequenced), NIVEL de su fila (por
 *                            defecto comprimido, cerrada; tarjeta o bloque, abierta); en
 *                            Mapped, el índice en los pasos de la época (epoch.8.6; por defecto, el de partida: el punto)
 *   recientes: [pv]          Mapped: los PV tocados uno a uno, del más antiguo al más reciente (el último gana lo suyo)
 *   profundidad: { [pv]: [X] } Mapped, pantalla completa: los registros por los que se ha entrado en la rejilla de cada PV (epoch.8.7)
 *   paginas: { [pv]: n }     cuántas páginas de ocupantes se han cargado en cada PV (en Mapped, la página que se ve)
 *   aro: { X, pv } | null    el aro abierto sobre un registro (pv: el hueco desplegado); { X, nuevo: d }: sobre el
 *                            hueco vacío d de X, con un input nuevo que crea el elemento en X.d (issue #22)
 *   formulario: { X, accion, valores, motivos, resultado } | null
 *   rosetones: { [pv]: 1-2 } el paso de cada rosetón de identidad
 *   local: LibroLocal | null el libro local de yo (solo se lee)
 *   leido: boolean           si la lente «leído» del 0 está abierta
 *   nuevos: Set<id>          las transacciones del diario llegadas desde la última vez (lo que el animado anima: efectos y actuar)
 * En Mapped, el foco en un PV lateral es ese PV a pantalla completa (el paso que sigue al tope). En Sequenced, el árbol
 * lleva además `secuencia` ({ filas, pasado, futuro, digitos }: secuenciaDe) y no lleva rosetones.
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
  const { animado, soloPropio } = pintadoDe(configuracion, defectos, opciones);
  const cabecera = modelos.cabecera(opciones);
  // El idioma de quien mira (su preferencia «language»): todo texto de la época pasa por el núcleo con él.
  const idioma = idiomaDe(eje, yo, opciones);
  const nuevos = estado.nuevos instanceof Set ? estado.nuevos : new Set(Array.isArray(estado.nuevos) ? estado.nuevos : []);
  // Cuántas animaciones a la vez: la preferencia «animations» de quien mira (su registro de preferencias), si no el
  // defecto de la época (epoch.9.3.7), si no el de la carta.
  const limiteDe = (c) => (typeof c?.animations === 'number' && c.animations > 0 ? c.animations : null);
  const limite = (configuracion.de && limiteDe(configuracion)) || limiteDe(defectos) || LIMITE_DE_ANIMACIONES;
  const ctx = {
    estado, eje, opciones: { ...opciones, idioma }, animado, soloPropio, X, yo: yo ?? null,
    variantes: cabecera.variantes,
    cabecera,
    cadena: animado ? modelos.modelo(eje, yo, opciones) : [],
    madurez: animado ? contrato.madurez(eje, X, opciones) : null,
    nuevosPorPv: animado ? nuevosPorPvDe(eje, X, nuevos, opciones) : new Map(),
    nuevos,
    limite,
    // El paso de «cargar más»: el de la época (epoch.8.3.3) o, si quien mira lo ha escrito en sus preferencias, el suyo.
    paso: configuracion.de && typeof configuracion.step === 'number' && configuracion.step > 0 ? configuracion.step : contrato.paso(opciones),
    pasos: pasosPorPv(eje, X, opciones),
    // El proyecto donde yo ancla sus opiniones (su ajuste «opinions anchor»): en su pasado se listan (docs/CONTRATO.md §12.7).
    proyecto: yo ? acciones.proyectoDeOpiniones(eje, yo, opciones) : null,
    medidas: m,
  };
  const camino = await caminoDe(eje, X, yo, ctx);
  // Lo previsualizado de un paso del camino (encargo «datos3»): la app lo guarda en estado.previa y aquí solo se pasa.
  if (estado.previa && estado.previa.foco === X) camino.previa = estado.previa;
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
  let secuencia = null;
  if (apilada) {
    // El móvil en vertical (Sequenced, VG 11-11): una columna. La tarjeta del foco (Pointed) con una fila por PV, cada
    // una un acordeón (cerrada = comprimido, abierta = bloque, en estado.niveles) que abre debajo el segundo nivel del PV;
    // y el hilo como scroll: encima el pasado y debajo el futuro, en bloque y por páginas (estado.paginas, «cargar más»).
    secuencia = secuenciaDe(eje, X, d.pvs, ctx, m);
    laterales = pvsLaterales.map((pv) => secuencia.nodos[pv]);
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
      const rejilla = rejillaDe(eje, X, pvCentro, ctx, { ruta: rutaDe(estado, eje, pvCentro, ctx.opciones), pagina: estado.paginas?.[pvCentro] ?? 1, hueco: todo });
      centro = nodoCentro(eje, X, pvCentro, ctx, m, todo, { cuantos, datos: paso?.datos ?? ctx.paso, rejilla });
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
  const aro = !estado.aro?.X || !eje.obtener(estado.aro.X) ? null
    : Number.isInteger(estado.aro.nuevo) ? nodoAroNuevo(eje, estado.aro.X, estado.aro.nuevo, ctx) : nodoAro(eje, estado.aro.X, yo, ctx);
  // El formulario en modo ejecutar (VG 12-11, decisión 7): abierto desde una celda del 4 o un paso del camino del 9.
  const conEjecutar = estado.formulario?.ejecutar ? { ejecutar: { escala: estado.formulario.escala ?? null } } : {};
  const form = estado.formulario?.accion && eje.obtener(estado.formulario.X) ? formulario(eje, estado.formulario.X, estado.formulario.accion, yo, estado.formulario.valores ?? {}, { ...ctx.opciones, ...conEjecutar }) : null;
  // El personaje de un sitio abierto (encargo pv3): la cruceta del nodo, si no hay formulario encima.
  const sitio = !form && estado.sitio?.X && eje.obtener(estado.sitio.X) ? nodoSitio(eje, estado.sitio, yo, ctx) : null;
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
    // El pintado (#25, epoch.9.3.2): sobrio, propio (solo el arte propio de cada elemento) o todo.
    pintado: { valor: hojas(configuracion.render ?? defectos.render)[0] ?? null, animado, soloPropio },
    limite,
    colores: contrato.colores(opciones), // epoch.9.5.4: el color de cada PV, un dato de la época
    configuracion,
    // Los interruptores del 5 del 0 de mi alta (la barra ya no existe): las preferencias que son una enumeración (hoy el pintado: sobrio, propio o todo), cada valor en el idioma.
    interruptores: interruptoresDe(configuracion, ctx.opciones),
    centro,
    centros: pvsCentro,
    laterales,
    mapa,
    // Los rosetones de mi foco; en la pantalla completa de un PV no se ven, ni en Sequenced (su sitio es la fila de dígitos).
    rosetones: mapa?.completa || apilada ? [] : rosetonesDe(eje, yoDatos, ctx, m),
    // Sequenced: las filas de la tarjeta, el pasado y el futuro del hilo y la fila de dígitos (en Mapped no está).
    ...(secuencia ? { secuencia: { filas: secuencia.filas, pasado: secuencia.pasado, futuro: secuencia.futuro, digitos: secuencia.digitos } } : {}),
    aro,
    sitio,
    formulario: form ? { ...form, motivos: estado.formulario.motivos ?? [], resultado: estado.formulario.resultado ?? null, animado } : null,
    camino,
    local: localDe(estado.local, opciones.t),
    tiempo: yoDatos?.tiempo ?? null,
    identidades: eje.identidades().map((id) => ({ id, persona: eje.esPersona(id), alta: eje.alta(id)?.id ?? null })),
    avisos: [],
  };
}
