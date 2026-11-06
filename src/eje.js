// Eje: la secuencia de registros con anclaje. Hoy vive en memoria; mañana en
// una base de datos o anclado a una cadena, sin cambiar el modelo.
// Una identidad existe cuando ha recibido tokens. Solo el génesis emite.

import { claveToken, cantidadBase, SEGUNDOS } from './tokens.js';
import { crearEvento, validarForma, verificarId } from './evento.js';
import { verificar, firmar } from './autoridad.js';

export class Eje {
  /** exigirFirmas: todo autor debe tener clave registrada y firmar. Si no, solo firman quienes tienen clave. */
  constructor({ exigirFirmas = false } = {}) {
    this.eventos = new Map(); // id → evento
    this.orden = []; // ids en orden de entrada
    this.saldos = new Map(); // identidad → Map(clave → cantidad)
    this.claves = new Map(); // identidad → clave pública (JWK)
    this.exigirFirmas = exigirFirmas;
  }

  /**
   * Génesis: escrito por convención, fuera del sistema. Emite tokens iniciales
   * a la primera identidad y fija el foco raíz (payload).
   */
  static async genesis({ identidad, emision, foco, t = new Date().toISOString(), contexto = {}, clave, privada, exigirFirmas = false }) {
    const eje = new Eje({ exigirFirmas });
    const movimientos = emision.map((m) => ({ ...m, de: null, a: identidad }));
    let ev = await crearEvento({
      autor: identidad,
      sobre: null,
      t,
      movimientos,
      payload: foco,
      contexto: { ...contexto, genesis: true, ...(clave ? { claves: { [identidad]: clave } } : {}) },
    });
    if (privada) ev = await firmar(ev, privada);
    if (clave) eje.claves.set(identidad, clave);
    if (exigirFirmas && !(clave && (await verificar(ev, clave)))) throw new Error('el génesis debe ir firmado');
    eje.#aplicar(ev);
    return eje;
  }

  /** Clave pública registrada de una identidad, si la tiene. */
  clave(identidad) {
    return this.claves.get(identidad);
  }

  /**
   * Reconstruye un eje desde su lista de eventos (el primero es el génesis),
   * validando cada uno: ids, firmas, saldos. Nada se da por bueno.
   */
  static async desde(eventos, { exigirFirmas = false } = {}) {
    const [g, ...resto] = eventos;
    if (!g || g.contexto?.genesis !== true || g.sobre !== null) throw new Error('el primer evento debe ser el génesis');
    const errores = validarForma(g);
    if (!(await verificarId(g))) errores.push('id del génesis no corresponde');
    if (errores.length) throw new Error('génesis rechazado: ' + errores.join('; '));
    const eje = new Eje({ exigirFirmas });
    const clave = g.contexto.claves?.[g.autor];
    if (clave && !(await verificar(g, clave))) throw new Error('firma del génesis inválida');
    if (exigirFirmas && !clave) throw new Error('el génesis debe ir firmado');
    eje.#aplicar(Object.freeze({ ...g }));
    for (const ev of resto) await eje.anadir(Object.freeze({ ...ev }));
    return eje;
  }

  get genesisId() {
    return this.orden[0];
  }

  obtener(id) {
    return this.eventos.get(id);
  }

  identidades() {
    return [...this.saldos.keys()];
  }

  saldo(identidad, clave) {
    return this.saldos.get(identidad)?.get(clave) ?? 0;
  }

  /** Saldo de tiempo expresado en una escala. */
  saldoT(identidad, escala = 'segundo') {
    return this.saldo(identidad, 'T') / SEGUNDOS[escala];
  }

