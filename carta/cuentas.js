// Mi cuenta (etapa 2 del roadmap hasta el MVP): entrar en AGRAM como uno mismo y no como una identidad de ejemplo.
// Una CUENTA es { nombre, idioma, identidad, alta, publica }: un eje propio cuyo génesis es mi alta, escrita por mí
// (una persona: B1) con mi clave pública declarada en ella (B4: la clave va en el 5 del alta) y firmada con la
// privada, que se genera en este dispositivo (src/autoridad.js) y nunca sale de él sin cifrar. Todo lo que decide
// algo lo hace el núcleo: el génesis es Eje.genesis (la única alta sin invitación), el idioma es un registro de
// preferencias en el 9 de mi alta (la plantilla «preferences» de la época, carta/carta.js preferencias), las
// etiquetas del alta las da el contrato, y un eje restaurado pasa por la validación normal (persistencia.restaurar
// revalida cada evento: ids, firmas, saldos).
//
// Lo que vive en este navegador (localStorage, por cuenta, sin mezclarse con los ejemplos):
//   agram.cuentas             la lista de mis cuentas (sin claves privadas)
//   agram.cuenta              la última usada: el id de su alta, o «ejemplo»
//   agram.eje.<alta>          su eje serializado (persistencia.serializar)
//   agram.clave.<alta>        su clave privada: 32 bytes en hexadecimal (BIP-340, src/autoridad.js), como las de las
//                             identidades de ejemplo en agram.claves: tal cual, sin cifrar; solo la frase de la copia
//                             la cifra al salir del navegador
//   agram.local.<alta>.<yo>   el libro local de quien mira en esa cuenta
//   agram.sync.<alta>         su clave de lectura del libro compartido (un secreto: nunca en el eje; va cifrada en la copia)
//   agram.sync.estado.<alta>  el estado de su sincronía (src/sincronia.js serializar: la cola, los órdenes del
//                             servidor, lo rechazado; sin la clave de lectura): carta/sincronia.js
// Los ejemplos siguen en agram.eje, agram.claves, agram.foco, agram.yo, agram.ejemplo y agram.local.<yo>.
//
// La COPIA DE SEGURIDAD es un archivo agram-cuenta-<nombre>.json con la clave privada (y, si la hay, la clave de
// lectura del libro compartido) cifrada con una frase (PBKDF2 con sal aleatoria y muchas iteraciones → AES-GCM, con
// el id del alta como dato asociado), la clave pública, el nombre, el id del alta y el eje serializado: una FOTO del
// eje; con el libro compartido configurado, el otro dispositivo baja el resto del servidor al restaurar
// (carta/sincronia.js). La frase no se guarda en ningún sitio; el archivo no lleva nada en claro salvo el nombre, el
// idioma, la identidad, el id y la clave pública (y el eje, que es público por naturaleza).
//
// Sin DOM: lo prueba test/cuentas.test.js con el WebCrypto de Node. carta/app.js lo engancha a la pantalla.

import { Eje, autoridad, persistencia, contrato, salida } from '../src/index.js';
import { plantillaDePreferencias, preferencias } from './carta.js';
import { CLAVES as GUIA } from './guia.js';

/** Las claves de localStorage de las cuentas. Las de los ejemplos, aparte (CLAVES_EJEMPLO), y no se cruzan. */
export const CLAVES = Object.freeze({
  cuentas: 'agram.cuentas',
  ultima: 'agram.cuenta',
  eje: (alta) => 'agram.eje.' + alta,
  clave: (alta) => 'agram.clave.' + alta,
  local: (alta, yo) => 'agram.local.' + alta + '.' + yo,
  lectura: (alta) => 'agram.sync.' + alta,
  sincronia: (alta) => 'agram.sync.estado.' + alta,
});

