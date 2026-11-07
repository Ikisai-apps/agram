// Eje: la secuencia de registros con anclaje. Hoy vive en memoria; mañana en
// una base de datos o anclado a una cadena, sin cambiar el modelo.
// Una identidad existe cuando ha recibido tokens; quien la da de alta declara
// su clave y su tipo (persona, grupo o cosa) en el mismo evento. El génesis
// emite por convención; después solo emiten las personas (VG, 7-11 noche), con
// las reglas de src/ciclo.js: T para sí mismas con el tope del reloj, y R, P y
// E escalonados. Un movimiento puede bloquear o liberar tokens sin cambiar de
// titular: el saldo es lo disponible y lo bloqueado se lleva aparte.

import { claveToken, cantidadBase, partirClave, validarMovimiento, ESCALAS_T, AMBITO_GENESIS, TIPOS, EMITEN } from './tokens.js';
import { reglasDelCiclo, EMITEN_V2 } from './ciclo.js';
import { crearEvento, validarForma, verificarId, normalizarEvento } from './evento.js';
import { verificar, firmar, clavePublicaValida } from './autoridad.js';

/** Caracteres del id por los que conPrefijo agrupa los ids (16⁴ grupos: con 20.000 registros, casi uno por grupo). */
const PREFIJO = 4;

export class Eje {
  #series;
  #tipos;
  #altas;
  #emitidoT;
  #hijosEn;
  #prefijos;

  /**
   * exigirFirmas: todo autor debe tener clave registrada y firmar. Si no, solo firman quienes tienen clave.
   * eventosV2: cuántos eventos del principio se guardaron con la versión 2 y se validan con sus reglas
   * (src/persistencia.js); los demás, con las de ahora.
   */
  constructor({ exigirFirmas = false, eventosV2 = 0 } = {}) {
    this.eventos = new Map(); // id → evento
    this.orden = []; // ids en orden de entrada
    this.saldos = new Map(); // identidad → Map(clave → cantidad disponible)
    this.bloqueados = new Map(); // identidad → Map(clave → Map(salida → cantidad bloqueada))
    this.claves = new Map(); // identidad → clave pública (JWK)
    this.hijos = new Map(); // id → eventos escritos sobre él, en orden de entrada (índice)
    this.#hijosEn = new Map(); // id → Map(en → los mismos eventos, solo los anclados en esa dirección, en orden de entrada)
    this.#prefijos = new Map(); // primeros PREFIJO caracteres del id → ids, en orden de entrada (índice de conPrefijo)
    this.#series = new Map(); // clave de serie → { emisor, emitido, caduca (E) }: lo emitido de cada serie, génesis incluido
    this.#tipos = new Map(); // identidad → tipo declarado en su alta (persona, grupo o cosa)
    this.#altas = new Map(); // identidad → { id, t } del evento en que recibió tokens por primera vez
    this.#emitidoT = new Map(); // JSON [persona, escala] → T emitido fuera del génesis (para el tope del reloj)
    this.exigirFirmas = exigirFirmas;
    this.eventosV2 = eventosV2;
  }

  /**
   * Génesis: escrito por convención, fuera del sistema. Emite tokens iniciales
   * a la primera identidad y fija el foco raíz (payload). `tipo` declara qué es
   * esa identidad: una persona (VG, 7-11 noche: solo las personas emiten), o
   * nada, como antes, y entonces no emite después del génesis.
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
    // La misma regla que al restaurar: si el génesis declara clave, va firmado con ella.
    const errores = [...erroresGenesis(ev), ...(await erroresFirmaGenesis(ev))];
    if (errores.length) throw new Error('génesis rechazado: ' + errores.join('; '));
    if (exigirFirmas && !clave) throw new Error('el génesis debe ir firmado');
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
   * Alta de una identidad: { id, t } del evento en que recibió tokens por
   * primera vez (el génesis es el alta de su autor), o null. El alta de un
   * grupo es su registro: quien tiene P sobre él emite a su nombre.
   */
  alta(identidad) {
    return this.#altas.get(identidad) ?? null;
  }

  /** T que una persona lleva emitido en una escala fuera del génesis (lo que cuenta para el tope del reloj). */
  emitidoT(identidad, escala) {
    return this.#emitidoT.get(JSON.stringify([identidad, escala])) ?? 0;
  }