  /** Errores que impedirían añadir el evento; vacío si es admisible. */
  async validar(ev) {
    const errores = validarForma(ev);
    if (typeof ev.id !== 'string' || !(await verificarId(ev))) errores.push('id no corresponde al cuerpo');
    if (this.eventos.has(ev.id)) errores.push('evento ya registrado');
    if (ev.contexto?.genesis) errores.push('ya hay génesis');
    if (ev.sobre === null) errores.push('solo el génesis carece de foco');
    else if (!this.eventos.has(ev.sobre)) errores.push('foco desconocido: ' + ev.sobre);
    if (!this.saldos.has(ev.autor)) errores.push('autor desconocido: ' + ev.autor);
    // Autoridad: nadie mueve tokens ajenos, y quien tiene clave firma.
    const clave = this.claves.get(ev.autor);
    if (clave) {
      if (!ev.firma) errores.push('firma ausente de ' + ev.autor);
      else if (ev.firmante !== ev.autor) errores.push('el firmante debe ser el autor');
      else if (!(await verificar(ev, clave))) errores.push('firma inválida de ' + ev.autor);
    } else if (this.exigirFirmas) {
      errores.push('autor sin clave: ' + ev.autor);
    }
    // Las claves que declara el evento solo pueden ser de identidades nuevas (que reciben tokens en él).
    for (const [id, jwk] of Object.entries(ev.contexto?.claves ?? {})) {
      if (this.claves.has(id) || this.saldos.has(id)) errores.push('no se puede cambiar la clave de ' + id);
      else if (!(ev.movimientos ?? []).some((m) => m.a === id)) errores.push('clave declarada para ' + id + ' sin darle tokens');
      else if (!(jwk && jwk.kty === 'EC' && jwk.crv === 'P-256' && jwk.x && jwk.y)) errores.push('clave inválida para ' + id);
    }
    const gasto = new Map();
    for (const m of ev.movimientos ?? []) {
      if (m.de === null) errores.push('solo el génesis emite');
      else if (m.de !== ev.autor) errores.push('nadie mueve tokens ajenos: ' + m.de + ' no es el autor');
      else {
        const clave = m.de + '|' + claveToken(m);
        gasto.set(clave, (gasto.get(clave) ?? 0) + cantidadBase(m));
      }
    }
    for (const [clave, total] of gasto) {
      const [de, token] = clave.split('|');
      if (this.saldo(de, token) < total) errores.push('saldo insuficiente de ' + token + ' en ' + de);
    }
    return errores;
  }

  /** Añade un evento válido y aplica sus movimientos. Lanza si no es admisible. */
  async anadir(ev) {
    const errores = await this.validar(ev);
    if (errores.length) throw new Error('evento rechazado: ' + errores.join('; '));
    this.#aplicar(ev);
    return ev;
  }

  /** Crea, valida y añade en un paso. Con `privada`, firma antes de añadir. */
  async escribir(datos, privada) {
    let ev = await crearEvento(datos);
    if (privada) ev = await firmar(ev, privada);
    return this.anadir(ev);
  }

  /** Hilo: desde el evento hasta el génesis siguiendo la referencia sobre. */
  hilo(id) {
    const cadena = [];
    let ev = this.eventos.get(id);
    while (ev) {
      cadena.push(ev);
      ev = ev.sobre === null ? undefined : this.eventos.get(ev.sobre);
    }
    return cadena;
  }

  /** Eventos escritos sobre un registro (sus hijos directos), opcionalmente solo en una posición. */
  sobre(id, en) {
    return this.orden.map((x) => this.eventos.get(x)).filter((e) => e.sobre === id && (en === undefined || e.en === en));
  }

  #aplicar(ev) {
    this.eventos.set(ev.id, ev);
    this.orden.push(ev.id);
    for (const [id, jwk] of Object.entries(ev.contexto?.claves ?? {})) this.claves.set(id, jwk);
    for (const m of ev.movimientos) {
      const clave = claveToken(m);
      const c = cantidadBase(m);
      if (m.de !== null) this.#ajustar(m.de, clave, -c);
      if (m.a !== null) this.#ajustar(m.a, clave, c);
    }
  }

  #ajustar(identidad, clave, delta) {
    if (!this.saldos.has(identidad)) this.saldos.set(identidad, new Map());
    const s = this.saldos.get(identidad);
    s.set(clave, (s.get(clave) ?? 0) + delta);
  }
}