/** Las claves de localStorage de los ejemplos (las de siempre: carta/app.js y antigua/ui/ejemplos.js). */
export const CLAVES_EJEMPLO = Object.freeze({
  eje: 'agram.eje',
  claves: 'agram.claves',
  foco: 'agram.foco',
  yo: 'agram.yo',
  ejemplo: 'agram.ejemplo',
  local: (yo) => 'agram.local.' + yo,
});

/** El valor de agram.cuenta cuando lo último usado fue un ejemplo. */
export const EJEMPLO = 'ejemplo';

/** El formato del archivo de copia y su versión. */
export const FORMATO = 'agram-cuenta';
// La 2: claves Schnorr BIP-340 (docs/notas/FIRMAS_BIP340.md). Sin compatibilidad: una copia de la 1 (claves P-256) no
// se restaura.
export const VERSION = 2;

/** Cómo se cifra la clave privada en la copia: PBKDF2 (SHA-256, sal de 16 bytes, 600 000 iteraciones) → AES-GCM 256 (iv de 12 bytes). */
export const CIFRADO = Object.freeze({ kdf: 'PBKDF2', hash: 'SHA-256', iteraciones: 600000, sal: 16, cifrado: 'AES-GCM', bits: 256, iv: 12 });

const subtle = () => globalThis.crypto.subtle;
const utf8 = (s) => new TextEncoder().encode(s);
const aBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const deBase64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const aleatorio = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));
const hoja = (x) => (Array.isArray(x) ? x[0] : x);
const texto = (x) => (typeof x === 'string' ? x : undefined);

// ---------- la identidad y el archivo ----------

/**
 * El id de identidad que sale de un nombre: minúsculas, sin acentos, los huecos como guiones («Víctor Gil» →
 * «victor-gil»). Si no queda nada legible, la huella de la clave pública. El nombre entero va en el 0 del alta.
 */