  /**
   * Reconstruye un eje desde su lista de eventos (el primero es el génesis),
   * validando cada uno: ids, firmas, saldos. Nada se da por bueno.
   */
  static async desde(eventos, { exigirFirmas = false, eventosV2 = 0 } = {}) {
    const [crudo, ...resto] = eventos;
    if (!crudo || crudo.contexto?.genesis !== true || crudo.sobre !== null) throw new Error('el primer evento debe ser el génesis');
    if (!Number.isSafeInteger(eventosV2) || eventosV2 < 0 || eventosV2 > eventos.length) throw new Error('eventosV2 debe ser un entero entre 0 y el número de eventos');
    const g = copiaGuardable(crudo);
    const errores = [...validarForma(g), ...erroresGenesis(g, eventosV2 > 0 ? 2 : 3)];
    if (!(await verificarId(g))) errores.push('id del génesis no corresponde');
    if (!errores.length) errores.push(...(await erroresFirmaGenesis(g)));
    if (errores.length) throw new Error('génesis rechazado: ' + errores.join('; '));
    const eje = new Eje({ exigirFirmas, eventosV2 });
    if (exigirFirmas && !g.contexto.claves?.[g.autor]) throw new Error('el génesis debe ir firmado');
    eje.#aplicar(g);
    for (const ev of resto) await eje.anadir(ev);
    return eje;
  }

  get genesisId() {
    return this.orden[0];
  }

