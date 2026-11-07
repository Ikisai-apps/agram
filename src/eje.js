// Eje: la secuencia de registros con anclaje. Hoy vive en memoria; mañana en
// una base de datos o anclado a una cadena, sin cambiar el modelo.
// Una identidad existe cuando ha recibido tokens. Solo el génesis emite.

import { claveToken, cantidadBase, SEGUNDOS, AMBITO_GENESIS } from './tokens.js';
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

  /** Poderes de una identidad: [{ ambito, cantidad }]. No hay P total. */
  poderes(identidad) {
    return [...(this.saldos.get(identidad) ?? new Map()).entries()]
      .filter(([k, v]) => k.startsWith('P:') && v > 0)
      .map(([k, v]) => ({ ambito: k.slice(2), cantidad: v }));
  }

  /** Poder de una identidad sobre un registro: la suma de P cuyo ámbito es el eje entero o un registro del hilo del foco. */
  poderSobre(identidad, foco) {
    const hilo = new Set(this.hilo(foco).map((e) => e.id));
    return this.poderes(identidad).filter((p) => p.ambito === AMBITO_GENESIS || hilo.has(p.ambito)).reduce((s, p) => s + p.cantidad, 0);
  }

  /** Reputación de una identidad: [{ emisor, cantidad }], no fungible. */
  reputaciones(identidad) {
    return [...(this.saldos.get(identidad) ?? new Map()).entries()]
      .filter(([k, v]) => k.startsWith('R:') && v > 0)
      .map(([k, v]) => ({ emisor: k.slice(2), cantidad: v }));
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
    // Simulación de los movimientos sobre una vista de los saldos: si algo falla, nada cambia.
    const vista = new Map();
    const ver = (id, k) => vista.get(id + '|' + k) ?? this.saldo(id, k);
    const poner = (id, k, v) => vista.set(id + '|' + k, v);
    for (const m of ev.movimientos ?? []) {
      if (m.de === null) { errores.push('solo el génesis emite'); continue; }
      if (m.de !== ev.autor) { errores.push('nadie mueve tokens ajenos: ' + m.de + ' no es el autor'); continue; }
      if (m.token === 'P') {
        if (m.ambito !== AMBITO_GENESIS && !this.eventos.has(m.ambito)) { errores.push('ámbito desconocido: ' + String(m.ambito).slice(0, 8)); continue; }
        const plan = this.#planDebitoP(m.de, m.ambito, m.cantidad, ver);
        if (!plan) { errores.push('saldo insuficiente de P sobre ' + (m.ambito === AMBITO_GENESIS ? 'el eje' : m.ambito.slice(0, 8)) + ' en ' + m.de); continue; }
        for (const [k, delta] of plan) poner(m.de, k, ver(m.de, k) + delta);
        continue;
      }
      const k = claveToken(m);
      const c = cantidadBase(m);
      if (ver(m.de, k) < c) { errores.push('saldo insuficiente de ' + k + ' en ' + m.de); continue; }
      poner(m.de, k, ver(m.de, k) - c);
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
      if (m.de !== null) {
        if (m.token === 'P') {
          // Delegar poder estrecha el ámbito: se debita del ámbito exacto y, si no alcanza, de los que lo cubren.
          const plan = this.#planDebitoP(m.de, m.ambito, m.cantidad, (id, k) => this.saldo(id, k));
          for (const [k, delta] of plan ?? [[clave, -c]]) this.#ajustar(m.de, k, delta);
        } else {
          this.#ajustar(m.de, clave, -c);
        }
      }
      if (m.a !== null) this.#ajustar(m.a, clave, c);
    }
  }

  /** Ámbitos de P que cubren un ámbito dado: él mismo, los registros de su hilo y el génesis. */
  ambitosQueCubren(ambito) {
    if (ambito === AMBITO_GENESIS) return [AMBITO_GENESIS];
    const hilo = this.eventos.has(ambito) ? this.hilo(ambito).map((e) => e.id) : [ambito];
    return [...hilo, AMBITO_GENESIS];
  }

  /** Plan de débito de P: pares [clave, delta] del ámbito más concreto al más amplio; null si no alcanza. */
  #planDebitoP(identidad, ambito, cantidad, ver) {
    const plan = [];
    let resta = cantidad;
    for (const a of this.ambitosQueCubren(ambito)) {
      const k = 'P:' + a;
      const hay = ver(identidad, k);
      if (hay <= 0) continue;
      const usa = Math.min(hay, resta);
      plan.push([k, -usa]);
      resta -= usa;
      if (resta <= 0) return plan;
    }
    return null;
  }

  #ajustar(identidad, clave, delta) {
    if (!this.saldos.has(identidad)) this.saldos.set(identidad, new Map());
    const s = this.saldos.get(identidad);
    s.set(clave, (s.get(clave) ?? 0) + delta);
  }
}
