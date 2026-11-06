// Eje: la secuencia de registros con anclaje. Hoy vive en memoria; mañana en
// una base de datos o anclado a una cadena, sin cambiar el modelo.
// Una identidad existe cuando ha recibido tokens. Solo el génesis emite.

import { claveToken, cantidadBase, SEGUNDOS } from './tokens.js';
import { crearEvento, validarForma, verificarId } from './evento.js';

export class Eje {
  constructor() {
    this.eventos = new Map(); // id → evento
    this.orden = []; // ids en orden de entrada
    this.saldos = new Map(); // identidad → Map(clave → cantidad)
  }

  /**
   * Génesis: escrito por convención, fuera del sistema. Emite tokens iniciales
   * a la primera identidad y fija el foco raíz (payload).
   */
  static async genesis({ identidad, emision, foco, t = new Date().toISOString(), contexto = {} }) {
    const eje = new Eje();
    const movimientos = emision.map((m) => ({ ...m, de: null, a: identidad }));
    const ev = await crearEvento({
      autor: identidad,
      sobre: null,
      t,
      movimientos,
      payload: foco,
      contexto: { ...contexto, genesis: true },
    });
    eje.#aplicar(ev, { genesis: true });
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
    const gasto = new Map();
    for (const m of ev.movimientos ?? []) {
      if (m.de === null) errores.push('solo el génesis emite');
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

  /** Crea, valida y añade en un paso. */
  async escribir(datos) {
    return this.anadir(await crearEvento(datos));
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
