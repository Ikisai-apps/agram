// §5 del contrato AGRAM ↔ exterior: pagos reales detrás de E, SIMULADOS.
//
// Imita el carril Bitcoin en cadena de stateark-app (P4, P3E y rondas 1–3), que es el más maduro de
// StateArk: una orden de pago llega de fuera y se cumple en tres actos.
//
//   preparar(cartera, instruccion)        → plan           (no firma nada; dice qué monedas, vuelta, comisión)
//   autorizar(plan, { titular, firma })   → autorizacion   (el sí del titular, con una clave que NO gasta)
//   ejecutar(cartera, plan, autorizacion) → recibo         (comprueba la autorización antes de gastar nada)
//   recibo(txid)                          → recibo al día  (con su bloque cuando lo haya)
//   verificarRecibo(recibo)               → { ok, motivo } (contra la cadena, sin fiarse de quien pagó)
//
// Fondos en sats de una serie de E: un pago cuyo destino es `{ clase: 'agram/serie', valor: <clave de
// la serie> }` deja sats en una salida comprometida con esa serie, dentro de la cartera del emisor.
//   verificarFondos(serie, recibo) → { ok, motivo, sat }  (la salida existe, es de esa serie y no se ha gastado)
//
// Frontera: aquí nunca se mueve E; en AGRAM nunca se mueven sats. Las referencias de AGRAM
// (originador_ref, proposito_ref, intencion_ref) viajan opacas: se copian al recibo y no deciden nada.
//
// Lo que finge: la cadena (compartida con el §3), las direcciones (`simbc1…`), la comisión, y la firma
// si no se inyecta un verificador real (ver `verificarFirma`).

import { esId, sha256, sha256Texto, aBytes } from './hash.js';
import { canonico, huella, hashEtiquetado } from './canon.js';

export const ESQUEMA_INSTRUCCION = 'stateark.payment-instruction@1';
export const ESQUEMA_PLAN = 'stateark.payment-plan@1';
export const ESQUEMA_AUTORIZACION = 'stateark.payment-authorization@1';
export const ESQUEMA_RECIBO = 'stateark/onchain-payment-receipt/v0-draft';
export const ESQUEMA_TX = 'stateark-sim/tx@1';
export const RAIL = 'bitcoin.onchain';
export const UNIVERSO = 'stateark-sim (SIMULADO: no es Bitcoin)';
export const USO = 'StateArk/App/PaymentAuthorization/v1';
export const PREFIJO_PUNTERO = 'agram:';
export const ESQUEMA_CANDADO = 'stateark-sim/htlc-receipt@1';

/** Un secreto nuevo para un candado: preimagen de 32 bytes y su hash (como el payment_hash de Lightning). */
export async function nuevoSecreto() {
  const p = new Uint8Array(32);
  globalThis.crypto.getRandomValues(p);
  const preimagen = [...p].map((b) => b.toString(16).padStart(2, '0')).join('');
  return { preimagen, hash: await sha256(p) };
}

/** SHA-256 de una preimagen en hex (sobre sus 32 bytes, no sobre el texto). */
export function hashDePreimagen(preimagen) {
  return sha256(aBytes(preimagen));
}

const TASA_SAT_VB = 2;
const POLVO = 330; // por debajo de esto la vuelta no se crea: va a comisión

/** Error con código fijo, como los de stateark-app (`expired`, `amount_invalid`…). */
export class RechazoPago extends Error {
  constructor(codigo, mensaje) {
    super(`${codigo}: ${mensaje}`);
    this.codigo = codigo;
  }
}
const rechazo = (codigo, mensaje) => new RechazoPago(codigo, mensaje);

/** El mensaje que firma el titular: hash etiquetado BIP-340 con USO sobre la huella del plan (como stateark-app). */
export function mensajeAutorizacion(huellaPlan) {
  return hashEtiquetado(USO, huellaPlan);
}

/** Firma SIMULADA: cualquiera que sepa la clave pública la puede hacer. Solo para la simulación. */
export function firmaSimulada(titular, mensaje) {
  return sha256Texto(`stateark-sim/firma:${titular}:${mensaje}`);
}

