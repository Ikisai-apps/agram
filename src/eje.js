// Eje: la secuencia de registros con anclaje. Hoy vive en memoria; mañana en
// una base de datos o anclado a una cadena, sin cambiar el modelo.
// Una identidad existe cuando ha recibido tokens; quien la da de alta declara
// su clave y su tipo (persona, grupo o cosa) en el mismo evento. El génesis
// emite; después emiten su serie de E o de R su emisor, a sí mismo, y solo si
// es persona o grupo (VG, 7-11). T y P solo los emite el génesis.

import { claveToken, cantidadBase, partirClave, validarMovimiento, ESCALAS_T, AMBITO_GENESIS, TIPOS, EMITEN } from './tokens.js';
import { crearEvento, validarForma, verificarId } from './evento.js';
import { verificar, firmar } from './autoridad.js';

export class Eje {
  #series;
  #tipos;

  /** exigirFirmas: todo autor debe tener clave registrada y firmar. Si no, solo firman quienes tienen clave. */
  constructor({ exigirFirmas = false } = {}) {
    this.eventos = new Map(); // id → evento
    this.orden = []; // ids en orden de entrada
    this.saldos = new Map(); // identidad → Map(clave → cantidad)
    this.claves = new Map(); // identidad → clave pública (JWK)
    this.hijos = new Map(); // id → eventos escritos sobre él, en orden de entrada (índice)
    this.#series = new Map(); // clave de serie → { emisor, emitido }: lo emitido de cada serie, génesis incluido
    this.#tipos = new Map(); // identidad → tipo declarado en su alta (persona, grupo o cosa)
    this.exigirFirmas = exigirFirmas;
  }

  /**
   * Génesis: escrito por convención, fuera del sistema. Emite tokens iniciales
   * a la primera identidad y fija el foco raíz (payload). `tipo` declara qué es
   * esa identidad (persona o grupo: una cosa no emite).
   */
  static async genesis({ identidad, emision, foco, t = new Date().toISOString(), contexto = {}, clave, privada, tipo, exigirFirmas = false }) {
    const eje = new Eje({ exigirFirmas });
    // El génesis emite libremente a su identidad; sus series de E y de R quedan a su nombre.
    const deEmisor = (m) => m.token === 'E' || m.token === 'R';
    const movimientos = emision.map((m) => ({ ...m, ...(deEmisor(m) ? { emisor: m.emisor ?? identidad } : {}), de: null, a: identidad }));
    let ev = await crearEvento({
      autor: identidad,
      sobre: null,
      t,
      movimientos,
      payload: foco,
      contexto: { ...contexto, genesis: true, ...(clave ? { claves: { [identidad]: clave } } : {}), ...(tipo ? { tipos: { [identidad]: tipo } } : {}) },
    });
    if (privada) ev = await firmar(ev, privada);
    const errores = erroresGenesis(ev);
    if (errores.length) throw new Error('génesis rechazado: ' + errores.join('; '));
    if (clave) eje.claves.set(identidad, clave);
    if (exigirFirmas && !(clave && (await verificar(ev, clave)))) throw new Error('el génesis debe ir firmado');
    eje.#aplicar(ev);
    return eje;
  }

  /** Clave pública registrada de una identidad, si la tiene. */
  clave(identidad) {
    return this.claves.get(identidad);
  }

  /** Tipo declarado en el alta: 'persona', 'grupo', 'cosa' o null si no se declaró. Solo decide quién emite. */
  tipo(identidad) {
    return this.#tipos.get(identidad) ?? null;
  }

  /**
   * Reconstruye un eje desde su lista de eventos (el primero es el génesis),
   * validando cada uno: ids, firmas, saldos. Nada se da por bueno.
   */
  static async desde(eventos, { exigirFirmas = false } = {}) {
    const [g, ...resto] = eventos;
    if (!g || g.contexto?.genesis !== true || g.sobre !== null) throw new Error('el primer evento debe ser el génesis');
    const errores = [...validarForma(g), ...erroresGenesis(g)];
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

  /** Saldo de T en una escala: cada escala es su propio token (T:<escala>), sin conversión. */
  saldoT(identidad, escala) {
    if (!ESCALAS_T.includes(escala)) throw new Error('escala T inválida: ' + escala);
    return this.saldo(identidad, 'T:' + escala);
  }

  /** Saldos de una familia por serie: [{ token, serie, ...campos de la serie, cantidad }] con saldo > 0. */
  #porSerie(identidad, token) {
    return [...(this.saldos.get(identidad) ?? new Map()).entries()]
      .filter(([k, v]) => k.startsWith(token + ':') && v > 0)
      .map(([k, v]) => ({ ...partirClave(k), cantidad: v }));
  }

