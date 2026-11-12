// §6 del contrato AGRAM ↔ exterior: identidades y custodia, SIMULADO.
//
// Un firmante externo (la clave vive aquí, fuera del navegador) que imita el llavero multidominio de
// stateark-app (ronda 1), adaptado al formato de firma ACTUAL de AGRAM (11-11): BIP-340 sobre el id del
// evento, id = SHA-256 del cuerpo canónico, claves x-only.
//
// Reglas del llavero, las mismas que stateark-app:
//   - Una raíz al azar por clave y ninguna semilla maestra: perder una no cuesta las demás.
//   - La privada nunca sale. No hay ninguna función pública que firme bytes sueltos: cada dominio tiene
//     su entrada tipada y comprueba lo que firma.
//
// Dominios:
//   'agram'   firma eventos de AGRAM: RECALCULA el id desde el cuerpo canónico y solo firma si cuadra.
//   'cartera' firma autorizaciones de pago del §5 (hash etiquetado con StateArk/App/PaymentAuthorization/v1).
// Y una entrada común: la declaración cruzada (vínculo) entre una clave 'agram' y una 'cartera', firmada
// por las dos sobre un mensaje con su propia etiqueta. Ninguna firma de un dominio vale en otro.
//
// La criptografía se inyecta (`esquema`): sin dependencias. AGRAM pasa su noble con `esquemaNoble(schnorr)`.
// Sin esquema se usa uno SIMULADO, que cualquiera puede falsificar: solo para pruebas.

import { esId, sha256Texto, hashEtiquetadoBytes, leHex } from './hash.js';
import { canonico, huella, hashEtiquetado } from './canon.js';
import { mensajeAutorizacion } from './pagos.js';
import { sobreDeRecibo } from './recibo.js';

export const DOMINIOS = Object.freeze(['agram', 'cartera', 'nostr']);
export const USO_SESION = 'StateArk/Sesion/v1';
export const USO_REVOCACION = 'StateArk/Sesion/Revocacion/v1';
export const USO_RECIBO_CANAL = 'StateArk/Canal/Recibo/v1';
export const USO_OBSERVADOR = 'StateArk/Observador/Cabecera/v1';
export const TIPOS_DE_CANAL = Object.freeze(['whatsapp', 'telegram', 'correo']);
export const USO_VINCULO = 'StateArk/Vinculo/AgramCartera/v1';
export const ESQUEMA_VINCULO = 'stateark-sim/vinculo@1';

const HEX = /^[0-9a-f]*$/;
const aBytes = (h) => Uint8Array.from(h.match(/../g) ?? [], (x) => parseInt(x, 16));
const aHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

export class RechazoCustodia extends Error {
  constructor(codigo, mensaje) {
    super(`${codigo}: ${mensaje}`);
    this.codigo = codigo;
  }
}
const rechazo = (codigo, mensaje) => new RechazoCustodia(codigo, mensaje);

/** Esquema SIMULADO: publica = H(privada), firma = H(publica ‖ mensaje). Cualquiera que sepa la pública la falsifica. */
export const esquemaSimulado = Object.freeze({
  nombre: 'simulado',
  publica: (privada) => sha256Texto(`stateark-sim/publica:${privada}`),
  firmar: async (mensaje, privada) => sha256Texto(`stateark-sim/firma:${await sha256Texto(`stateark-sim/publica:${privada}`)}:${mensaje}`),
  verificar: async (firma, mensaje, publica) => firma === (await sha256Texto(`stateark-sim/firma:${publica}:${mensaje}`)),
});

/** Adapta el `schnorr` de noble-secp256k1 (el que AGRAM incluye en src/vendor) a la forma de esquema. */
export function esquemaNoble(schnorr) {
  return Object.freeze({
    nombre: 'bip340',
    publica: (privada) => aHex(schnorr.getPublicKey(aBytes(privada))),
    firmar: (mensaje, privada) => aHex(schnorr.sign(aBytes(mensaje), aBytes(privada), globalThis.crypto.getRandomValues(new Uint8Array(32)))),
    verificar: (firma, mensaje, publica) => {
      try { return schnorr.verify(aBytes(firma), aBytes(mensaje), aBytes(publica)); } catch { return false; }
    },
  });
}

