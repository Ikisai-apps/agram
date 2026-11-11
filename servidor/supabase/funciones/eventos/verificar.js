// Lo que el servidor comprueba de un evento: su FORMA, no las reglas. Es una
// reimplementación mínima de src/evento.js (canónico, cuerpo, hash, con Web
// Crypto) y src/autoridad.js (verificar la firma Schnorr BIP-340 sobre
// secp256k1), que corre igual en Deno (la función de borde, index.ts) y en Node
// (la prueba de paridad, test/paridad-funcion.test.js, la compara con el núcleo).
// No importa nada del núcleo: la función se despliega sola. Su única
// dependencia es noble-secp256k1.js, en esta misma carpeta: una copia idéntica,
// byte a byte, de src/vendor/noble-secp256k1.js (el sha256 lo da
// src/vendor/LEEME.md y lo comprueba test/autoridad.test.js).
//
// Lo que NO hace, a propósito: validar movimientos, payload BTML, el instante
// t, las reglas de la época ni las pruebas de posesión. Eso lo valida cada
// cliente con src/eje.js (quien no pase va a `rechazados` del cliente, nunca
// al servidor: el servidor solo guarda, ordena por llegada y da la hora).

import { schnorr } from './noble-secp256k1.js';

export const RAIZ = '0000000000';

/** Los campos de un evento tal como se guardan (el mismo orden que src/evento.js, normalizarEvento). */
export const CAMPOS = Object.freeze(['autor', 'sobre', 'en', 't', 'movimientos', 'payload', 'contexto', 'id', 'firmante', 'firma', 'posesion']);

/** JSON canónico: claves ordenadas, sin espacios, con la semántica de JSON (igual que src/evento.js). */
export function canonico(valor) {
  return ordenado(aJSON(valor));
}

function ordenado(valor) {
  if (Array.isArray(valor)) return '[' + valor.map(ordenado).join(',') + ']';
  if (valor !== null && typeof valor === 'object') {
    const claves = Object.keys(valor).sort();
    return '{' + claves.map((k) => JSON.stringify(k) + ':' + ordenado(valor[k])).join(',') + '}';
  }
  return JSON.stringify(valor);
}

/** El valor tal como queda tras pasar por JSON. Lanza si no cabe (ciclos, BigInt). */
export function aJSON(valor) {
  const texto = JSON.stringify(valor);
  return texto === undefined ? null : JSON.parse(texto);
}

/** Cuerpo del evento sin su id: lo que se hashea y lo que firma el autor (src/evento.js, cuerpo). */
export function cuerpo(ev) {
  return {
    autor: ev.autor,
    sobre: ev.sobre,
    en: ev.en ?? RAIZ,
    t: ev.t,
    movimientos: ev.movimientos,
    payload: ev.payload,
    contexto: ev.contexto ?? {},
  };
}

/** SHA-256 en hexadecimal. */
export async function hash(texto) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** La copia de un evento con solo sus campos conocidos, pasada por JSON (lo que se guarda). Lanza si no cabe en JSON. */
export function normalizar(ev) {
  if (!ev || typeof ev !== 'object' || Array.isArray(ev)) return null;
  const copia = {};
  for (const k of CAMPOS) {
    if (k === 'en') copia.en = ev.en === undefined ? RAIZ : ev.en;
    else if (k === 'contexto') copia.contexto = ev.contexto ?? {};
    else copia[k] = ev[k];
  }
  return aJSON(copia);
}

/** ¿Es `id` un hash SHA-256 en hexadecimal? */
export const esHash = (id) => typeof id === 'string' && /^[0-9a-f]{64}$/.test(id);

/**
 * Errores de forma que el servidor mira antes de nada (vacío si la forma vale):
 * autor, id (un hash), firmante = autor, firma (64 bytes en hex), sobre (id o null),
 * en (diez dígitos), contexto (un objeto) y posesion (objeto de firmas) si va.
 */
export function errores(ev) {
  if (!ev || typeof ev !== 'object' || Array.isArray(ev)) return ['el evento no es un objeto'];
  const e = [];
  if (typeof ev.autor !== 'string' || !ev.autor) e.push('autor obligatorio');
  if (!esHash(ev.id)) e.push('id debe ser un hash SHA-256 en hexadecimal');
  if (!esFirma(ev.firma)) e.push('firma obligatoria (64 bytes en hexadecimal)');
  if (ev.firmante !== ev.autor) e.push('el firmante debe ser el autor');
  if (ev.sobre !== null && typeof ev.sobre !== 'string') e.push('sobre debe ser id o null');
  if (typeof ev.en !== 'string' || !/^[0-9]{10}$/.test(ev.en)) e.push('en debe ser una dirección de diez dígitos');
  if (typeof ev.t !== 'string') e.push('t debe ser un texto (instante)');
  if (!Array.isArray(ev.movimientos)) e.push('movimientos debe ser una lista');
  if (ev.contexto === null || typeof ev.contexto !== 'object' || Array.isArray(ev.contexto)) e.push('contexto debe ser un objeto');
  if (ev.posesion !== undefined && (ev.posesion === null || typeof ev.posesion !== 'object' || Array.isArray(ev.posesion)
    || Object.values(ev.posesion).some((f) => typeof f !== 'string'))) e.push('posesion debe ser un objeto { identidad: firma }');
  return e;
}

