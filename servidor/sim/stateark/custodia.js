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

import { esId, sha256Texto } from './hash.js';
import { canonico, huella, hashEtiquetado } from './canon.js';
import { mensajeAutorizacion } from './pagos.js';

export const DOMINIOS = Object.freeze(['agram', 'cartera']);
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