function privadaNueva() {
  return aHex(globalThis.crypto.getRandomValues(new Uint8Array(32)));
}

export class Custodia {
  #claves = new Map(); // `${dominio}/${nombre}` → { privada, publica }
  #canales = new Map(); // nombre → { tipo, credencial, secretoWebhook, sal, puede, contactos: Map id → dato, dueno }
  #revocadas = new Map(); // clave de sesión → revocación firmada

  /** @param {object} [opciones] { esquema } (por defecto, el simulado) */
  constructor(opciones = {}) {
    this.esquema = opciones.esquema ?? esquemaSimulado;
  }

  get simulada() {
    return this.esquema === esquemaSimulado;
  }

  #clave(dominio, nombre) {
    const k = this.#claves.get(`${dominio}/${nombre}`);
    if (!k) throw rechazo('key_unknown', `no hay clave «${nombre}» en el dominio «${dominio}»`);
    return k;
  }

  /** Crea una clave nueva, con su propia raíz al azar. Devuelve solo la pública. */
  async crearClave(dominio, nombre) {
    if (!DOMINIOS.includes(dominio)) throw rechazo('domain_unknown', `dominio «${dominio}»; los que hay: ${DOMINIOS.join(', ')}`);
    if (typeof nombre !== 'string' || !nombre) throw rechazo('name_missing', 'la clave necesita un nombre');
    if (this.#claves.has(`${dominio}/${nombre}`)) throw rechazo('key_exists', `ya hay una clave «${nombre}» en «${dominio}»`);
    let privada;
    let publica;
    // Una privada al azar de 32 bytes vale casi siempre; si el esquema la rechaza (≥ n), se saca otra.
    for (let intento = 0; intento < 8 && !publica; intento++) {
      privada = privadaNueva();
      try { publica = await this.esquema.publica(privada); } catch { publica = undefined; }
    }
    if (!esId(publica)) throw rechazo('key_invalid', 'el esquema no dio una pública x-only');
    this.#claves.set(`${dominio}/${nombre}`, { privada, publica });
    return { dominio, nombre, publica };
  }

  /** La pública de una clave (la privada no sale nunca). */
  publica(dominio, nombre) {
    return this.#clave(dominio, nombre).publica;
  }

  /** Lo que hay, sin privadas. */
  listar() {
    return [...this.#claves].map(([k, v]) => {
      const [dominio, ...resto] = k.split('/');
      return { dominio, nombre: resto.join('/'), publica: v.publica };
    });
  }

  // ── Dominio 'agram' ────────────────────────────────────────────────────────────────────────────

  /**
   * Firma un evento de AGRAM a partir de su cuerpo canónico (lo que AGRAM hashea: `canonico(cuerpo(ev))`) y
   * el id que dice tener. Recalcula id = SHA-256(canónico) y, si no cuadra, NO firma: así no se puede colar
   * un mensaje de 32 bytes de otra procedencia. Devuelve { id, firmante, firma }, como el bloque de AGRAM.
   */
  async firmarAgram(nombre, { canonico: cuerpoCanonico, id }) {
    const k = this.#clave('agram', nombre);
    if (typeof cuerpoCanonico !== 'string' || !cuerpoCanonico) throw rechazo('canonical_missing', 'no hay cuerpo canónico que hashear');
    if (!esId(id)) throw rechazo('id_invalid', 'el id es un SHA-256 en 64 hex');
    const calculado = await sha256Texto(cuerpoCanonico);
    if (calculado !== id) throw rechazo('id_mismatch', `el id no es el SHA-256 de su cuerpo: esperaba ${calculado} y venía ${id}`);
    return { id, firmante: k.publica, firma: await this.esquema.firmar(id, k.privada) };
  }

  /**
   * Comodidad: firma un evento entero si se le da cómo sacar su cuerpo canónico (AGRAM: `(ev) => canonico(cuerpo(ev))`).
   * Devuelve el evento con `firmante` y `firma`, igual que `autoridad.firmar` de AGRAM.
   */
  async firmarEvento(nombre, evento, canonicoDe) {
    if (typeof canonicoDe !== 'function') throw rechazo('canonical_missing', 'hace falta la función de AGRAM que da el cuerpo canónico');
    const { firmante, firma } = await this.firmarAgram(nombre, { canonico: await canonicoDe(evento), id: evento.id });
    return Object.freeze({ ...evento, firmante, firma });
  }

  /** Verifica la firma de un evento de AGRAM (BIP-340 sobre el id). No recalcula el id: eso es de AGRAM (`verificarId`). */
  async verificarAgram(evento) {
    if (!esId(evento?.id) || !esId(evento?.firmante) || typeof evento?.firma !== 'string' || !HEX.test(evento.firma)) return false;
    return Boolean(await this.esquema.verificar(evento.firma, evento.id, evento.firmante));
  }

  // ── Dominio 'cartera' ──────────────────────────────────────────────────────────────────────────

  /** Firma la autorización de un plan de pago del §5. Devuelve { titular, firma }, listo para `carril.autorizar(plan, …)`. */
  async firmarAutorizacion(nombre, plan) {
    const k = this.#clave('cartera', nombre);
    if (plan?.schema !== 'stateark.payment-plan@1') throw rechazo('not_a_plan', 'solo se autorizan planes de pago');
    const mensaje = await mensajeAutorizacion(await huella(plan));
    return { titular: k.publica, firma: await this.esquema.firmar(mensaje, k.privada) };
  }

  /** El verificador que necesita el carril del §5 (`new Carril(sellador, { verificarFirma })`). */
  verificadorDeFirma() {
    return async (firma, mensaje, titular) => Boolean(await this.esquema.verificar(firma, mensaje, titular));
  }

  // ── Vínculo: identidad de AGRAM ↔ cartera ─────────────────────────────────────────────────────

  /**
   * Declaración cruzada: la clave de AGRAM y la de la cartera son de la misma persona. Las dos firman el mismo
   * mensaje, con su etiqueta propia (USO_VINCULO), así que la firma no vale ni como evento de AGRAM ni como
   * autorización de pago. Se guarda en AGRAM como registro y cualquiera la comprueba con `verificarVinculo`.
   */
  async vincular(nombreAgram, nombreCartera, { instante } = {}) {
    const a = this.#clave('agram', nombreAgram);
    const c = this.#clave('cartera', nombreCartera);
    const cuerpo = { schema: ESQUEMA_VINCULO, uso: USO_VINCULO, agram: a.publica, cartera: c.publica, instante: instante ?? new Date().toISOString() };
    const mensaje = await mensajeVinculo(cuerpo);
    return {
      ...cuerpo,
      firmas: { agram: await this.esquema.firmar(mensaje, a.privada), cartera: await this.esquema.firmar(mensaje, c.privada) },
    };
  }

  verificarVinculo(vinculo) {
    return verificarVinculo(vinculo, this.esquema);
  }

  // ── Observador de cabeceras (H9, VG 12-11) ────────────────────────────────────────────────────

  /**
   * Firma, como servicio, que vio esta cabecera a esta altura: BIP-340 sobre el hash etiquetado
   * «StateArk/Observador/Cabecera/v1» de cabecera (80 bytes) ‖ altura (4 bytes little-endian).
   * Solo una clave de servicio (dominio 'nostr'), y solo sobre 80 bytes y una altura: nada más.
   */
  async firmarCabecera(nombre, cabecera, altura) {
    const k = this.#clave('nostr', nombre);
    if (!/^[0-9a-f]{160}$/.test(cabecera ?? '')) throw rechazo('header_invalid', 'una cabecera son 80 bytes en hex');
    if (!Number.isSafeInteger(altura) || altura < 0 || altura > 0xffffffff) throw rechazo('height_invalid', 'la altura es un entero de 4 bytes');
    const alturaLe = leHex(altura, 4);
    const mensaje = await hashEtiquetadoBytes(USO_OBSERVADOR, aBytes(cabecera + alturaLe));
    return { clave: k.publica, firma: await this.esquema.firmar(mensaje, k.privada), altura_le: alturaLe };
  }

  // ── Recibos (B19) ──────────────────────────────────────────────────────────────────────────────

  /**
   * Firma un recibo único (stateark.recibo@1). Las claves de servicio (dominio 'nostr') firman cualquier clase
   * salvo «rotación»; una rotación solo la firma la clave de AGRAM que rota, y solo sobre sí misma.
   */
  async firmarRecibo(nombre, campos, { t, dominio = 'nostr' } = {}) {
    if (campos?.clase === 'rotación') {
      if (dominio !== 'agram') throw rechazo('wrong_domain', 'una rotación la firma la clave de AGRAM que rota');
      const k = this.#clave('agram', nombre);
      if (campos.sujeto?.[0] !== k.publica) throw rechazo('wrong_subject', 'una clave solo firma su propia rotación');
      if (!campos.ata?.some(([c, v]) => c === 'sucesora' && esId(v) && v !== k.publica)) throw rechazo('successor_missing', 'la rotación nombra su sucesora, otra clave x-only');
    } else if (dominio !== 'nostr') {
      throw rechazo('wrong_domain', 'los recibos los firman las claves de servicio (dominio nostr)');
    }
    const k = this.#clave(dominio, nombre);
    const sobre = await sobreDeRecibo(k.publica, campos, t ?? new Date().toISOString());
    return { ...sobre, firma: await this.esquema.firmar(sobre.id, k.privada) };
  }

  // ── Canales (VG, 12-11): credenciales de cuentas de una identidad del libro ─────────────────────
  //
  // StateArk guarda la credencial y hace SOLO la llamada autenticada de salida y la comprobación del
  // secreto de lo que entra. La pasarela de AARPIA orquesta (convierte en registro, enruta, encola,
  // reintenta) y nunca ve la credencial ni el dato de contacto: trabaja con ids opacos.
  // SIMULADO: no hay red; «enviar» devuelve el recibo de lo que habría salido.

  /** Guarda un canal. Devuelve solo huellas: la credencial y el secreto de webhooks no salen. */
  async guardarCanal(nombre, { tipo, credencial, secretoWebhook, puede = ['enviar', 'recibir'], dueno = null }) {
    if (typeof nombre !== 'string' || !nombre) throw rechazo('name_missing', 'el canal necesita un nombre');
    if (this.#canales.has(nombre)) throw rechazo('channel_exists', `ya hay un canal «${nombre}»`);
    if (!TIPOS_DE_CANAL.includes(tipo)) throw rechazo('channel_type_unknown', `tipo «${tipo}»; los que hay: ${TIPOS_DE_CANAL.join(', ')}`);
    if (typeof credencial !== 'string' || !credencial) throw rechazo('credential_missing', 'el canal necesita su credencial');
    if (typeof secretoWebhook !== 'string' || !secretoWebhook) throw rechazo('credential_missing', 'el canal necesita el secreto de sus webhooks');
    this.#canales.set(nombre, { tipo, credencial, secretoWebhook, sal: privadaNueva(), puede: [...puede], contactos: new Map(), dueno });
    if (!this.#claves.has('nostr/servicio')) await this.crearClave('nostr', 'servicio');
    return {
      canal: nombre,
      tipo,
      huella_credencial: await sha256Texto(`stateark-sim/credencial:${credencial}`),
      huella_webhook: await sha256Texto(`stateark-sim/webhook:${secretoWebhook}`),
      servicio: this.publica('nostr', 'servicio'),
    };
  }

  #canal(nombre) {
    const c = this.#canales.get(nombre);
    if (!c) throw rechazo('channel_unknown', `no hay ningún canal «${nombre}»`);
    return c;
  }

  /** El id opaco de un contacto (teléfono, correo, chat). La pasarela solo ve este id. */
  async contacto(nombre, dato) {
    const c = this.#canal(nombre);
    if (typeof dato !== 'string' || !dato) throw rechazo('contact_missing', 'el contacto está vacío');
    const id = await hmac(c.sal, dato);
    c.contactos.set(id, dato);
    return id;
  }

  /**
   * La llamada autenticada de salida: la pasarela pide enviar un cuerpo a un contacto opaco. StateArk
   * resuelve el contacto, usa la credencial (aquí, simulado) y devuelve un recibo firmado con su clave
   * de servicio: qué canal, a qué id opaco, la huella del cuerpo y cuándo. Ni la credencial ni el dato salen.
   */
  async enviar(nombre, { contacto, cuerpo, instante }) {
    const c = this.#canal(nombre);
    if (!c.puede.includes('enviar')) throw rechazo('not_allowed', 'este canal no puede enviar');
    if (!c.contactos.has(contacto)) throw rechazo('contact_unknown', 'ese id de contacto no es de este canal');
    if (typeof cuerpo !== 'string') throw rechazo('body_missing', 'el cuerpo es un texto');
    void (await hmac(c.credencial, `${c.contactos.get(contacto)}\n${cuerpo}`)); // la «autenticación» simulada; no sale
    const recibo = {
      schema: 'stateark-sim/recibo-canal@1', uso: USO_RECIBO_CANAL, canal: nombre, tipo: c.tipo,
      contacto, huella_cuerpo: await sha256Texto(cuerpo), instante: instante ?? new Date().toISOString(),
      servicio: this.publica('nostr', 'servicio'),
    };
    const k = this.#clave('nostr', 'servicio');
    return { ...recibo, firma: await this.esquema.firmar(await hashEtiquetado(USO_RECIBO_CANAL, canonico(recibo)), k.privada) };
  }

  /** Comprueba el secreto de lo que entra por un webhook: HMAC-SHA256 del cuerpo con el secreto del canal («sha256=<hex>»). */
  async comprobarEntrada(nombre, cuerpo, cabecera) {
    const c = this.#canal(nombre);
    if (!c.puede.includes('recibir')) return { ok: false, motivo: 'este canal no puede recibir' };
    const esperado = `sha256=${await hmac(c.secretoWebhook, cuerpo)}`;
    return esperado === cabecera ? { ok: true, motivo: 'auténtico' } : { ok: false, motivo: 'la firma del webhook no casa' };
  }

  // ── Delegación de sesión para la infraestructura de AARPIA (VG, 12-11) ──────────────────────────
  //
  // La clave Nostr de larga vida está aquí (dominio 'nostr'). AARPIA trabaja con claves de sesión de vida
  // corta que se emiten y se revocan aquí. EXCEPCIÓN deliberada a «la privada no sale»: la privada de la
  // SESIÓN se entrega, porque es de AARPIA; la de larga vida no sale nunca.

  async emitirSesion(nombreLarga, { alcance, segundos = 3600, desde } = {}) {
    const k = this.#clave('nostr', nombreLarga);
    if (!Array.isArray(alcance) || !alcance.length || !alcance.every(Number.isInteger)) throw rechazo('scope_invalid', 'el alcance es una lista de kinds de Nostr');
    if (!Number.isInteger(segundos) || segundos <= 0 || segundos > 86_400) throw rechazo('scope_invalid', 'una sesión dura entre 1 s y 24 h');
    let privada;
    let publica;
    for (let i = 0; i < 8 && !publica; i++) {
      privada = privadaNueva();
      try { publica = await this.esquema.publica(privada); } catch { publica = undefined; }
    }
    const inicio = desde ?? new Date().toISOString();
    const cuerpo = { schema: 'stateark-sim/delegacion@1', uso: USO_SESION, larga: k.publica, sesion: publica, alcance: [...alcance].sort((a, b) => a - b), desde: inicio, hasta: new Date(Date.parse(inicio) + segundos * 1000).toISOString() };
    const delegacion = { ...cuerpo, firma: await this.esquema.firmar(await hashEtiquetado(USO_SESION, canonico(cuerpo)), k.privada) };
    return { privada, delegacion };
  }

  async revocarSesion(nombreLarga, sesion, { instante } = {}) {
    const k = this.#clave('nostr', nombreLarga);
    const cuerpo = { schema: 'stateark-sim/revocacion@1', uso: USO_REVOCACION, larga: k.publica, sesion, instante: instante ?? new Date().toISOString() };
    const revocacion = { ...cuerpo, firma: await this.esquema.firmar(await hashEtiquetado(USO_REVOCACION, canonico(cuerpo)), k.privada) };
    this.#revocadas.set(sesion, revocacion);
    return revocacion;
  }

  /** Las revocaciones publicadas (para que un relé las tenga). */
  revocaciones() {
    return [...this.#revocadas.values()];
  }
}

/** HMAC-SHA256 en hex (Web Crypto: Node, navegador y Deno). */
async function hmac(clave, texto) {
  const enc = new TextEncoder();
  const k = await globalThis.crypto.subtle.importKey('raw', enc.encode(clave), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return Array.from(new Uint8Array(await globalThis.crypto.subtle.sign('HMAC', k, enc.encode(texto))), (x) => x.toString(16).padStart(2, '0')).join('');
}

/** El secreto de un webhook, como lo calcularía el proveedor (para pruebas y para la pasarela simulada). */
export async function firmaDeWebhook(secreto, cuerpo) {
  return `sha256=${await hmac(secreto, cuerpo)}`;
}

/**
 * Comprueba una delegación de sesión sin la custodia (lo que hace un relé de AARPIA): firma de la clave de
 * larga vida, plazo, alcance del kind y que no esté revocada (por una revocación firmada por la misma clave).
 */
export async function verificarSesion(d, { ahora, kind, revocaciones = [], esquema = esquemaSimulado } = {}) {
  if (d?.schema !== 'stateark-sim/delegacion@1' || d.uso !== USO_SESION) return { ok: false, motivo: 'no es una delegación de sesión' };
  const { firma, ...cuerpo } = d;
  if (!(await esquema.verificar(firma, await hashEtiquetado(USO_SESION, canonico(cuerpo)), d.larga))) return { ok: false, motivo: 'la firma de la clave de larga vida no verifica' };
  const t = Date.parse(ahora ?? new Date().toISOString());
  if (t < Date.parse(d.desde) || t >= Date.parse(d.hasta)) return { ok: false, motivo: 'fuera de plazo' };
  if (kind !== undefined && !d.alcance.includes(kind)) return { ok: false, motivo: `el kind ${kind} no está en su alcance` };
  for (const r of revocaciones) {
    if (r?.sesion !== d.sesion || r.larga !== d.larga) continue;
    const { firma: fr, ...cr } = r;
    if (await esquema.verificar(fr, await hashEtiquetado(USO_REVOCACION, canonico(cr)), r.larga)) return { ok: false, motivo: 'revocada' };
  }
  return { ok: true, motivo: 'sesión válida', sesion: d.sesion, hasta: d.hasta };
}

/** El mensaje que firman las dos claves de un vínculo. */
export function mensajeVinculo({ schema, uso, agram, cartera, instante }) {
  return hashEtiquetado(USO_VINCULO, canonico({ schema, uso, agram, cartera, instante }));
}

/** Comprueba un vínculo con cualquier esquema, sin necesitar la custodia que lo hizo. */
export async function verificarVinculo(v, esquema = esquemaSimulado) {
  if (v?.schema !== ESQUEMA_VINCULO || v.uso !== USO_VINCULO) return { ok: false, motivo: 'no es un vínculo' };
  if (!esId(v.agram) || !esId(v.cartera)) return { ok: false, motivo: 'las claves son x-only de 64 hex' };
  if (v.agram === v.cartera) return { ok: false, motivo: 'un vínculo une dos claves distintas' };
  const mensaje = await mensajeVinculo(v);
  if (!(await esquema.verificar(v.firmas?.agram, mensaje, v.agram))) return { ok: false, motivo: 'la firma de la clave de AGRAM no verifica' };
  if (!(await esquema.verificar(v.firmas?.cartera, mensaje, v.cartera))) return { ok: false, motivo: 'la firma de la clave de la cartera no verifica' };
  return { ok: true, motivo: 'vinculadas', agram: v.agram, cartera: v.cartera, instante: v.instante };
}

/** Comprueba, sin la custodia, que un observador firmó esta cabecera a esta altura. */
export async function verificarObservacion({ cabecera, altura_le, firma, clave }, { esquema = esquemaSimulado } = {}) {
  if (!/^[0-9a-f]{160}$/.test(cabecera ?? '') || !/^[0-9a-f]{8}$/.test(altura_le ?? '') || !esId(clave)) return false;
  const mensaje = await hashEtiquetadoBytes(USO_OBSERVADOR, aBytes(cabecera + altura_le));
  return Boolean(await esquema.verificar(firma, mensaje, clave));
}