/** ¿Corresponde el id al cuerpo? */
export async function verificarId(ev) {
  return ev.id === (await hash(canonico(cuerpo(ev))));
}

const aBytes = (hex) => Uint8Array.from(hex.match(/.{2}/g), (h) => parseInt(h, 16));

/** ¿Es `firma` una firma BIP-340 escrita como la escribe src/autoridad.js: 64 bytes en hexadecimal (minúsculas)? */
export const esFirma = (firma) => typeof firma === 'string' && /^[0-9a-f]{128}$/.test(firma);

/**
 * ¿Tiene `clave` la forma de una clave pública declarable: 32 bytes x-only en
 * hexadecimal (minúsculas)? Que su x sea de un punto de la curva lo mira
 * verificarFirma (una clave sin punto no verifica nada).
 */
export function esClavePublica(clave) {
  return esHash(clave);
}

/**
 * ¿Firma `firma` (BIP-340, hex, como la escribe src/autoridad.js) el id (hex)
 * con la clave pública `clave` (x-only, hex)? false ante cualquier cosa rara, sin lanzar.
 */
export async function verificarFirma(firma, id, clave) {
  if (!esFirma(firma) || !esHash(id) || !esClavePublica(clave)) return false;
  try {
    return schnorr.verify(aBytes(firma), aBytes(id), aBytes(clave));
  } catch {
    return false;
  }
}

/** La clave que `ev` declara para `identidad` en su contexto (contexto.claves), o undefined. */
export function claveDeclarada(ev, identidad) {
  const claves = ev?.contexto?.claves;
  return claves && typeof claves === 'object' && !Array.isArray(claves) && Object.hasOwn(claves, identidad) ? claves[identidad] : undefined;
}

/** ¿Es `ev` un génesis (el primer evento de un eje: sin foco, marcado como tal)? */
export const esGenesis = (ev) => ev.sobre === null && ev.contexto?.genesis === true;

/**
 * La comprobación entera que hace el servidor de un evento que llega a un eje:
 * la forma, el id y la firma con la clave del autor. `claveDelAutor` es una
 * función async (autor) → clave pública (hex) | undefined que busca la clave declarada en el
 * alta del autor entre los eventos ya guardados del eje; `vacio` dice si el eje
 * no tiene aún ningún evento. Devuelve { ok: true, evento } (la copia
 * normalizada, lo que se guarda) o { ok: false, estado, error }: 400 si la
 * forma, el id o la firma no valen; 403 si el autor no tiene alta en el eje.
 */
export async function comprobar(crudo, { vacio, claveDelAutor }) {
  let ev;
  try {
    ev = normalizar(crudo);
  } catch (e) {
    return { ok: false, estado: 400, error: 'el evento no cabe en JSON: ' + e.message };
  }
  const e = errores(ev);
  if (e.length) return { ok: false, estado: 400, error: 'evento mal formado: ' + e.join('; ') };
  if (!(await verificarId(ev))) return { ok: false, estado: 400, error: 'el id no corresponde al cuerpo' };
  let clave;
  if (vacio) {
    if (!esGenesis(ev)) return { ok: false, estado: 400, error: 'el eje está vacío: solo se admite su génesis' };
    clave = claveDeclarada(ev, ev.autor);
    if (!esClavePublica(clave)) return { ok: false, estado: 400, error: 'el génesis debe declarar la clave de su autor (contexto.claves) y firmarse con ella' };
  } else {
    if (esGenesis(ev)) return { ok: false, estado: 400, error: 'el eje ya tiene génesis' };
    clave = await claveDelAutor(ev.autor);
    if (!esClavePublica(clave)) return { ok: false, estado: 403, error: 'el autor no tiene alta con clave en este eje: ' + ev.autor };
  }
  if (!(await verificarFirma(ev.firma, ev.id, clave))) return { ok: false, estado: 400, error: 'firma inválida de ' + ev.autor };
  return { ok: true, evento: ev };
}