  /** Tiempo de una identidad: [{ escala, cantidad }] en el orden de las escalas. */
  tiempos(identidad) {
    return this.#porSerie(identidad, 'T')
      .map(({ escala, cantidad }) => ({ escala, cantidad }))
      .sort((a, b) => ESCALAS_T.indexOf(a.escala) - ESCALAS_T.indexOf(b.escala));
  }

  /** Recursos de una identidad: [{ emisor, denominacion, cantidad }]; cada serie de E es de su emisor. */
  recursos(identidad) {
    return this.#porSerie(identidad, 'E').map(({ emisor, denominacion, cantidad }) => ({ emisor, denominacion, cantidad }));
  }

  /** Una serie por su clave de saldo ('E:casa/EUR', 'R:casa', 'T:hora', 'P:genesis'): quién la emite y cuánto ha emitido. */
  serie(clave) {
    const s = this.#series.get(clave);
    return { emisor: s?.emisor ?? null, emitido: s?.emitido ?? 0 };
  }

  /** Todas las series emitidas, de las cuatro familias: [{ clave, token, serie, ...campos, emisor, emitido }] por orden de emisión. */
  series() {
    return [...this.#series.entries()].map(([clave, s]) => ({ clave, ...partirClave(clave), ...s }));
  }

  /** Poderes de una identidad: [{ ambito, cantidad }]. No hay P total. */
  poderes(identidad) {
    return this.#porSerie(identidad, 'P').map(({ ambito, cantidad }) => ({ ambito, cantidad }));
  }

  /** Poder de una identidad sobre un registro: la suma de P cuyo ámbito es el eje entero o un registro del hilo del foco. */
  poderSobre(identidad, foco) {
    const hilo = new Set(this.hilo(foco).map((e) => e.id));
    return this.poderes(identidad).filter((p) => p.ambito === AMBITO_GENESIS || hilo.has(p.ambito)).reduce((s, p) => s + p.cantidad, 0);
  }

  /** Reputación de una identidad: [{ emisor, cantidad }], no fungible. */
  reputaciones(identidad) {
    return this.#porSerie(identidad, 'R').map(({ emisor, cantidad }) => ({ emisor, cantidad }));
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
    // Igual con los tipos: se declaran en el alta y no cambian.
    for (const [id, tipo] of Object.entries(ev.contexto?.tipos ?? {})) {
      if (!TIPOS.includes(tipo)) errores.push('tipo inválido para ' + id + ': ' + tipo);
      else if (this.#tipos.has(id) || this.saldos.has(id)) errores.push('no se puede cambiar el tipo de ' + id);
      else if (!(ev.movimientos ?? []).some((m) => m.a === id)) errores.push('tipo declarado para ' + id + ' sin darle tokens');
    }
    // Simulación de los movimientos, en orden, sobre una vista de los saldos y
    // de lo emitido: si algo falla, nada cambia. Lo emitido entra en la vista,
    // así que el emisor puede emitir y dar en el mismo evento.
    const vista = new Map();
    const ver = (id, k) => vista.get(JSON.stringify([id, k])) ?? this.saldo(id, k);
    const poner = (id, k, v) => vista.set(JSON.stringify([id, k]), v);
    const emitido = new Map();
    for (const m of ev.movimientos ?? []) {
      if (validarMovimiento(m).length) continue; // ya lo cuenta validarForma
      const k = claveToken(m);
      const c = cantidadBase(m);
      if (m.de === null) {
        // Emisión: T y P solo en el génesis. E y R, su emisor (a sí mismo, lo exige el movimiento), si es persona o grupo.
        if (m.token === 'T' || m.token === 'P') { errores.push('solo el génesis emite ' + m.token); continue; }
        if (m.emisor !== ev.autor) { errores.push('nadie emite en nombre de otro: ' + m.emisor + ' no es el autor'); continue; }
        const tipo = this.#tipos.get(ev.autor);
        if (!EMITEN.includes(tipo)) { errores.push('solo personas y grupos emiten: ' + ev.autor + (tipo ? ' es ' + tipo : ' no declaró tipo en su alta')); continue; }
        const total = (emitido.get(k) ?? this.serie(k).emitido) + c;
        if (!Number.isFinite(total)) { errores.push('la serie ' + k + ' no admite tanto'); continue; }
        emitido.set(k, total);
        poner(m.a, k, ver(m.a, k) + c);
        continue;
      }
      if (m.de !== ev.autor) { errores.push('nadie mueve tokens ajenos: ' + m.de + ' no es el autor'); continue; }
      if (m.token === 'P') {
        if (m.ambito !== AMBITO_GENESIS && !this.eventos.has(m.ambito)) { errores.push('ámbito desconocido: ' + String(m.ambito).slice(0, 8)); continue; }
        const plan = this.#planDebitoP(m.de, m.ambito, m.cantidad, ver);
        if (!plan) { errores.push('saldo insuficiente de P sobre ' + (m.ambito === AMBITO_GENESIS ? 'el eje' : m.ambito.slice(0, 8)) + ' en ' + m.de); continue; }
        for (const [kp, delta] of plan) poner(m.de, kp, ver(m.de, kp) + delta);
      } else {
        if (ver(m.de, k) < c) { errores.push('saldo insuficiente de ' + k + ' en ' + m.de); continue; }
        poner(m.de, k, ver(m.de, k) - c);
      }
      if (m.a !== null) poner(m.a, k, ver(m.a, k) + c);
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
    const lista = this.hijos.get(id) ?? [];
    return en === undefined ? [...lista] : lista.filter((e) => e.en === en);
  }

  #aplicar(ev) {
    this.eventos.set(ev.id, ev);
    this.orden.push(ev.id);
    if (ev.sobre !== null) {
      if (!this.hijos.has(ev.sobre)) this.hijos.set(ev.sobre, []);
      this.hijos.get(ev.sobre).push(ev);
    }
    for (const [id, jwk] of Object.entries(ev.contexto?.claves ?? {})) this.claves.set(id, jwk);
    for (const [id, tipo] of Object.entries(ev.contexto?.tipos ?? {})) this.#tipos.set(id, tipo);
    for (const m of ev.movimientos) {
      const clave = claveToken(m);
      const c = cantidadBase(m);
      if (m.de === null) {
        // Emisión: la serie queda a nombre de quien la emite (en E y R, su emisor, que va en la clave; en T y P, el autor del génesis).
        const emisor = m.token === 'E' || m.token === 'R' ? m.emisor : ev.autor;
        const s = this.#series.get(clave) ?? { emisor, emitido: 0 };
        this.#series.set(clave, { emisor: s.emisor, emitido: s.emitido + c });
      } else {
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

/** El génesis emite a su autor, sus series de E y R quedan a su nombre, y solo declara el tipo de su autor. */
function erroresGenesis(g) {
  const errores = [];
  const totales = new Map();
  for (const m of g.movimientos ?? []) {
    if (m.de !== null || m.a !== g.autor) errores.push('el génesis solo emite a su autor');
    else if ((m.token === 'E' || m.token === 'R') && m.emisor !== g.autor) errores.push('en el génesis emite su autor: ' + m.emisor);
    else {
      const k = claveToken(m);
      totales.set(k, (totales.get(k) ?? 0) + cantidadBase(m));
      if (!Number.isFinite(totales.get(k))) errores.push('la serie ' + k + ' no admite tanto');
    }
  }
  for (const [id, tipo] of Object.entries(g.contexto?.tipos ?? {})) {
    if (id !== g.autor) errores.push('el génesis solo declara el tipo de su autor');
    else if (!TIPOS.includes(tipo)) errores.push('tipo inválido para ' + id + ': ' + tipo);
    else if (!EMITEN.includes(tipo)) errores.push('el génesis emite: su autor es persona o grupo, no ' + tipo);
  }
  return errores;
}
