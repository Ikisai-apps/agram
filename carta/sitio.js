// La configuración por defecto del SITIO (docs/CONTRATO.md §16.2 ter): un fichero estático opcional, `./sitio.json`
// (mismo origen, en la raíz de lo que sirve la carta; no va en el repositorio, solo `sitio.ejemplo.json`), que dice
// dónde está el nodo de ESTA casa para que una cuenta nueva no tenga que teclear su dirección:
//
//   { "sync url": "https://aarpia.ikisai.com", "sync ledger": "nodo-ikisai", "guide url": "https://aarpia.ikisai.com" }
//
// Solo valen estas claves de ajustes (las demás se ignoran sin ruido) y solo como DEFECTO: al crear una cuenta nueva
// se escriben en su libro (los registros «preferences» y «exterior settings» de siempre, firmados por ella) y, al abrir
// la configuración de una cuenta que no tiene ese ajuste, el campo viene relleno con el valor del sitio (no se guarda
// hasta que la persona guarda). Nunca se evalúa nada, y la CLAVE DE LECTURA no puede venir aquí: es de cada persona y
// vive solo en su navegador; si el fichero trae una (o cualquier clave o secreto) se ignora y se avisa en la consola.
// Sin fichero, o sin JSON válido, la carta se comporta como siempre.

import { contrato, exterior } from '../src/index.js';

/** Los ajustes del sitio que se admiten, con su forma: «url» (http o https, sin credenciales) o «eje» (un nombre de eje). */
export const AJUSTES = Object.freeze({ 'sync url': 'url', 'sync ledger': 'eje', 'guide url': 'url', 'relay url': 'url', 'blossom url': 'url', 'seal url': 'url' });
/** De ellos, los que son de las preferencias (el 9 de la alta, plantilla «preferences»); los demás son de «exterior settings». */
const DE_PREFERENCIAS = new Set(['sync url', 'sync ledger']);
export const esDePreferencias = (clave) => DE_PREFERENCIAS.has(clave);

/** Lo que parece una clave o un secreto (de lectura, de servicio, una contraseña…): nunca se admite en el fichero del sitio. */
const PARECE_SECRETO = /key|clave|secret|secreto|token|password|contrase|passphrase/i;
const NOMBRE_EJE = /^[a-z0-9][a-z0-9._-]{0,63}$/;

function valorValido(forma, v) {
  if (typeof v !== 'string') return null;
  const x = v.trim();
  if (!x || x.length > 300) return null;
  if (forma === 'eje') return NOMBRE_EJE.test(x) ? x : null;
  try {
    const u = new URL(x);
    if (!/^https?:$/.test(u.protocol) || u.username || u.password) return null;
  } catch {
    return null;
  }
  return x.replace(/\/+$/, '');
}

/**
 * Lo que vale de un sitio.json ya leído: { ajustes: { <clave>: texto }, avisos: [texto] }. Solo las claves conocidas con
 * un valor de su forma; las desconocidas se ignoran sin aviso; las que parecen una clave o un secreto se ignoran CON aviso.
 */
export function validar(datos) {
  const ajustes = {};
  const avisos = [];
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return { ajustes, avisos };
  for (const [clave, v] of Object.entries(datos)) {
    if (Object.hasOwn(AJUSTES, clave)) {
      const valido = valorValido(AJUSTES[clave], v);
      if (valido) ajustes[clave] = valido;
      else avisos.push(`sitio.json: «${clave}» ignorada (no es ${AJUSTES[clave] === 'eje' ? 'un nombre de eje' : 'una dirección http(s) sin credenciales'})`);
    } else if (PARECE_SECRETO.test(clave)) {
      avisos.push(`sitio.json: «${clave}» ignorada: las claves y los secretos no van en el sitio, cada persona mete la suya en su navegador`);
    }
  }
  return { ajustes, avisos };
}

let actuales = Object.freeze({});

/** Los defectos del sitio de ahora (congelado; vacío si no hay sitio.json). */
export const defectos = () => actuales;

/** Fija los defectos a mano (los de un texto ya leído, o las pruebas): pasa por `validar` y avisa en la consola. → los defectos. */
export function fijar(datos) {
  const { ajustes, avisos } = validar(datos);
  for (const a of avisos) console.warn(a);
  actuales = Object.freeze(ajustes);
  return actuales;
}

/**
 * Lee `./sitio.json` (o `url`) y lo deja como defecto. Silencioso si no existe, no se puede leer o no es JSON (un
 * alojamiento que devuelve el index.html por defecto tampoco molesta); la espera es corta, para no retrasar el arranque.
 */
export async function cargar({ fetch = globalThis.fetch?.bind(globalThis), url = './sitio.json', espera = 3000 } = {}) {
  actuales = Object.freeze({});
  if (!fetch) return actuales;
  const control = typeof AbortController === 'function' ? new AbortController() : null;
  const reloj = control ? setTimeout(() => control.abort(), espera) : null;
  try {
    const r = await fetch(url, { cache: 'no-cache', credentials: 'omit', ...(control ? { signal: control.signal } : {}) });
    if (!r?.ok) return actuales;
    return fijar(JSON.parse(await r.text()));
  } catch {
    return actuales;
  } finally {
    if (reloj) clearTimeout(reloj);
  }
}

const vacio = (x) => x === undefined || x === null || (Array.isArray(x) ? x.flat(Infinity).every((h) => String(h ?? '').trim() === '') : String(x).trim() === '');

/**
 * Los defectos del sitio que a `yo` le faltan (no tiene ese ajuste en su libro): { preferencias: { clave: texto },
 * exterior: { clave: texto } }, listos para pasarlos como `valores` a carta.preferencias y a guia.ajustesEditablesDe
 * (el formulario los enseña; no se escribe nada). Con `eje` nulo (una cuenta aún sin libro) faltan todos.
 */
export function faltantes(eje, yo, { defectos: d = actuales, ...opciones } = {}) {
  const salida = { preferencias: {}, exterior: {} };
  const claves = Object.keys(d);
  if (!claves.length) return salida;
  const propias = eje && yo ? contrato.configuracion(eje, yo, opciones) : {};
  const fuera = eje && yo ? contrato.configuracionDe(eje, yo, exterior.AJUSTES.plantilla, opciones) : {};
  for (const clave of claves) {
    const sitioDe = esDePreferencias(clave) ? salida.preferencias : salida.exterior;
    if (vacio(esDePreferencias(clave) ? propias[clave] : fuera[clave])) sitioDe[clave] = d[clave];
  }
  return salida;
}