  /**
   * Ids que empiezan por `prefijo`, en orden de entrada: lo mismo que
   * `eje.orden.filter((id) => id.startsWith(prefijo))`, sin recorrer el eje
   * entero cuando el prefijo tiene al menos PREFIJO caracteres (un índice por
   * los primeros; docs/notas/RENDIMIENTO.md). Lo usan las referencias por
   * prefijo («@25ddaa89», REF("25ddaa89")).
   */
  conPrefijo(prefijo) {
    if (typeof prefijo !== 'string' || prefijo.length < PREFIJO) return this.orden.filter((id) => id.startsWith(prefijo));
    return (this.#prefijos.get(prefijo.slice(0, PREFIJO)) ?? []).filter((id) => id.startsWith(prefijo));
  }

  obtener(id) {
    return this.eventos.get(id);
  }

  identidades() {
    return [...this.saldos.keys()];
  }

  /** Saldo disponible: lo que se puede consumir o transferir. Lo bloqueado no cuenta. */
  saldo(identidad, clave) {
    return this.saldos.get(identidad)?.get(clave) ?? 0;
  }

  /** Cantidad bloqueada de una serie en una identidad, sumando todas sus salidas (o solo la de `salida`, si se da). */
  bloqueado(identidad, clave, salida) {
    const porSalida = this.bloqueados.get(identidad)?.get(clave);
    if (!porSalida) return 0;
    if (salida !== undefined) return porSalida.get(salida) ?? 0;
    let total = 0;
    for (const v of porSalida.values()) total += v;
    return total;
  }

  /** Bloqueos de una identidad: [{ clave, token, serie, ...campos, salida, cantidad }] con cantidad > 0. */
  bloqueos(identidad) {
    const lista = [];
    for (const [clave, porSalida] of this.bloqueados.get(identidad) ?? new Map()) {
      for (const [salida, cantidad] of porSalida) if (cantidad > 0) lista.push({ clave, ...partirClave(clave), salida, cantidad });
    }
    return lista;
  }

  /**
   * Obligación de un emisor por su R (doble entrada, V10): la cantidad de su R
   * que está en manos ajenas, disponible o bloqueada. Se deriva de los saldos;
   * no es un token. Mientras la R está en su cartera no obliga a nada.
   */
  obligaciones(emisor) {
    const clave = 'R:' + emisor;
    let total = 0;
    for (const id of this.saldos.keys()) if (id !== emisor) total += this.saldo(id, clave) + this.bloqueado(id, clave);
    return total;
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

  /**
   * Una serie por su clave de saldo ('E:casa/EUR', 'R:casa', 'T:hora', 'P:genesis'): quién la emite y cuánto ha emitido,
   * y `caduca` si es una serie de E que la lleva. En T, `emisor` es quien la emitió primero; lo de cada persona, emitidoT.
   */
  serie(clave) {
    const s = this.#series.get(clave);
    return { emisor: s?.emisor ?? null, emitido: s?.emitido ?? 0, ...(s?.caduca ? { caduca: s.caduca } : {}) };
  }

  /**
   * Todas las series emitidas, de las cuatro familias, por orden de emisión:
   * [{ clave, token, serie, ...campos, emisor, emitido, bloqueado, caduca (solo en E: ISO o null) }].
   * `bloqueado` es lo que de esa serie está bloqueado, sumando todos los titulares.
   */
  series() {
    const bloqueado = new Map();
    for (const porClave of this.bloqueados.values()) {
      for (const [clave, porSalida] of porClave) for (const v of porSalida.values()) bloqueado.set(clave, (bloqueado.get(clave) ?? 0) + v);
    }
    return [...this.#series.entries()].map(([clave, s]) => {
      const partes = partirClave(clave);
      return { clave, ...partes, emisor: s.emisor, emitido: s.emitido, bloqueado: bloqueado.get(clave) ?? 0, ...(partes.token === 'E' ? { caduca: s.caduca ?? null } : {}) };
    });
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

  /**
   * Errores que impedirían añadir el evento; vacío si es admisible. Se valida
   * la copia que se guardaría (normalizarEvento), nunca lanza por la forma.
   */
  async validar(crudo) {
    let ev;
    try {
      ev = normalizarEvento(crudo);
    } catch (e) {
      return ['no cabe en JSON: ' + e.message];
    }
    const errores = validarForma(ev);
    if (!ev || typeof ev !== 'object') return errores;
    // Los movimientos que no son objeto ya los cuenta validarForma; aquí no se miran.
    const movimientos = Array.isArray(ev.movimientos) ? ev.movimientos.filter((m) => m && typeof m === 'object') : [];
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
      else if (!movimientos.some((m) => m.a === id)) errores.push('clave declarada para ' + id + ' sin darle tokens');
      else if (!(await clavePublicaValida(jwk))) errores.push('clave inválida para ' + id);
    }
    // Igual con los tipos: se declaran en el alta y no cambian.
    for (const [id, tipo] of Object.entries(ev.contexto?.tipos ?? {})) {
      if (!TIPOS.includes(tipo)) errores.push('tipo inválido para ' + id + ': ' + tipo);
      else if (this.#tipos.has(id) || this.saldos.has(id)) errores.push('no se puede cambiar el tipo de ' + id);
      else if (!movimientos.some((m) => m.a === id)) errores.push('tipo declarado para ' + id + ' sin darle tokens');
    }
    // Las reglas de emisión (VG, 7-11 noche: solo personas, T con el tope del
    // reloj, escalonado T → R → P → E) y la del t del evento están en
    // src/ciclo.js y leen el eje de antes del evento. Un evento guardado con la
    // versión 2 se valida con las reglas de entonces.
    for (const { texto } of reglasDelCiclo(ev, this.#contextoCiclo())) errores.push(texto);
    // Simulación de los movimientos, en orden, sobre una vista de los saldos y
    // de lo emitido: si algo falla, nada cambia. Lo emitido entra en la vista,
    // así que el emisor puede emitir y dar en el mismo evento. Lo bloqueado
    // tiene su propia vista, por salida.
    const vista = new Map();
    const ver = (id, k) => vista.get(JSON.stringify([id, k])) ?? this.saldo(id, k);
    const poner = (id, k, v) => vista.set(JSON.stringify([id, k]), v);
    const vistaB = new Map();
    const verB = (id, k, salida) => vistaB.get(JSON.stringify([id, k, salida])) ?? this.bloqueado(id, k, salida);
    const ponerB = (id, k, salida, v) => vistaB.set(JSON.stringify([id, k, salida]), v);
    const emitido = new Map();
    for (const m of movimientos) {
      if (validarMovimiento(m).length) continue; // ya lo cuenta validarForma
      const k = claveToken(m);
      const c = cantidadBase(m);
      if (m.de === null) {
        // Emisión: quién puede y cuánto lo dicen las reglas del ciclo; aquí, que la serie siga siendo finita.
        const total = (emitido.get(k) ?? this.serie(k).emitido) + c;
        if (!Number.isFinite(total)) { errores.push('la serie ' + k + ' no admite tanto'); continue; }
        emitido.set(k, total);
        poner(m.a, k, ver(m.a, k) + c);
        continue;
      }
      if (m.de !== ev.autor) { errores.push('nadie mueve tokens ajenos: ' + m.de + ' no es el autor'); continue; }
      if (m.estado === 'bloqueo') {
        // Bloquear: del disponible al bloqueado del mismo titular, con su salida; de la clave exacta, también en P.
        if (ver(m.de, k) < c) { errores.push('saldo disponible insuficiente para bloquear ' + k + ' en ' + m.de); continue; }
        poner(m.de, k, ver(m.de, k) - c);
        ponerB(m.de, k, m.salida, verB(m.de, k, m.salida) + c);
        continue;
      }
      if (m.estado === 'liberacion') {
        // Liberar: del bloqueado con esa misma salida al disponible. La salida es declarada, no verificable
        // todavía: el titular libera cuando quiere citándola y nadie comprueba que se cumplió ([X] decidir VG
        // qué la hace verificable, p. ej. que la liberación cite un evento de otra identidad).
        if (verB(m.de, k, m.salida) < c) { errores.push('no hay ' + c + ' de ' + k + ' bloqueado en ' + m.de + ' con la salida «' + m.salida + '»'); continue; }
        ponerB(m.de, k, m.salida, verB(m.de, k, m.salida) - c);
        poner(m.de, k, ver(m.de, k) + c);
        continue;
      }
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

  /** Lo que leen las reglas del ciclo (src/ciclo.js): el eje de antes del evento. */
  #contextoCiclo() {
    return {
      tipo: (id) => this.tipo(id),
      alta: (id) => this.alta(id),
      emitidoT: (id, escala) => this.emitidoT(id, escala),
      serie: (k) => this.#series.get(k) ?? null,
      registro: (id) => this.eventos.get(id),
      ambitosQueCubren: (ambito) => this.ambitosQueCubren(ambito),
      saldo: (id, k) => this.saldo(id, k),
      reglas: this.orden.length < this.eventosV2 ? 2 : 3,
    };
  }

  /**
   * Añade un evento válido y aplica sus movimientos. Lanza si no es admisible.
   * Guarda y devuelve su copia normalizada y congelada, no el objeto recibido.
   */
  async anadir(crudo) {
    const ev = copiaGuardable(crudo);
    const errores = await this.validar(ev);
    if (errores.length) throw new Error('evento rechazado: ' + errores.join('; '));
    this.#aplicar(ev); // la copia de copiaGuardable ya está congelada entera: lo guardado no se modifica en sitio
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
    if (en === undefined) return this.hijos.get(id)?.slice() ?? [];
    // Lo mismo que filtrar los hijos por `e.en === en`, sin recorrerlos (docs/notas/RENDIMIENTO.md).
    return this.#hijosEn.get(id)?.get(en)?.slice() ?? [];
  }

  #aplicar(ev) {
    this.eventos.set(ev.id, ev);
    this.orden.push(ev.id);
    const cabeza = ev.id.slice(0, PREFIJO);
    if (!this.#prefijos.has(cabeza)) this.#prefijos.set(cabeza, []);
    this.#prefijos.get(cabeza).push(ev.id);
    if (ev.sobre !== null) {
      if (!this.hijos.has(ev.sobre)) this.hijos.set(ev.sobre, []);
      this.hijos.get(ev.sobre).push(ev);
      if (!this.#hijosEn.has(ev.sobre)) this.#hijosEn.set(ev.sobre, new Map());
      const porEn = this.#hijosEn.get(ev.sobre);
      if (!porEn.has(ev.en)) porEn.set(ev.en, []);
      porEn.get(ev.en).push(ev);
    }
    for (const [id, jwk] of Object.entries(ev.contexto?.claves ?? {})) this.claves.set(id, jwk);
    for (const [id, tipo] of Object.entries(ev.contexto?.tipos ?? {})) this.#tipos.set(id, tipo);
    for (const m of ev.movimientos) {
      const clave = claveToken(m);
      const c = cantidadBase(m);
      // El alta: el primer evento en que una identidad recibe tokens (el génesis, para su autor).
      if (m.a !== null && !this.#altas.has(m.a)) this.#altas.set(m.a, { id: ev.id, t: ev.t });
      if (m.estado === 'bloqueo' || m.estado === 'liberacion') {
        // No cambia de titular: pasa del disponible al bloqueado (o al revés), por salida.
        const signo = m.estado === 'bloqueo' ? 1 : -1;
        this.#ajustar(m.de, clave, -signo * c);
        this.#ajustarBloqueo(m.de, clave, m.salida, signo * c);
        continue;
      }
      if (m.de === null) {
        // Emisión: la serie queda a nombre de quien la emite (en E y R, su emisor, que va en la clave; en T y P, quien primero la emitió).
        const emisor = m.token === 'E' || m.token === 'R' ? m.emisor : ev.autor;
        const s = this.#series.get(clave) ?? { emisor, emitido: 0, ...(m.token === 'E' ? { caduca: m.caduca ?? null } : {}) };
        this.#series.set(clave, { ...s, emitido: s.emitido + c });
        // El tope del reloj cuenta lo que cada persona emite de T fuera del génesis.
        if (m.token === 'T' && ev.contexto?.genesis !== true) {
          const k = JSON.stringify([ev.autor, m.escala]);
          this.#emitidoT.set(k, (this.#emitidoT.get(k) ?? 0) + c);
        }
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
    // El génesis nombrado por su id cubre lo mismo que «genesis»: todo el eje.
    if (ambito === AMBITO_GENESIS) return this.genesisId ? [AMBITO_GENESIS, this.genesisId] : [AMBITO_GENESIS];
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

  #ajustarBloqueo(identidad, clave, salida, delta) {
    if (!this.bloqueados.has(identidad)) this.bloqueados.set(identidad, new Map());
    const porClave = this.bloqueados.get(identidad);
    if (!porClave.has(clave)) porClave.set(clave, new Map());
    const porSalida = porClave.get(clave);
    porSalida.set(salida, (porSalida.get(salida) ?? 0) + delta);
  }
}

/**
 * ¿Ha caducado la serie `clave` en el instante `t`? Solo las series de E
 * pueden llevar caducidad, y la fija su primera emisión. Es un campo del
 * contrato de la serie: nada se ejecuta solo al caducar; BQL o el motor
 * pueden leerlo (VG, 7-11 noche).
 */
export function caducada(eje, clave, t) {
  const caduca = eje.serie(clave).caduca;
  if (!caduca) return false;
  const ahora = Date.parse(t);
  if (Number.isNaN(ahora)) throw new Error('caducada: t debe ser instante ISO');
  return ahora >= Date.parse(caduca);
}

/**
 * El génesis emite a su autor, sus series de E y R quedan a su nombre, su P
 * es sobre todo el eje («genesis»: aún no existe ningún otro registro) y solo
 * declara el tipo y la clave de su autor. Lo emite una persona; con las
 * reglas de la versión 2 (`reglas` = 2: un eje guardado con ella), también
 * un grupo.
 */
function erroresGenesis(g, reglas = 3) {
  const errores = [];
  const totales = new Map();
  const movimientos = Array.isArray(g.movimientos) ? g.movimientos.filter((m) => m && typeof m === 'object') : [];
  for (const m of movimientos) {
    if (m.de !== null || m.a !== g.autor) errores.push('el génesis solo emite a su autor');
    else if ((m.token === 'E' || m.token === 'R') && m.emisor !== g.autor) errores.push('en el génesis emite su autor: ' + m.emisor);
    else if (m.token === 'P' && m.ambito !== AMBITO_GENESIS) errores.push('el P del génesis es sobre todo el eje: ámbito «' + AMBITO_GENESIS + '»');
    else {
      const k = claveToken(m);
      totales.set(k, (totales.get(k) ?? 0) + cantidadBase(m));
      if (!Number.isFinite(totales.get(k))) errores.push('la serie ' + k + ' no admite tanto');
    }
  }
  for (const [id, tipo] of Object.entries(g.contexto?.tipos ?? {})) {
    if (id !== g.autor) errores.push('el génesis solo declara el tipo de su autor');
    else if (!TIPOS.includes(tipo)) errores.push('tipo inválido para ' + id + ': ' + tipo);
    else if (!(reglas === 2 ? EMITEN_V2 : EMITEN).includes(tipo)) errores.push('el génesis lo emite una persona: su autor no puede ser ' + tipo);
  }
  for (const id of Object.keys(g.contexto?.claves ?? {})) {
    if (id !== g.autor) errores.push('el génesis solo declara la clave de su autor');
  }
  return errores;
}

/**
 * Si el génesis declara la clave de su autor, la clave es pública e
 * importable y el génesis va firmado con ella por su autor. Es la misma regla
 * al crear el eje y al restaurarlo.
 */
async function erroresFirmaGenesis(g) {
  const clave = g.contexto?.claves?.[g.autor];
  if (!clave) return [];
  if (!(await clavePublicaValida(clave))) return ['clave inválida para ' + g.autor];
  if (!g.firma) return ['el génesis con clave debe ir firmado con ella'];
  if (g.firmante !== g.autor) return ['el firmante del génesis debe ser su autor'];
  if (!(await verificar(g, clave))) return ['firma del génesis inválida: debe ir firmado con la clave de su autor'];
  return [];
}

/** La copia que guarda el eje (normalizarEvento); lo que no cabe en JSON se rechaza. */
function copiaGuardable(ev) {
  try {
    return normalizarEvento(ev);
  } catch (e) {
    throw new Error('evento rechazado: no cabe en JSON (' + e.message + ')');
  }
}