async function verificarFirmaSimulada(firma, mensaje, titular) {
  return firma === (await firmaSimulada(titular, mensaje));
}

async function direccionDe(nombre, etiqueta) {
  return `simbc1${(await sha256Texto(`stateark-sim/direccion:${nombre}:${etiqueta}`)).slice(0, 40)}`;
}

async function etiquetaDeSerie(serie) {
  return `fondos/${await sha256Texto(`stateark-sim/serie:${serie}`)}`;
}

const pesoVirtual = (entradas, salidas) => 11 + 58 * entradas + 43 * salidas;

export class Carril {
  /**
   * @param {import('./sello.js').Sellador} sellador comparte su cadena: los pagos entran en los mismos bloques
   * @param {object} [opciones]
   * @param {(firma: string, mensaje: string, titular: string) => Promise<boolean>} [opciones.verificarFirma]
   *        verificador de la firma del titular. Por defecto, el simulado; AGRAM puede pasar BIP-340 real.
   */
  constructor(sellador, opciones = {}) {
    this.sellador = sellador;
    this.cadena = sellador.cadena;
    this.verificarFirma = opciones.verificarFirma ?? verificarFirmaSimulada;
    this.carteras = new Map(); // nombre → { titular, direcciones: Map dir → etiqueta, cobro, cambio }
    this.monedas = new Map(); // "txid:vout" → { sat, direccion, gastada_por: txid|null }
    this.txs = new Map(); // txid → { tx, altura|null }
    this.pendientes = []; // txid sin bloque
    this.recibos = new Map(); // txid → recibo emitido (sin la posición)
    this.duenoDe = new Map(); // direccion → nombre de cartera
  }

  // ── Carteras y direcciones ─────────────────────────────────────────────────────────────────────

  /** Una cartera simulada. `titular` es la clave x-only que autoriza (en AGRAM, la de la identidad). */
  async crearCartera(nombre, { titular } = {}) {
    if (typeof nombre !== 'string' || !nombre) throw new TypeError('la cartera necesita un nombre');
    if (this.carteras.has(nombre)) throw new TypeError(`ya hay una cartera «${nombre}»`);
    if (!esId(titular)) throw new TypeError('el titular es una clave x-only (64 hex en minúsculas)');
    this.carteras.set(nombre, { titular, direcciones: new Map(), cobro: 0, cambio: 0 });
    return { nombre, titular };
  }

