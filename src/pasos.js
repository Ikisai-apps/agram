// Los pasos (encargo 3c-2b, tras 3c-1). Los «estados» del motor ya no existen (mapa §15 [D]: una sola operación,
// registrar); lo que la animación necesita como estado son PASOS: valores discretos que salen de lecturas, y que usa
// como ÍNDICE DE FOTOGRAMA (el paso k → el fotograma k; pruebas/carta/: «el cambio de paso es un cambio de
// fotograma»). Qué pasos hay y de dónde sale cada uno es un dato de la época, la tabla de epoch.9.8: una fila por
// punto de vista, [[pv], [nombre], [k], [de], [nota]]; `k` y `de` son fórmulas «=…» del BQL mínimo con `it` = el
// registro, o el nombre de una lectura que el núcleo ya da (aquí no se recalcula nada que el núcleo dé). Este módulo
// solo sabe dónde está la tabla y cómo se materializa cada mecanismo. Documentación: docs/CONTRATO.md, «Los pasos».
//
//   pasos(eje, X)   → { <nombre>: { pv, k, de } } para cada fila de la tabla; k es null si la lectura no da valor
//   tabla()         → las filas de la tabla, leídas

import { EPOCA_0_BTML } from './epocas.js';
import { ContextoEje } from './contexto-eje.js';
import { evaluar } from './bqlm.js';
import { madurez } from './contrato.js';
import { cuota } from './mapped.js';
import { cajaDeCuota } from './bases.js';

/** Dónde pone la época la tabla de pasos: 0 la cabecera, 1… las filas. */
const SITIO = Object.freeze({ pasos: [9, 8] });

const epocaDe = (opciones) => opciones?.epoca ?? EPOCA_0_BTML;
const raizDe = (epoca) => (Array.isArray(epoca) ? epoca : epoca.registro ?? epoca.payload);
const en = (raiz, camino) => camino.reduce((n, d) => (Array.isArray(n) ? n[d] : undefined), raiz);
const hoja = (x) => (Array.isArray(x) ? x[0] : x);
const ultima = (x) => (Array.isArray(x) ? x[x.length - 1] : x);
const texto = (x) => (typeof x === 'string' ? x : undefined);
const esFormula = (s) => typeof s === 'string' && s.startsWith('=') && !s.startsWith('==');

/** El evento de X: su id, el evento mismo, o null. */
function eventoDe(eje, X) {
  if (typeof X === 'string') return eje?.obtener(X) ?? null;
  if (X && typeof X === 'object' && 'payload' in X) return X;
  return null;
}

/**
 * Los mecanismos: las lecturas que el núcleo ya da y que la tabla nombra por su palabra (como `epoch.8.5` nombra
 * «llegada» o «encaje» para los órdenes: qué paso hay es un dato, cómo se lee es código). Cada uno (eje, ev, opciones)
 * → { k, de } con null donde no hay valor.
 *   maturity    la madurez de X (contrato.madurez, la lectura «maturity» en X.8.1): el nivel entre los de su plantilla o los genéricos
 *   share box   la caja (0-9) de la cuota de X frente a su padre (mapped.cuota, bases.cajaDeCuota), en la serie en que más pesa; null en la raíz
 */
const MECANISMOS = Object.freeze({
  maturity(eje, ev, opciones) {
    const m = madurez(eje, ev, opciones);
    return { k: m?.nivel ?? null, de: m?.de ?? null };
  },
  'share box'(eje, ev) {
    if (!eje || typeof ev.id !== 'string' || !eje.obtener(ev.id)) return { k: null, de: null };
    const c = cuota(eje, ev.id);
    if (!c) return { k: null, de: null };
    const mueve = c.series.filter((s) => s.foco > 0 && typeof s.cuota === 'number');
    if (!mueve.length) return { k: null, de: null };
    const mayor = mueve.reduce((a, b) => (b.cuota > a.cuota ? b : a));
    return { k: cajaDeCuota(mayor.cuota), de: null };
  },
});

/** Las filas de la tabla de pasos de la época (epoch.9.8.1…): [{ pv, nombre, k, de, nota }]; pv es un dígito o «*». */
export function tabla(opciones = {}) {
  const raiz = raizDe(epocaDe(opciones));
  const t = en(raiz, SITIO.pasos);
  return (Array.isArray(t) ? t : []).filter((f, i) => i > 0 && Array.isArray(f)).map((f) => ({
    pv: hoja(f[0]),
    nombre: texto(hoja(f[1])) ?? null,
    k: ultima(f[2]),
    de: ultima(f[3]),
    nota: texto(ultima(f[4])) ?? null,
  }));
}

/**
 * Los pasos de X: una entrada por fila de la tabla, con el nombre de la fila como clave: { <nombre>: { pv, k, de } }.
 * `k` es el valor discreto (el índice de fotograma) y `de` cuántos hay; null donde la lectura no da valor (un registro
 * que no quema T no tiene escala; la raíz no tiene cuota). X es un id del eje, un evento o una candidata.
 */
export function pasos(eje, X, opciones = {}) {
  const ev = eventoDe(eje, X);
  if (!ev) return {};
  const epoca = epocaDe(opciones);
  let ctx = null;
  const contexto = () => (ctx ??= new ContextoEje(eje, { ev, epoch: epoca }));
  const sujeto = () => (typeof ev.id === 'string' && eje?.obtener(ev.id) ? ev.id : contexto().nombre('ev'));
  const memo = new Map();
  const mecanismo = (nombre) => {
    if (!memo.has(nombre)) memo.set(nombre, MECANISMOS[nombre](eje, ev, opciones));
    return memo.get(nombre);
  };
  const valorDe = (que, cual) => {
    if (esFormula(que)) {
      const r = evaluar(que, contexto(), { sujeto: sujeto() });
      const v = r.estado === 'RESUELTO' ? r.valor.find((x) => typeof x === 'number') : undefined;
      return typeof v === 'number' ? v : null;
    }
    if (typeof que === 'number') return que;
    if (typeof que === 'string' && Object.hasOwn(MECANISMOS, que)) return mecanismo(que)[cual];
    return null;
  };
  const fuera = {};
  for (const fila of tabla(opciones)) {
    if (!fila.nombre) continue;
    fuera[fila.nombre] = { pv: fila.pv, k: valorDe(fila.k, 'k'), de: valorDe(fila.de, 'de') };
  }
  return fuera;
}

/** Los mecanismos que este módulo conoce, por su palabra (lo que una fila de la tabla puede nombrar en vez de una fórmula). */
export const mecanismos = () => Object.keys(MECANISMOS);