export function identidadDe(nombre, publica) {
  const limpio = String(nombre ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return limpio || (publica ? autoridad.huella(publica) : '');
}

/** El nombre del archivo de copia de una cuenta. */
export function nombreDeArchivo(cuenta) {
  return FORMATO + '-' + (identidadDe(cuenta?.nombre) || cuenta?.identidad || 'cuenta') + '.json';
}

// ---------- los campos del alta (lo que pide la pantalla de crear) ----------

/** La clave de la preferencia del idioma, como la nombra el contrato (§7): la posición de la configuración cuyo defecto es un idioma de la época. */
function claveIdioma(opciones) {
  const defectos = contrato.configuracion(null, null, opciones);
  const idiomas = contrato.idiomas(opciones);
  return Object.keys(defectos).find((k) => typeof defectos[k] === 'string' && idiomas.includes(defectos[k])) ?? null;
}

/**
 * Los campos que pide crear una cuenta, con las etiquetas, ayudas y marcadores del núcleo en el idioma dado: el
 * nombre (el 0 del alta: la etiqueta de la posición 0 de un registro sin plantilla, la regla corta de la época) y el
 * idioma (la posición «language» de la plantilla «preferences», con los idiomas que tienen mensajes en la época).
 * → [{ nombre: 'nombre' | 'idioma', pv, etiqueta, ayuda, marcador, opciones?, valor? }]
 */
export function camposDelAlta({ idioma, epoca } = {}) {
  const o = { idioma, epoca };
  const candidata = { payload: [] };
  // Sin marcador: el de la regla corta del 0 es un ejemplo de fórmula, no un nombre.
  const campos = [{ nombre: 'nombre', pv: 0, etiqueta: contrato.etiqueta(null, candidata, 0, o), ayuda: contrato.ayuda(null, candidata, 0, o), marcador: [] }];
  const p = plantillaDePreferencias(o);
  const clave = claveIdioma(o);
  if (p && clave) {
    const d = p.registro.findIndex((desc, k) => k > 0 && Array.isArray(desc) && hoja(desc[0]) === clave);
    const desc = d > 0 ? p.registro[d] : null;
    const T = (que, original) => contrato.texto(null, contrato.claves.parametro(p.nombre, clave, que), idioma, { original, epoca });
    const ultima = (x) => (Array.isArray(x) ? x[x.length - 1] : x);
    campos.push({
      nombre: 'idioma', pv: d, clave,
      etiqueta: T('label', clave), ayuda: T('help', texto(ultima(desc?.[9])) ?? ''),
      marcador: [contrato.configuracion(null, null, o)[clave]],
      opciones: contrato.idiomas(o), valor: idioma ?? contrato.configuracion(null, null, o)[clave],
    });
  }
  return campos;
}

// ---------- crear ----------

/**
 * Crea mi cuenta: genera el par de claves en este dispositivo y un eje nuevo cuyo génesis es mi alta, escrita por
 * mí (persona), con el nombre en su 0, la clave pública declarada en ella (su 5) y firmada con la privada. El
 * génesis referencia la época 0 (lo hace Eje.genesis) y es la única alta sin invitación. Si `idioma` difiere del
 * de la época, escribe además mi configuración (un registro «preferences» en el 9 de mi alta, firmado) con él.
 * → { cuenta, eje, privada, publica } (las dos claves en hexadecimal)
 */
export async function crearCuenta({ nombre, idioma, t = new Date().toISOString(), epoca } = {}) {
  const limpio = String(nombre ?? '').trim();
  if (!limpio) throw new Error('la cuenta necesita un nombre: el 0 de tu alta');
  const { publica, privada } = await autoridad.generarClaves();
  const identidad = identidadDe(limpio, publica);
  const eje = await Eje.genesis({ identidad, foco: limpio, t, clave: publica, privada });
  const alta = eje.alta(identidad).id;
  const o = epoca ? { epoca } : {};
  if (idioma && idioma !== contrato.configuracion(eje, identidad, o)[claveIdioma(o)]) {
    const p = preferencias(eje, identidad, { [claveIdioma(o)]: idioma }, o);
    if (p) await salida.escribirDesde(eje, { modo: 'sequenced', autor: identidad, sobre: p.sobre, en: p.en, payload: p.payload, t }, privada);
  }
  const cuenta = { nombre: limpio, idioma: idioma ?? contrato.configuracion(eje, identidad, o)[claveIdioma(o)], identidad, alta, publica };
  return { cuenta, eje, privada, publica };
}

/** Una función que firma con la clave privada de la cuenta (lo que la carta pasa a transaccion, autoejecutar y englobar). */
export const firmarCon = (privada) => (ev) => autoridad.firmar(ev, privada);

// ---------- guardar en este navegador ----------

const leer = (clave) => { try { return globalThis.localStorage?.getItem(clave) ?? null; } catch { return null; } };
const escribir = (clave, valor) => { try { if (!globalThis.localStorage) return false; globalThis.localStorage.setItem(clave, valor); return true; } catch { return false; } };
const borrar = (clave) => { try { globalThis.localStorage?.removeItem(clave); } catch { /* sin almacenamiento */ } };

/** Mis cuentas en este navegador: [{ nombre, idioma, identidad, alta, publica }], sin claves privadas. */
export function cuentas() {
  try {
    const lista = JSON.parse(leer(CLAVES.cuentas) ?? '[]');
    return Array.isArray(lista) ? lista.filter((c) => c && typeof c.alta === 'string' && typeof c.identidad === 'string') : [];
  } catch {
    return [];
  }
}

/** La última cuenta usada (el id de su alta), EJEMPLO si lo último fue un ejemplo, o null si nunca se eligió nada. */
export function ultima() {
  return leer(CLAVES.ultima);
}

export function recordarUltima(alta) {
  return escribir(CLAVES.ultima, alta);
}

/**
 * Guarda una cuenta en este navegador: la lista, su eje, su clave privada (hex, como las de ejemplo) y, si viene
 * (una copia restaurada que la llevaba), su clave de lectura. Devuelve false si no hay almacenamiento.
 */
export async function guardarCuenta({ cuenta, eje, privada, claveLectura }) {
  const guardable = await autoridad.exportarPrivada(privada);
  const lista = cuentas().filter((c) => c.alta !== cuenta.alta);
  lista.push({ nombre: cuenta.nombre, idioma: cuenta.idioma, identidad: cuenta.identidad, alta: cuenta.alta, publica: cuenta.publica });
  const ok = escribir(CLAVES.cuentas, JSON.stringify(lista)) && escribir(CLAVES.clave(cuenta.alta), guardable) && persistencia.guardarLocal(eje, CLAVES.eje(cuenta.alta))
    && (!claveLectura || guardarClaveLectura(cuenta.alta, claveLectura));
  if (ok) recordarUltima(cuenta.alta);
  return ok;
}

/** La clave de lectura del libro compartido de una cuenta (agram.sync.<alta>), o null. Nunca va en el eje. */
export function claveLectura(alta) {
  const v = leer(CLAVES.lectura(alta));
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** Guarda la clave de lectura de una cuenta; vacía, la borra. Devuelve false si no hay almacenamiento. */
export function guardarClaveLectura(alta, clave) {
  const v = typeof clave === 'string' ? clave.trim() : '';
  if (!v) { borrar(CLAVES.lectura(alta)); return true; }
  return escribir(CLAVES.lectura(alta), v);
}

/** El estado guardado de la sincronía de una cuenta (lo que dio Sincronia#serializar), o null. */
export function estadoSincronia(alta) {
  try {
    const datos = JSON.parse(leer(CLAVES.sincronia(alta)) ?? 'null');
    return datos && typeof datos === 'object' ? datos : null;
  } catch {
    return null;
  }
}

/** Guarda el estado de la sincronía de una cuenta (Sincronia#serializar: sin la clave de lectura). */
export function guardarEstadoSincronia(alta, datos) {
  return escribir(CLAVES.sincronia(alta), JSON.stringify(datos));
}

/** Guarda solo el eje de una cuenta (tras cada registro nuevo). */
export function guardarEje(cuenta, eje) {
  return persistencia.guardarLocal(eje, CLAVES.eje(cuenta.alta));
}

/**
 * Abre una cuenta guardada en este navegador: restaura su eje (revalidado) y lee su clave privada; comprueba que
 * el eje declara para mi identidad la clave pública de la cuenta. → { cuenta, eje, privada, publica } o, si falta
 * algo o no cuadra, sin `eje` y con el motivo en `motivo` (si lo que falta es solo el eje, con `privada`: la carta
 * puede bajarlo del libro compartido, carta/sincronia.js). Una cuenta de antes de las firmas BIP-340 (su clave
 * privada guardada no es hexadecimal: era un JWK P-256) no se abre: va con `antigua: true`.
 */
export async function abrirCuenta(alta) {
  const cuenta = cuentas().find((c) => c.alta === alta);
  if (!cuenta) return { motivo: 'no hay ninguna cuenta con ese alta en este navegador' };
  try {
    const guardada = leer(CLAVES.clave(alta));
    if (!guardada) return { cuenta, motivo: 'la clave privada de la cuenta no está en este navegador' };
    if (!/^[0-9a-f]{64}$/.test(guardada)) return { cuenta, antigua: true, motivo: 'la clave privada guardada no es una clave BIP-340 (cuenta de antes del cambio de firmas)' };
    const privada = await autoridad.importarPrivada(guardada);
    if (autoridad.publicaDe(privada) !== cuenta.publica) return { cuenta, motivo: 'la clave privada guardada no es la pareja de la pública de la cuenta' };
    const eje = await persistencia.cargarLocal(CLAVES.eje(alta));
    if (!eje) return { cuenta, privada, publica: cuenta.publica, motivo: 'el eje de la cuenta no está o no se ha podido abrir' };
    if (!mismaClave(eje.clave(cuenta.identidad), cuenta.publica) || eje.alta(cuenta.identidad)?.id !== alta) return { cuenta, motivo: 'el eje guardado no declara la clave de la cuenta' };
    return { cuenta, eje, privada, publica: cuenta.publica };
  } catch (e) {
    return { cuenta, motivo: String(e?.message ?? e) };
  }
}

/**
 * Olvida una cuenta en este navegador: su eje, su clave privada, sus libros locales, su clave de lectura, el estado de
 * su sincronía y su entrada en la lista. Sin copia, no se recupera.
 */
export function olvidarCuenta(alta, identidades = []) {
  const lista = cuentas().filter((c) => c.alta !== alta);
  escribir(CLAVES.cuentas, JSON.stringify(lista));
  borrar(CLAVES.eje(alta));
  borrar(CLAVES.clave(alta));
  borrar(CLAVES.lectura(alta));
  borrar(CLAVES.sincronia(alta));
  borrar(GUIA.ia(alta)); // la clave de la guía (vía directa) y su conversación, también de este navegador
  borrar(GUIA.historial(alta));
  for (const yo of identidades) borrar(CLAVES.local(alta, yo));
  if (ultima() === alta) borrar(CLAVES.ultima);
}

/** Las claves de localStorage que usa una cuenta (para comprobar que no se cruzan con las de los ejemplos). */
export function clavesDe(cuenta, identidades = [cuenta.identidad]) {
  return [CLAVES.cuentas, CLAVES.ultima, CLAVES.eje(cuenta.alta), CLAVES.clave(cuenta.alta), CLAVES.lectura(cuenta.alta), CLAVES.sincronia(cuenta.alta), ...identidades.map((yo) => CLAVES.local(cuenta.alta, yo))];
}

/** ¿Son la misma clave pública (el mismo texto hexadecimal x-only)? */
export function mismaClave(a, b) {
  return typeof a === 'string' && a !== '' && a === b;
}

// ---------- la copia de seguridad ----------

/** La clave AES derivada de la frase con PBKDF2 (los parámetros vienen del archivo o de CIFRADO). */
async function claveDeFrase(frase, sal, iteraciones) {
  const base = await subtle().importKey('raw', utf8(frase), CIFRADO.kdf, false, ['deriveKey']);
  return subtle().deriveKey({ name: CIFRADO.kdf, hash: CIFRADO.hash, salt: sal, iterations: iteraciones }, base, { name: CIFRADO.cifrado, length: CIFRADO.bits }, false, ['encrypt', 'decrypt']);
}

/**
 * Exporta la cuenta como archivo de copia: la clave privada cifrada con la frase (y, si se da, la clave de lectura
 * del libro compartido, dentro de lo cifrado), la pública, el nombre, el idioma, la identidad, el id del alta y el eje
 * serializado (una foto). La frase no se guarda. → el objeto del archivo (JSON).
 *
 * Lo cifrado es { privada } o, con clave de lectura, { privada, claveLectura } (la privada en hexadecimal).
 */
export async function exportarCuenta({ cuenta, eje, privada, claveLectura }, frase, { iteraciones = CIFRADO.iteraciones, t = new Date().toISOString() } = {}) {
  if (typeof frase !== 'string' || !frase) throw new Error('la copia necesita una frase');
  const guardable = await autoridad.exportarPrivada(privada);
  const sal = aleatorio(CIFRADO.sal);
  const iv = aleatorio(CIFRADO.iv);
  const clave = await claveDeFrase(frase, sal, iteraciones);
  const lectura = typeof claveLectura === 'string' ? claveLectura.trim() : '';
  const secreto = lectura ? { privada: guardable, claveLectura: lectura } : { privada: guardable };
  const datos = await subtle().encrypt({ name: CIFRADO.cifrado, iv, additionalData: utf8(cuenta.alta) }, clave, utf8(JSON.stringify(secreto)));
  return {
    formato: FORMATO,
    version: VERSION,
    exportado: t,
    nombre: cuenta.nombre,
    idioma: cuenta.idioma,
    identidad: cuenta.identidad,
    alta: cuenta.alta,
    publica: cuenta.publica,
    clave: { kdf: CIFRADO.kdf, hash: CIFRADO.hash, iteraciones, sal: aBase64(sal), cifrado: CIFRADO.cifrado, iv: aBase64(iv), datos: aBase64(datos) },
    eje: persistencia.serializar(eje),
  };
}

/** El texto del archivo de copia, como se descarga. */
export const textoDeArchivo = (archivo) => JSON.stringify(archivo);

/** La frase no abre el archivo: un solo motivo, sin pistas (la frase está mal o el archivo no es el que era). */
export const FRASE_INCORRECTA = 'la frase no abre esta copia (frase incorrecta o archivo dañado)';

/**
 * Restaura una cuenta desde su archivo de copia y la frase: descifra la clave privada (y la de lectura, si la
 * lleva), comprueba que es la pareja de la pública, restaura el eje (persistencia.restaurar: cada evento
 * se revalida) y comprueba que el eje declara esa clave para la identidad en su alta. → { cuenta, eje, privada,
 * publica, claveLectura } (claveLectura: undefined si la copia no la lleva). Lanza con un motivo claro.
 */
export async function restaurarCuenta(archivo, frase) {
  const a = typeof archivo === 'string' ? JSON.parse(archivo) : archivo;
  if (!a || a.formato !== FORMATO || !Number.isInteger(a.version)) throw new Error('el archivo no es una copia de una cuenta de AGRAM');
  // `antigua`: una copia de antes de las firmas BIP-340 (la 1, claves P-256): la carta lo dice con su texto.
  if (a.version !== VERSION) throw Object.assign(new Error('copia de la versión ' + a.version + '; esta carta lee la ' + VERSION), { antigua: a.version < VERSION });
  const c = a.clave;
  if (!c || c.kdf !== CIFRADO.kdf || c.cifrado !== CIFRADO.cifrado || typeof c.sal !== 'string' || typeof c.iv !== 'string' || typeof c.datos !== 'string' || !Number.isSafeInteger(c.iteraciones) || c.iteraciones < 1) {
    throw new Error('el archivo no lleva la clave cifrada como esta carta la escribe');
  }
  if (typeof a.alta !== 'string' || typeof a.identidad !== 'string' || !autoridad.clavePublicaValida(a.publica)) throw new Error('el archivo no lleva la identidad, el alta y la clave pública');
  if (typeof frase !== 'string' || !frase) throw new Error(FRASE_INCORRECTA);
  let guardada;
  let claveLectura;
  try {
    const clave = await claveDeFrase(frase, deBase64(c.sal), c.iteraciones);
    const claro = await subtle().decrypt({ name: CIFRADO.cifrado, iv: deBase64(c.iv), additionalData: utf8(a.alta) }, clave, deBase64(c.datos));
    const secreto = JSON.parse(new TextDecoder().decode(claro));
    guardada = secreto?.privada;
    if (secreto && typeof secreto.claveLectura === 'string' && secreto.claveLectura) claveLectura = secreto.claveLectura;
  } catch {
    throw new Error(FRASE_INCORRECTA);
  }
  let privada;
  try {
    privada = await autoridad.importarPrivada(guardada);
  } catch {
    privada = null;
  }
  if (!privada || !mismaClave(autoridad.publicaDe(privada), a.publica)) throw new Error('la clave privada de la copia no es la pareja de la pública');
  const eje = await persistencia.restaurar(a.eje);
  if (!mismaClave(eje.clave(a.identidad), a.publica) || eje.alta(a.identidad)?.id !== a.alta) throw new Error('el eje de la copia no declara esa clave para ' + a.identidad + ' en su alta');
  const cuenta = { nombre: String(a.nombre ?? a.identidad), idioma: typeof a.idioma === 'string' ? a.idioma : undefined, identidad: a.identidad, alta: a.alta, publica: a.publica };
  return { cuenta, eje, privada, publica: cuenta.publica, claveLectura };
}