  #cartera(nombre) {
    const c = this.carteras.get(nombre);
    if (!c) throw new TypeError(`no hay ninguna cartera «${nombre}»`);
    return c;
  }

  async #derivar(nombre, etiqueta) {
    const dir = await direccionDe(nombre, etiqueta);
    this.#cartera(nombre).direcciones.set(dir, etiqueta);
    this.duenoDe.set(dir, nombre);
    return dir;
  }

  /** Una dirección nueva cada vez (`cobro/N`), como P3E. */
  async direccion(nombre) {
    const c = this.#cartera(nombre);
    return this.#derivar(nombre, `cobro/${c.cobro++}`);
  }

  /** La dirección de fondos de una serie de E dentro de una cartera (pago a contrato, simulado). */
  async direccionDeSerie(nombre, serie) {
    return this.#derivar(nombre, await etiquetaDeSerie(serie));
  }

  /** Saldo gastable: monedas confirmadas y sin gastar de la cartera, fuera de las de fondos de serie. */
  saldo(nombre) {
    const c = this.#cartera(nombre);
    let sat = 0;
    for (const m of this.monedas.values()) {
      const etiqueta = c.direcciones.get(m.direccion);
      if (etiqueta && !etiqueta.startsWith('fondos/') && !m.gastada_por && this.txs.get(m.txid).altura !== null) sat += m.sat;
    }
    return sat;
  }

  /** Solo en la simulación: crea sats de la nada en una dirección (un grifo). Entran en el próximo bloque. */
  async acunar(direccion, sat) {
    if (!Number.isSafeInteger(sat) || sat <= 0) throw new TypeError('acuñar necesita un entero positivo de sat');
    const tx = { esquema: ESQUEMA_TX, entradas: [], salidas: [{ sat, direccion }], grifo: await sha256Texto(`grifo:${this.txs.size}:${Date.now()}`) };
    return this.#difundir(tx);
  }

  // ── §5: preparar, autorizar, ejecutar ──────────────────────────────────────────────────────────

  #comprobarInstruccion(ins) {
    if (!ins || typeof ins !== 'object') throw rechazo('schema_unknown', 'no es una orden de pago');
    if (ins.schema !== ESQUEMA_INSTRUCCION) throw rechazo('schema_unknown', `esta orden dice ser «${ins.schema}»`);
    if (ins.rail !== RAIL) throw rechazo('rail_unknown', `no sé ejecutar en «${ins.rail}»`);
    if (ins.asset !== 'BTC') throw rechazo('asset_unknown', `no sé mover «${ins.asset}»`);
    if (ins.amount?.unidad !== 'sat') throw rechazo('amount_unit_invalid', `el importe ha de venir en «sat»`);
    const v = ins.amount?.valor;
    if (!Number.isSafeInteger(v) || v <= 0) throw rechazo('amount_invalid', 'el importe es un entero positivo de sat');
    if (v < POLVO) throw rechazo('amount_invalid', `por debajo de ${POLVO} sat no se paga en cadena`);
    const d = ins.destino;
    if (d?.clase !== 'bitcoin/address' && d?.clase !== 'agram/serie' && d?.clase !== 'htlc/sha256') throw rechazo('destination_kind_unknown', `no sé pagar a «${d?.clase}»`);
    if (typeof d.valor !== 'string' || !d.valor) throw rechazo('destination_invalid', 'el destino está vacío');
    if (d.clase === 'bitcoin/address' && !/^simbc1[0-9a-f]{40}$/.test(d.valor)) throw rechazo('destination_invalid', 'no es una dirección de la simulación');
    if (d.clase === 'htlc/sha256') {
      if (!esId(d.valor)) throw rechazo('destination_invalid', 'el candado necesita el hash H (64 hex)');
      if (!/^simbc1[0-9a-f]{40}$/.test(d.cobra ?? '')) throw rechazo('destination_invalid', 'el candado necesita la dirección de quien cobra');
      if (!Number.isSafeInteger(d.vence) || d.vence <= this.cadena.altura + 1) throw rechazo('destination_invalid', 'el candado vence a una altura futura, más allá del próximo bloque');
    }
    const ven = ins.vencimiento;
    if (ven) {
      if (ven.unidad !== 'bitcoin_block_height') throw rechazo('vencimiento_unit_invalid', `la unidad es «${ven.unidad}»`);
      if (ven.fuente !== 'consenso') throw rechazo('vencimiento_source_invalid', `la fuente es «${ven.fuente}»`);
      if (ven.marca !== 'valido_hasta') throw rechazo('vencimiento_mark_invalid', `la marca es «${ven.marca}»`);
      if (!Number.isSafeInteger(ven.valor)) throw rechazo('vencimiento_unit_invalid', 'la altura es un entero');
    }
    if (ins.on_timeout !== undefined && ins.on_timeout !== 'caducado') throw rechazo('on_timeout_unknown', `«${ins.on_timeout}»`);
    if (typeof ins.correlation_id !== 'string' || !ins.correlation_id) throw rechazo('correlation_missing', 'una orden de fuera tiene que poder correlacionarse');
    if (ins.puntero !== undefined && ins.puntero !== null && !esId(ins.puntero)) throw rechazo('pointer_invalid', 'el puntero es un id de AGRAM (64 hex)');
  }

  #caducada(ins) {
    const proxima = this.cadena.altura + 1; // la altura a la que entraría el pago
    if (ins.vencimiento && proxima > ins.vencimiento.valor) {
      throw rechazo('expired', `la orden valía hasta la altura ${ins.vencimiento.valor} y el pago entraría en la ${proxima}`);
    }
  }

  /** Acto 1: dice qué ocurriría. No firma ni reserva nada. */
  async preparar(nombre, instruccion) {
    const c = this.#cartera(nombre);
    this.#comprobarInstruccion(instruccion);
    this.#caducada(instruccion);
    const importe = instruccion.amount.valor;
    let destino = instruccion.destino.valor;
    let candado = null;
    if (instruccion.destino.clase === 'agram/serie') destino = await this.direccionDeSerie(nombre, instruccion.destino.valor);
    if (instruccion.destino.clase === 'htlc/sha256') {
      const d = instruccion.destino;
      c.reembolso = (c.reembolso ?? 0) + 1;
      const reembolso = await this.#derivar(nombre, `reembolso/${c.reembolso}`);
      candado = { hash: d.valor, cobra: d.cobra, reembolso, vence: d.vence };
      destino = `simhtlc1${(await huella(candado)).slice(0, 40)}`;
    }

    const disponibles = [...this.monedas.entries()]
      .filter(([, m]) => {
        const et = c.direcciones.get(m.direccion);
        return et && !et.startsWith('fondos/') && !m.gastada_por && this.txs.get(m.txid).altura !== null;
      })
      .sort((a, b) => b[1].sat - a[1].sat || (a[0] < b[0] ? -1 : 1)); // de mayor a menor, como P4

    const entradas = [];
    let entra = 0;
    const nSalidas = 2 + (instruccion.puntero ? 1 : 0);
    for (const [, m] of disponibles) {
      entradas.push({ txid: m.txid, vout: m.vout, sat: m.sat, altura: this.txs.get(m.txid).altura });
      entra += m.sat;
      if (entra >= importe + TASA_SAT_VB * pesoVirtual(entradas.length, nSalidas)) break;
    }
    const peso = pesoVirtual(entradas.length, nSalidas);
    let comision = TASA_SAT_VB * peso;
    if (entra < importe + comision) throw rechazo('insufficient_funds', `hacen falta ${importe + comision} sat y hay ${entra}`);
    let cambio = entra - importe - comision;
    let cambioA = null;
    let cambioOrigen = null;
    if (cambio >= POLVO) {
      cambioOrigen = `cambio/${c.cambio}`;
      cambioA = await this.#derivar(nombre, cambioOrigen);
      c.cambio++;
    } else {
      comision += cambio; // el polvo va a comisión
      cambio = 0;
    }
    return {
      schema: ESQUEMA_PLAN,
      instruccion: await huella(instruccion),
      correlacion: instruccion.correlation_id,
      destino,
      importe_sat: importe,
      comision_sat: comision,
      cambio_sat: cambio,
      cambio_a: cambioA,
      cambio_origen: cambioOrigen,
      puntero: instruccion.puntero ?? null,
      candado,
      entradas,
      tasa_sat_vb: TASA_SAT_VB,
      peso_virtual_estimado: peso,
    };
  }

  /** Acto 2: el sí del titular. `firma` la hace quien tiene la clave (con BIP-340 real, o `firmaSimulada`). */
  async autorizar(plan, { titular, firma }) {
    if (plan?.schema !== ESQUEMA_PLAN) throw rechazo('schema_unknown', 'no es un plan de pago');
    if (!esId(titular)) throw rechazo('authorization_invalid', 'el titular es una clave x-only');
    const huellaPlan = await huella(plan);
    const mensaje = await mensajeAutorizacion(huellaPlan);
    if (!(await this.verificarFirma(firma, mensaje, titular))) throw rechazo('signature_invalid', 'la firma de la autorización no verifica');
    return { schema: ESQUEMA_AUTORIZACION, plan: huellaPlan, instruccion: plan.instruccion, correlacion: plan.correlacion, titular, uso: USO, firma };
  }

  /** Acto 3: comprueba todo antes de gastar nada, y solo entonces difunde. Devuelve el recibo (pendiente hasta el bloque). */
  async ejecutar(nombre, instruccion, plan, autorizacion) {
    const c = this.#cartera(nombre);
    this.#comprobarInstruccion(instruccion);
    const huellaIns = await huella(instruccion);
    const huellaPlan = await huella(plan);
    if (plan.instruccion !== huellaIns) throw rechazo('plan_mismatch', 'este plan es de otra orden');
    if (autorizacion?.schema !== ESQUEMA_AUTORIZACION) throw rechazo('authorization_invalid', 'no es una autorización');
    if (autorizacion.plan !== huellaPlan) throw rechazo('authorization_mismatch', `la autorización cubre ${autorizacion.plan} y el plan es ${huellaPlan}`);
    if (autorizacion.instruccion !== huellaIns) throw rechazo('authorization_mismatch', 'la autorización es de otra orden');
    if (autorizacion.titular !== c.titular) throw rechazo('authorization_not_holder', 'no la firma el titular de esta cartera');
    if (!(await this.verificarFirma(autorizacion.firma, await mensajeAutorizacion(huellaPlan), c.titular))) {
      throw rechazo('signature_invalid', 'la firma de la autorización no verifica');
    }
    this.#caducada(instruccion);
    // Las cuentas tienen que cuadrar y cada entrada ha de ser de esta cartera y estar libre.
    const entra = plan.entradas.reduce((n, e) => n + e.sat, 0);
    if (entra !== plan.importe_sat + plan.comision_sat + plan.cambio_sat) throw rechazo('plan_unbalanced', 'entradas ≠ importe + comisión + vuelta');
    if (plan.importe_sat !== instruccion.amount.valor) throw rechazo('plan_mismatch', 'el importe del plan no es el de la orden');
    // Reejecutar el mismo plan da la misma transacción: no se duplica (como en stateark-app).
    const salidas = [plan.candado ? { sat: plan.importe_sat, direccion: plan.destino, candado: plan.candado } : { sat: plan.importe_sat, direccion: plan.destino }];
    if (plan.cambio_sat) salidas.push({ sat: plan.cambio_sat, direccion: plan.cambio_a });
    if (plan.puntero) salidas.push({ sat: 0, op_return: PREFIJO_PUNTERO + plan.puntero });
    const tx = { esquema: ESQUEMA_TX, entradas: plan.entradas.map((e) => ({ txid: e.txid, vout: e.vout })), salidas };
    const txid = await huella(tx);
    for (const e of plan.entradas) {
      const m = this.monedas.get(`${e.txid}:${e.vout}`);
      if (!m || m.sat !== e.sat) throw rechazo('input_unknown', `la moneda ${e.txid}:${e.vout} no existe`);
      if (!c.direcciones.has(m.direccion)) throw rechazo('input_not_owned', `ninguna clave de esta cartera abre ${e.txid}:${e.vout}`);
      if (m.gastada_por && m.gastada_por !== txid) throw rechazo('input_spent', `${e.txid}:${e.vout} ya se gastó en ${m.gastada_por}`);
    }
    if (!this.txs.has(txid)) await this.#difundir(tx);
    const recibo = {
      schema: ESQUEMA_RECIBO,
      rail: RAIL,
      universe: UNIVERSO,
      instruccion: {
        huella: huellaIns,
        correlacion: instruccion.correlation_id,
        proposito_ref: instruccion.proposito_ref ?? null,
        originador_ref: instruccion.originador_ref ?? null,
        plan: huellaPlan,
        autorizacion: autorizacion.titular,
        intencion_ref: instruccion.intencion_ref ?? null,
      },
      destino: plan.destino,
      destino_clase: instruccion.destino.clase,
      serie: instruccion.destino.clase === 'agram/serie' ? instruccion.destino.valor : null,
      importe_sat: plan.importe_sat,
      comision_sat: plan.comision_sat,
      cambio_sat: plan.cambio_sat,
      cambio_a: plan.cambio_a,
      entradas: plan.entradas,
      puntero: plan.puntero,
      candado: plan.candado ?? null,
      emitido_en: new Date(this.cadena.reloj()).toISOString(),
      alcance: [
        'afirma que esta transacción está en la cadena (simulada) y paga ese importe a ese destino',
        'NO afirma quién controla ese destino: eso lo sabe quien tenga su clave',
        'NO afirma por qué se pagó: las referencias de propósito vienen de fuera y aquí son opacas',
        'NO afirma que el pago cumpla una E de AGRAM: eso lo lee AGRAM por el puntero',
        'sólo vale en el universo declarado: es una SIMULACIÓN',
      ],
    };
    this.recibos.set(txid, recibo);
    return this.recibo(txid);
  }

  async #difundir(tx) {
    const txid = await huella(tx);
    for (const e of tx.entradas) {
      const m = this.monedas.get(`${e.txid}:${e.vout}`);
      if (!m || m.gastada_por) throw rechazo('input_spent', `${e.txid}:${e.vout} no está libre`);
    }
    for (const e of tx.entradas) this.monedas.get(`${e.txid}:${e.vout}`).gastada_por = txid;
    tx.salidas.forEach((s, vout) => {
      if (s.direccion) this.monedas.set(`${txid}:${vout}`, { txid, vout, sat: s.sat, direccion: s.direccion, candado: s.candado ?? null, gastada_por: null });
    });
    this.txs.set(txid, { tx, altura: null });
    this.pendientes.push(txid);
    return { txid, pendiente: true };
  }

  /** Lo llama la simulación al minar: los txid pendientes entran en el bloque. */
  confirmar(txids, altura) {
    for (const t of txids) this.txs.get(t).altura = altura;
  }

  /** El recibo de un pago, con su posición al día. null si ese txid no es de un pago ejecutado aquí. */
  recibo(txid) {
    const base = this.recibos.get(txid);
    if (!base) return null;
    const { altura } = this.txs.get(txid);
    const b = altura === null ? null : this.cadena.bloque(altura);
    return {
      ...base,
      posicion: {
        txid,
        altura_del_bloque: altura,
        hash_del_bloque: b?.hash ?? null,
        instante_del_bloque: b?.instante ?? null,
        confirmaciones: altura === null ? 0 : this.cadena.altura - altura + 1,
      },
      proof_refs: [{
        kind: 'bitcoin/transaction',
        hash: txid,
        locator: 'la cadena simulada: búscala por su identificador',
        universe: UNIVERSO,
        binds_to: [['txid', txid], ['destino', base.destino], ['importe_sat', String(base.importe_sat)], ['instruccion', base.instruccion.huella]],
      }],
    };
  }

  /** La transacción de un txid (para quien quiera mirarla «en la cadena»). */
  transaccion(txid) {
    return this.txs.get(txid)?.tx ?? null;
  }

  // ── §8: candado por hash (HTLC) ───────────────────────────────────────────────────────────────
  //
  // El pago se hace con una orden de destino { clase: 'htlc/sha256', valor: H, cobra, vence }: los sats
  // quedan en una salida que solo se abre de dos maneras:
  //   reclamar(cobrador, H, s)  quien cobra, con s tal que SHA-256(s) = H, hasta la altura «vence»; s queda pública
  //   reembolsar(pagador, H)    quien pagó, cuando la cadena ha pasado de «vence»
  // AGRAM bloquea su E con la misma H y un vencimiento MAYOR, y la libera con la s que el cobro revela.

  #salidaDeCandado(hash) {
    for (const [punto, m] of this.monedas) if (m.candado?.hash === hash) return [punto, m];
    return [null, null];
  }

  async #gastarCandado(m, destino, extra) {
    const comision = TASA_SAT_VB * pesoVirtual(1, 1);
    if (m.sat - comision < POLVO) throw rechazo('amount_invalid', 'el candado no cubre la comisión');
    const tx = { esquema: ESQUEMA_TX, entradas: [{ txid: m.txid, vout: m.vout, ...extra }], salidas: [{ sat: m.sat - comision, direccion: destino }] };
    return this.#difundir(tx);
  }

  /** Cobrar: revela la preimagen. Solo la cartera dueña de la dirección «cobra», y hasta el vencimiento. */
  async reclamar(nombre, hash, preimagen) {
    const c = this.#cartera(nombre);
    const [, m] = this.#salidaDeCandado(hash);
    if (!m) throw rechazo('htlc_unknown', 'no hay ningún candado con ese hash');
    if (m.gastada_por) throw rechazo('input_spent', `el candado ya se abrió en ${m.gastada_por}`);
    if (this.txs.get(m.txid).altura === null) throw rechazo('htlc_unconfirmed', 'el pago con candado aún no está en un bloque');
    if (!c.direcciones.has(m.candado.cobra)) throw rechazo('input_not_owned', 'esta cartera no es la que cobra');
    if (!esId(preimagen) || (await hashDePreimagen(preimagen)) !== hash) throw rechazo('preimage_invalid', 'SHA-256(preimagen) no es H');
    if (this.cadena.altura + 1 > m.candado.vence) throw rechazo('expired', `el candado venció en la altura ${m.candado.vence}`);
    return this.#gastarCandado(m, m.candado.cobra, { preimagen });
  }

  /** Recuperar: solo quien pagó, y solo después del vencimiento. */
  async reembolsar(nombre, hash) {
    const c = this.#cartera(nombre);
    const [, m] = this.#salidaDeCandado(hash);
    if (!m) throw rechazo('htlc_unknown', 'no hay ningún candado con ese hash');
    if (m.gastada_por) throw rechazo('input_spent', `el candado ya se abrió en ${m.gastada_por}`);
    if (!c.direcciones.has(m.candado.reembolso)) throw rechazo('input_not_owned', 'esta cartera no es la que pagó');
    if (this.cadena.altura + 1 <= m.candado.vence) throw rechazo('not_expired', `el candado vale hasta la altura ${m.candado.vence}`);
    return this.#gastarCandado(m, m.candado.reembolso, { reembolso: true });
  }

  /** La preimagen de H si ya se reveló en un bloque, o null. Es lo que lee quien pagó para liberar su E en AGRAM. */
  async preimagenDe(hash) {
    for (const [txid, { tx, altura }] of this.txs) {
      if (altura === null) continue;
      for (const e of tx.entradas) {
        if (e.preimagen && (await hashDePreimagen(e.preimagen)) === hash) return { preimagen: e.preimagen, txid, altura };
      }
    }
    return null;
  }

  /**
   * El recibo del intercambio con candado, con lo que AGRAM guarda en el movimiento (contrato §8):
   * { en_firme, hash, preimagen, carril, estado, apertura, recibo }.
   */
  reciboCandado(hash) {
    const [punto, m] = this.#salidaDeCandado(hash);
    if (!m) return null;
    const ap = m.gastada_por ? this.txs.get(m.gastada_por) : null;
    const abierta = ap && ap.altura !== null ? ap : null;
    const entrada = abierta?.tx.entradas[0];
    return {
      schema: ESQUEMA_CANDADO,
      universe: UNIVERSO,
      carril: 'bitcoin',
      en_firme: punto,
      hash,
      preimagen: entrada?.preimagen ?? null,
      vence: m.candado.vence,
      estado: !abierta ? 'pendiente' : entrada.preimagen ? 'cobrado' : 'reembolsado',
      apertura: abierta ? { txid: m.gastada_por, altura: abierta.altura } : null,
      recibo: this.recibo(m.txid),
    };
  }

  /** Comprueba un recibo de candado contra la cadena: el pago es válido y su apertura revela s con SHA-256(s) = H. */
  async verificarCandado(rc) {
    if (rc?.schema !== ESQUEMA_CANDADO) return { ok: false, motivo: 'no es un recibo de candado' };
    const pago = await this.verificarRecibo(rc.recibo);
    if (!pago.ok) return { ok: false, motivo: `el pago: ${pago.motivo}` };
    if (rc.recibo.candado?.hash !== rc.hash) return { ok: false, motivo: 'el pago no es de ese candado' };
    const m = this.monedas.get(rc.en_firme);
    if (!m || m.txid !== pago.txid || m.candado?.hash !== rc.hash) return { ok: false, motivo: 'en_firme no es la salida del candado' };
    if (!rc.preimagen) return { ok: false, motivo: rc.estado === 'reembolsado' ? 'reembolsado: no hubo cobro' : 'pendiente: aún no se ha cobrado' };
    if (!esId(rc.preimagen) || (await hashDePreimagen(rc.preimagen)) !== rc.hash) return { ok: false, motivo: 'SHA-256(preimagen) no es H' };
    const ap = this.txs.get(m.gastada_por);
    if (!ap || ap.altura === null) return { ok: false, motivo: 'la apertura no está en un bloque' };
    if (ap.tx.entradas[0]?.preimagen !== rc.preimagen) return { ok: false, motivo: 'la apertura no revela esa preimagen' };
    return { ok: true, motivo: 'en firme', hash: rc.hash, preimagen: rc.preimagen, altura: ap.altura };
  }

  // ── Verificar sin fiarse de quien pagó ─────────────────────────────────────────────────────────

  /** Comprueba un recibo contra la cadena. Opción `confirmaciones` mínimas (por defecto 1). */
  async verificarRecibo(recibo, { confirmaciones = 1 } = {}) {
    if (recibo?.schema !== ESQUEMA_RECIBO) return { ok: false, motivo: 'no es un recibo' };
    if (recibo.universe !== UNIVERSO) return { ok: false, motivo: 'el recibo es de otro universo' };
    const txid = recibo.posicion?.txid;
    const registro = this.txs.get(txid);
    if (!registro) return { ok: false, motivo: 'esa transacción no está en la cadena' };
    if ((await huella(registro.tx)) !== txid) return { ok: false, motivo: 'la transacción no da su txid' };
    if (registro.altura === null) return { ok: false, motivo: 'pendiente: la transacción aún no está en un bloque' };
    const b = this.cadena.bloque(registro.altura);
    if (!b.lotes.includes(txid) || !(await this.cadena.integro(b.altura))) return { ok: false, motivo: 'el bloque no contiene esa transacción' };
    const conf = this.cadena.altura - b.altura + 1;
    if (conf < confirmaciones) return { ok: false, motivo: `${conf} confirmaciones de ${confirmaciones}` };
    const paga = registro.tx.salidas.some((s) => s.direccion === recibo.destino && s.sat === recibo.importe_sat);
    if (!paga) return { ok: false, motivo: 'ninguna salida paga ese importe a ese destino' };
    const gastadas = recibo.entradas.map((e) => `${e.txid}:${e.vout}`).sort();
    const reales = registro.tx.entradas.map((e) => `${e.txid}:${e.vout}`).sort();
    if (canonico(gastadas) !== canonico(reales)) return { ok: false, motivo: 'las monedas gastadas no son las declaradas' };
    const sale = registro.tx.salidas.reduce((n, s) => n + s.sat, 0);
    const entra = recibo.entradas.reduce((n, e) => n + e.sat, 0);
    if (entra !== sale + recibo.comision_sat) return { ok: false, motivo: 'el reparto no cuadra' };
    if (recibo.puntero) {
      const lleva = registro.tx.salidas.some((s) => s.op_return === PREFIJO_PUNTERO + recibo.puntero);
      if (!lleva) return { ok: false, motivo: 'la transacción no lleva ese puntero' };
    }
    return { ok: true, motivo: 'pagado', txid, altura: b.altura, hash: b.hash, instante: b.instante, confirmaciones: conf };
  }

  /**
   * Fondos en sats de una serie: el recibo es válido, su destino es la dirección de esa serie en la
   * cartera que pagó, y la salida sigue sin gastar.
   */
  async verificarFondos(serie, recibo) {
    const r = await this.verificarRecibo(recibo);
    if (!r.ok) return r;
    if (recibo.destino_clase !== 'agram/serie' || recibo.serie !== serie) return { ok: false, motivo: 'el recibo no es de fondos de esa serie' };
    const dueno = this.duenoDe.get(recibo.destino);
    if (!dueno || recibo.destino !== (await direccionDe(dueno, await etiquetaDeSerie(serie)))) return { ok: false, motivo: 'el destino no es la dirección de esa serie' };
    const vout = this.txs.get(r.txid).tx.salidas.findIndex((s) => s.direccion === recibo.destino && s.sat === recibo.importe_sat);
    const m = this.monedas.get(`${r.txid}:${vout}`);
    if (m.gastada_por) return { ok: false, motivo: `los fondos se gastaron en ${m.gastada_por}` };
    return { ok: true, motivo: 'con fondos en sats', sat: m.sat, serie, txid: r.txid, altura: r.altura };
  }

  /** Fondos vivos de una serie en una cartera: suma de sus salidas confirmadas y sin gastar. */
  async fondosDeSerie(nombre, serie) {
    const dir = await direccionDe(nombre, await etiquetaDeSerie(serie));
    let sat = 0;
    for (const m of this.monedas.values()) {
      if (m.direccion === dir && !m.gastada_por && this.txs.get(m.txid).altura !== null) sat += m.sat;
    }
    return sat;
  }
}
