// El cliente del libro compartido (etapa 3 del roadmap, mapa §17 [D]): un eje
// local se sincroniza con un eje del servidor (servidor/supabase, o
// servidor/prueba para desarrollar) hablando por fetch con el contrato HTTP de
// servidor/supabase/funciones/eventos/api.js. Sin dependencias. Documentación:
// docs/CONTRATO.md, «El libro compartido».
//
// Qué valida quién: el servidor solo la forma (id = hash del cuerpo, firma del
// autor con la clave de su alta), guarda, ordena por llegada y da la hora. Las
// REGLAS las valida este cliente con el núcleo (eje.anadir) al bajar cada
// evento; lo que no pasa va a `rechazados` con su motivo y no rompe la
// sincronización.
//
// El orden: el que vale es el de llegada al servidor (`orden`). El eje local
// puede diferir (lo escrito sin red va detrás de lo que otros subieron antes):
// cuando la sincronización lo nota, reordena el eje local por el orden del
// servidor (eje.reordenar: vuelve a validar todo en el orden nuevo) y deja
// detrás lo que aún no se ha subido. No hay conflictos: todo evento válido se
// acepta en orden de llegada; lo que en el orden del servidor deja de pasar las
// reglas (otro dispositivo gastó antes lo mismo) va a `rechazados`.
//
// La cola: lo local que el servidor no tiene se sube en orden de entrada. Sin
// red no falla: queda en cola con reintentos y espera creciente (1 s, 2 s, 4 s…
// hasta 5 min), que se guarda con serializar/restaurar igual que el eje. Una
// escritura rechazada por el servidor (4xx) se anota en `rechazados` y espera
// como sin red: lo que viene detrás depende de ella, así que no se salta.
//
// El reloj: el `recibido` del servidor es la hora a la que los demás vieron el
// evento, y entra en el eje como el reloj de los demás (eje.marcarReloj →
// `before.6.3`), sin tocar las reglas ni ningún evento.
//
// El recibo: si el servidor responde a `GET /eventos/recibo?eje&id` (el transporte simulado de AARPIA, servidor/sim/aarpia/:
// `{ instante, rele, firma, recibo }`, la marca de llegada que firma el relé de Nostr), tras asentar eventos nuevos se pide el
// recibo de cada uno (hasta 500 por pasada) y entra en el eje como el segundo reloj del registro (eje.marcarRecibo →
// X.6.8.1: instante y clave del relé). Es una vista del libro: no toca el evento, su id ni su firma. Un servidor sin esa
// ruta (la función de Supabase la trata como una lectura de eventos, o contesta 404/405) se detecta una vez por sesión y no
// se insiste; un error se anota en `informe.recibos.errores` y se reintenta en la siguiente pasada, sin romper nada.
//
// El sello: con un adaptador `sello` (src/sello.js), tras asentar eventos nuevos (los que baja y los que sube) se piden
// al servicio de sello sus ids (solo los ids), y en cada sincronización se pide la prueba de los pendientes; la que ya está
// en un bloque se comprueba (`verificar`) y, si vale, entra en el eje como el tercer reloj del registro (eje.marcarSello →
// X.6.8.2: altura, hash e instante). Es una vista del libro: no toca el evento, su id ni su firma. Un fallo del servicio de
// sello nunca rompe la sincronización: se anota en el informe y se reintenta en la siguiente.

import { Eje } from './eje.js';
import { configuracion } from './contrato.js';

export const VERSION_SINCRONIA = 1;

/** Cuántas pruebas de sello se piden como mucho en cada sincronización (el resto, en la siguiente). */
export const PRUEBAS_POR_PASADA = 500;

/** Cuántos recibos de llegada se piden como mucho en cada sincronización (el resto, en la siguiente). */
export const RECIBOS_POR_PASADA = 500;

/** Las claves de la configuración (plantilla «preferences», 8 y 9: docs/CONTRATO.md §15.7) que dicen dónde se comparte el eje. */
export const CONFIGURACION = Object.freeze({ url: 'sync url', eje: 'sync ledger' });

const primeraHoja = (x) => (Array.isArray(x) ? x.find((h) => typeof h === 'string') : x);

/**
 * Dónde comparte `yo` este eje, según su configuración: { url, eje } si tiene las dos (la url, http o https), o null:
 * sin ellas el eje vive solo en este dispositivo. La clave de lectura no está aquí (no va en el eje).
 */
export function destino(eje, yo, opciones = {}) {
  const c = configuracion(eje, yo, opciones);
  const url = primeraHoja(c[CONFIGURACION.url]);
  const nombre = primeraHoja(c[CONFIGURACION.eje]);
  if (typeof url !== 'string' || typeof nombre !== 'string' || !url.trim() || !nombre.trim()) return null;
  try {
    if (!/^https?:$/.test(new URL(url.trim()).protocol)) return null;
  } catch {
    return null;
  }
  return { url: url.trim().replace(/\/+$/, ''), eje: nombre.trim() };
}

/** La espera antes de reintentar tras `intentos` fallos, en milisegundos: 1 s, 2 s, 4 s… hasta cinco minutos. */
export function espera(intentos) {
  return Math.min(1000 * 2 ** Math.max(0, intentos - 1), 5 * 60 * 1000);
}

/** No hubo respuesta del servidor (sin red, servidor caído, petición abortada). */
export class SinRed extends Error {
  constructor(causa) {
    super('sin red: ' + (causa?.message ?? String(causa)));
    this.name = 'SinRed';
    this.causa = causa;
  }
}

/** El servidor respondió con un error (estado HTTP y su texto). */
export class ErrorDelServidor extends Error {
  constructor(estado, texto) {
    super('servidor ' + estado + ': ' + texto);
    this.name = 'ErrorDelServidor';
    this.estado = estado;
  }
}

export class Sincronia {
  #url;
  #eje;
  #claveLectura;
  #firmar;
  #fetch;
  #ahora;
  #desde = 0; // el mayor orden bajado
  #ordenes = new Map(); // id → orden del servidor
  #recibidos = new Map(); // id → recibido (ISO)
  #cola = new Map(); // id → { intentos, proximo, error }: lo pendiente de subir con sus reintentos
  #rechazados = new Map(); // id → { motivo, de }: lo que no entró (de: 'reglas', 'reorden' o 'servidor')
  #recibos = new Map(); // id → 'por pedir' | 'sin recibo' (el servidor no lo tiene) | { instante, rele, firma, recibo? }
  #recibosPorPasada = RECIBOS_POR_PASADA; // cuántos recibos se piden por pasada (por defecto RECIBOS_POR_PASADA; solo las pruebas lo cambian)
  #sinRutaDeRecibo = false; // el servidor no sirve GET /eventos/recibo: detectado una vez por sesión (no se guarda)
  #sello; // el adaptador de src/sello.js, o null: sin él nada se sella
  #sellos = new Map(); // id → 'por sellar' | 'pendiente' (en un lote, aún sin bloque) | { altura, hash, instante, verificado }

  /**
   * url: la base del servidor (…/functions/v1 en Supabase; http://127.0.0.1:8787 en pruebas). eje: el nombre del eje.
   * claveLectura: la clave de lectura (va en X-Clave-Lectura; nunca se guarda aquí). firmar (opcional): async (evento) →
   * evento firmado, para lo local que llegara sin firma. fetch: la de la plataforma, o una de prueba. sello (opcional): el
   * adaptador de src/sello.js; sin él no se sella nada. recibosPorPasada (opcional): el tope de recibos por
   * sincronización (RECIBOS_POR_PASADA, 500).
   */
  constructor({ url, eje, claveLectura, firmar, fetch = globalThis.fetch?.bind(globalThis), ahora = () => Date.now(), sello = null, recibosPorPasada = RECIBOS_POR_PASADA } = {}) {
    if (typeof url !== 'string' || !url) throw new TypeError('sincronía: hace falta la url del servidor');
    if (typeof eje !== 'string' || !eje) throw new TypeError('sincronía: hace falta el nombre del eje');
    this.#url = url.replace(/\/+$/, '');
    this.#eje = eje;
    this.#claveLectura = claveLectura;
    this.#firmar = firmar;
    this.#fetch = fetch;
    this.#ahora = ahora;
    this.#sello = sello ?? null;
    this.#recibosPorPasada = Number.isSafeInteger(recibosPorPasada) && recibosPorPasada > 0 ? recibosPorPasada : RECIBOS_POR_PASADA;
  }

  get url() {
    return this.#url;
  }

  get eje() {
    return this.#eje;
  }

  /** El mayor orden del servidor que se ha bajado. */
  get desde() {
    return this.#desde;
  }

  /** El orden del servidor de un evento, si se conoce. */
  orden(id) {
    return this.#ordenes.get(id);
  }

  /** La hora del servidor (`recibido`) de un evento, si se conoce. */
  recibido(id) {
    return this.#recibidos.get(id);
  }

  /** Lo pendiente de subir con sus reintentos: [{ id, intentos, proximo, error }]. */
  get cola() {
    return [...this.#cola].map(([id, c]) => ({ id, ...c }));
  }

  /** Lo que no entró: [{ id, motivo, de }] (de: 'reglas' al bajar, 'reorden' al reordenar, 'servidor' al subir). */
  get rechazados() {
    return [...this.#rechazados].map(([id, r]) => ({ id, ...r }));
  }

  /** Olvida los rechazos (para volver a intentarlo tras arreglar algo). */
  olvidarRechazados() {
    this.#rechazados.clear();
  }

  /**
   * El estado del recibo de llegada de un registro: { instante, rele, firma, recibo? } si ya lo tiene, 'por pedir' si aún
   * no se ha pedido (o falló), 'sin recibo' si el servidor dijo que no lo tiene, o undefined si no se conoce.
   */
  estadoDeRecibo(id) {
    return this.#recibos.get(id);
  }

  /** El adaptador de sello de esta sincronía (o null). */
  get sello() {
    return this.#sello;
  }

  /** Cambia el adaptador de sello (o lo quita con null): la configuración pudo cambiar. */
  usarSello(sello) {
    this.#sello = sello ?? null;
  }

  /**
   * El estado del sello de un registro: { altura, hash, instante, verificado } si ya está en un bloque (`verificado`: la
   * prueba pasó `verificar`; el gancho de la estación «verificado»), 'pendiente' si está en un lote sin bloque, 'por sellar'
   * si aún no se ha pedido, o undefined si no se conoce.
   */
  estadoDeSello(id) {
    return this.#sellos.get(id);
  }

  /** Los ids del eje local que el servidor aún no tiene, en orden de entrada. */
  pendientes(ejeLocal) {
    return ejeLocal.orden.filter((id) => !this.#ordenes.has(id));
  }

  async #pedir(camino, opciones = {}) {
    const cabeceras = { ...(opciones.headers ?? {}) };
    if (this.#claveLectura) cabeceras['X-Clave-Lectura'] = this.#claveLectura;
    let respuesta;
    try {
      respuesta = await this.#fetch(this.#url + camino, { ...opciones, headers: cabeceras });
    } catch (e) {
      throw new SinRed(e);
    }
    let datos = null;
    try {
      datos = await respuesta.json();
    } catch {
      datos = null;
    }
    if (!respuesta.ok) throw new ErrorDelServidor(respuesta.status, datos?.error ?? 'sin detalle');
    return datos;
  }

  /** Sube un evento (POST /eventos; idempotente). Devuelve { orden, recibido, duplicado }. Lanza SinRed o ErrorDelServidor. */
  async subir(evento) {
    let ev = evento;
    if (!ev.firma && this.#firmar) ev = await this.#firmar(ev);
    const r = await this.#pedir('/eventos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eje: this.#eje, evento: ev }) });
    this.#anotar(ev.id, r.orden, r.recibido);
    return { orden: r.orden, recibido: r.recibido, duplicado: r.duplicado === true };
  }

  /** Baja una página (GET /eventos): { eventos: [{ orden, recibido, evento }], siguiente }. */
  async bajar(desde = this.#desde, cuantos) {
    const q = new URLSearchParams({ eje: this.#eje, desde: String(desde) });
    if (cuantos !== undefined) q.set('cuantos', String(cuantos));
    return this.#pedir('/eventos?' + q.toString());
  }

  /** Todas las páginas desde `desde`, una a una. */
  async *paginas(desde = this.#desde, cuantos) {
    let d = desde;
    for (;;) {
      const pagina = await this.bajar(d, cuantos);
      yield pagina;
      if (pagina.siguiente === null || pagina.siguiente === undefined) return;
      d = pagina.siguiente;
    }
  }

  #anotar(id, orden, recibido) {
    this.#ordenes.set(id, orden);
    this.#recibidos.set(id, recibido);
    this.#cola.delete(id);
    if (orden > this.#desde) this.#desde = orden;
  }

  /** Marca en el eje el reloj de los demás con todo lo recibido del servidor (tras restaurar, por ejemplo). */
  marcarReloj(ejeLocal) {
    for (const recibido of this.#recibidos.values()) ejeLocal.marcarReloj(recibido);
    return ejeLocal.relojExterno;
  }

  /** Marca en el eje los recibos ya recibidos (tras restaurar, como marcarReloj): el segundo reloj, X.6.8.1. */
  marcarRecibos(ejeLocal) {
    let n = 0;
    for (const [id, e] of this.#recibos) if (typeof e === 'object' && ejeLocal.marcarRecibo(id, e)) n += 1;
    return n;
  }

  /** Marca en el eje los sellos ya recibidos (tras restaurar, como marcarReloj): el tercer reloj, X.6.8.2. */
  marcarSellos(ejeLocal) {
    let n = 0;
    for (const [id, e] of this.#sellos) if (typeof e === 'object' && ejeLocal.marcarSello(id, e)) n += 1;
    return n;
  }

  /**
   * Sincroniza: baja lo nuevo y lo añade al eje local validándolo con las
   * reglas (lo que no pasa, a `rechazados`); reordena el eje local por el
   * orden del servidor si difiere; sube lo local pendiente en orden (sin red,
   * queda en cola). Devuelve el informe: { bajados, anadidos, rechazados,
   * subidos, pendientes, reordenado, sinRed, errores }. Nunca lanza por la red.
   */
  async sincronizar(ejeLocal, { bajar = true, subir = true, exigirFirmas = true } = {}) {
    if (ejeLocal !== null && ejeLocal !== undefined && !(ejeLocal instanceof Eje)) throw new TypeError('sincronizar: hace falta el eje local (o null para crearlo desde el servidor)');
    let eje = ejeLocal ?? null;
    const informe = { eje, bajados: 0, anadidos: [], rechazados: [], subidos: [], pendientes: [], reordenado: false, sinRed: false, errores: [] };
    const nuevos = new Map(); // id → evento del servidor que el eje local no tiene
    if (bajar || !eje) {
      try {
        for await (const pagina of this.paginas(this.#desde)) {
          for (const { orden, recibido, evento } of pagina.eventos) {
            informe.bajados += 1;
            this.#anotar(evento.id, orden, recibido);
            eje?.marcarReloj(recibido);
            if (!eje?.eventos.has(evento.id) && !this.#rechazados.has(evento.id)) nuevos.set(evento.id, evento);
          }
        }
      } catch (e) {
        if (e instanceof SinRed) informe.sinRed = true;
        else informe.errores.push('bajar: ' + e.message);
      }
      // Sin eje local, el primero que llega del servidor es el génesis: el eje nace de él y lo demás entra detrás.
      if (!eje && nuevos.size) {
        const [primero] = [...nuevos.keys()].sort((a, b) => this.#ordenes.get(a) - this.#ordenes.get(b));
        try {
          eje = await Eje.desde([nuevos.get(primero)], { exigirFirmas });
          informe.eje = eje;
          informe.anadidos.push(primero);
          nuevos.delete(primero);
          this.marcarReloj(eje);
        } catch (e) {
          informe.errores.push('génesis: ' + e.message);
          return informe;
        }
      }
      if (eje && !(await this.#integrar(eje, nuevos, informe))) return informe;
    }
    if (!eje) return informe;
    // Sin red al bajar, se intenta igual subir lo pendiente: así queda en cola con su espera (el primer intento falla).
    if (subir) await this.#subirPendientes(eje, informe);
    informe.pendientes = this.pendientes(eje);
    await this.#recibir(eje, informe);
    await this.#sellar(eje, informe);
    return informe;
  }

  /**
   * El recibo de llegada, tras asentar: lo nuevo (lo bajado que entró y lo subido) pasa a `por pedir`; de cada uno se pide
   * `GET /eventos/recibo` (hasta RECIBOS_POR_PASADA, el resto en la próxima) y se escribe en el eje (X.6.8.1). Informe:
   * `recibos` { recibidos: ids que entraron en el eje, pendientes: cuántos faltan, errores } (solo si había algo que pedir).
   * Si el servidor no tiene la ruta, se deja de pedir en esta sesión. Nunca lanza.
   */
  async #recibir(eje, informe) {
    if (this.#sinRutaDeRecibo) return;
    for (const id of [...informe.anadidos, ...informe.subidos]) if (eje.eventos.has(id) && !this.#recibos.has(id)) this.#recibos.set(id, 'por pedir');
    const porPedir = [...this.#recibos].filter(([id, e]) => e === 'por pedir' && eje.eventos.has(id)).map(([id]) => id);
    if (!porPedir.length) return;
    const r = (informe.recibos = { recibidos: [], pendientes: 0, errores: [] });
    const q = (id) => '/eventos/recibo?' + new URLSearchParams({ eje: this.#eje, id }).toString();
    for (const id of porPedir.slice(0, this.#recibosPorPasada)) {
      try {
        const datos = await this.#pedir(q(id));
        // Un servidor sin la ruta (la función de Supabase) lo toma por una lectura de eventos: 200 sin la forma del recibo.
        if (typeof datos?.instante !== 'string' || typeof datos?.rele !== 'string' || typeof datos?.firma !== 'string') {
          this.#sinRutaDeRecibo = true;
          break;
        }
        eje.marcarRecibo(id, datos);
        this.#recibos.set(id, eje.recibo(id) ?? 'sin recibo');
        if (eje.recibo(id)) r.recibidos.push(id);
        else r.errores.push({ id, motivo: 'el recibo del servidor no tiene la forma esperada' });
      } catch (e) {
        if (e instanceof ErrorDelServidor && e.estado === 404 && /^sin recibo/.test(e.message.replace(/^servidor 404: /, ''))) {
          this.#recibos.set(id, 'sin recibo'); // la ruta existe pero ese id no tiene recibo: no se insiste
        } else if (e instanceof ErrorDelServidor && [404, 405, 501].includes(e.estado) && !/^eje desconocido/.test(e.message.replace(/^servidor [0-9]+: /, ''))) {
          this.#sinRutaDeRecibo = true; // sin la ruta: una vez por sesión
          break;
        } else {
          r.errores.push({ id: e instanceof SinRed ? null : id, motivo: e.message });
          break; // sin red, 401, 5xx…: se reintenta en la próxima pasada
        }
      }
    }
    if (this.#sinRutaDeRecibo) {
      delete informe.recibos;
      for (const [id, e] of [...this.#recibos]) if (e === 'por pedir') this.#recibos.delete(id);
      return;
    }
    r.pendientes = [...this.#recibos].filter(([id, e]) => e === 'por pedir' && eje.eventos.has(id)).length;
  }

  /**
   * El sello, tras asentar: lo nuevo (lo bajado que entró y lo subido) pasa a `por sellar`; se piden al servicio los ids
   * por sellar de una vez (solo ids); de cada pendiente se pide la prueba, y la que ya está en un bloque se verifica y, si
   * vale, se escribe en el eje (X.6.8.2). Informe: `sellos` { sellados: ids que entraron en el eje, pendientes: cuántos
   * esperan bloque, errores }. Nunca lanza: un fallo del servicio de sello queda en `errores` y se reintenta la próxima vez.
   */
  async #sellar(eje, informe) {
    if (!this.#sello) return;
    informe.sellos = { sellados: [], pendientes: 0, errores: [] };
    for (const id of [...informe.anadidos, ...informe.subidos]) if (eje.eventos.has(id) && !this.#sellos.has(id)) this.#sellos.set(id, 'por sellar');
    const porSellar = [...this.#sellos].filter(([id, e]) => e === 'por sellar' && eje.eventos.has(id)).map(([id]) => id);
    try {
      if (porSellar.length) {
        await this.#sello.sellar(porSellar);
        for (const id of porSellar) this.#sellos.set(id, 'pendiente');
      }
      let pruebas = 0;
      for (const [id, e] of [...this.#sellos]) {
        if (e !== 'pendiente' || !eje.eventos.has(id)) continue;
        if (pruebas++ >= PRUEBAS_POR_PASADA) {
          informe.sellos.pendientes += 1; // el resto, en la próxima pasada
          continue;
        }
        const p = await this.#sello.prueba(id);
        if (p === null) {
          this.#sellos.set(id, 'por sellar'); // el servicio no lo conoce (se reinició): se vuelve a pedir
          informe.sellos.pendientes += 1;
        } else if (p.pendiente) {
          informe.sellos.pendientes += 1;
        } else {
          const v = await this.#sello.verificar(eje.obtener(id), p);
          if (v?.ok !== true) {
            informe.sellos.errores.push({ id, motivo: v?.motivo ?? 'la prueba no se pudo verificar' });
            continue; // no entra en el eje; se vuelve a pedir la próxima vez
          }
          const sello = { altura: p.altura, hash: p.hash, instante: p.instante, verificado: true };
          eje.marcarSello(id, sello);
          this.#sellos.set(id, eje.sello(id) ?? sello);
          informe.sellos.sellados.push(id);
        }
      }
    } catch (e) {
      informe.sellos.errores.push({ id: null, motivo: e.message });
    }
  }

  /** Mete lo nuevo del servidor en el eje local: por detrás si el orden local ya es el del servidor; si no, reordenando. */
  async #integrar(ejeLocal, nuevos, informe) {
    if (!nuevos.size) return true;
    const porOrden = (a, b) => this.#ordenes.get(a) - this.#ordenes.get(b);
    // El eje del servidor es otro si su primer evento no es este génesis: no se mezcla nada.
    const primero = [...this.#ordenes.keys()].sort(porOrden)[0];
    if (primero !== ejeLocal.genesisId) {
      informe.errores.push('el eje «' + this.#eje + '» del servidor no es este: su génesis es ' + String(primero).slice(0, 8) + ' y el local, ' + ejeLocal.genesisId.slice(0, 8));
      return false;
    }
    const pendientes = this.pendientes(ejeLocal);
    const conocidos = ejeLocal.orden.filter((id) => this.#ordenes.has(id));
    const ultimo = conocidos.length ? this.#ordenes.get(conocidos[conocidos.length - 1]) : -1;
    // Rápido: nada pendiente, lo local ya va en el orden del servidor y todo lo nuevo viene detrás.
    const porDetras = !pendientes.length
      && conocidos.every((id, k) => k === 0 || porOrden(conocidos[k - 1], id) < 0)
      && [...nuevos.keys()].every((id) => this.#ordenes.get(id) > ultimo);
    const anotarRechazo = (id, motivo, de) => {
      this.#rechazados.set(id, { motivo, de });
      informe.rechazados.push({ id, motivo, de });
    };
    if (porDetras) {
      for (const id of [...nuevos.keys()].sort(porOrden)) {
        try {
          await ejeLocal.anadir(nuevos.get(id));
          informe.anadidos.push(id);
        } catch (e) {
          anotarRechazo(id, e.message, 'reglas');
        }
      }
      return true;
    }
    // El orden del servidor, con lo nuevo en su sitio; lo pendiente de subir queda detrás (eje.reordenar).
    const lista = [...conocidos, ...nuevos.keys()].sort(porOrden).map((id) => nuevos.get(id) ?? id);
    const { anadidos, rechazados } = await ejeLocal.reordenar(lista);
    informe.reordenado = true;
    informe.anadidos.push(...anadidos);
    for (const { id, motivo } of rechazados) anotarRechazo(id, motivo, nuevos.has(id) ? 'reglas' : 'reorden');
    return true;
  }

  async #subirPendientes(ejeLocal, informe) {
    const ahora = this.#ahora();
    for (const id of this.pendientes(ejeLocal)) {
      const entrada = this.#cola.get(id) ?? { intentos: 0, proximo: 0, error: null };
      if (entrada.proximo > ahora) break; // espera creciente: lo de detrás depende de esto, así que no se salta
      try {
        const r = await this.subir(ejeLocal.obtener(id));
        ejeLocal.marcarReloj(r.recibido);
        informe.subidos.push(id);
      } catch (e) {
        entrada.intentos += 1;
        entrada.proximo = ahora + espera(entrada.intentos);
        entrada.error = e instanceof SinRed ? null : e.message;
        this.#cola.set(id, entrada);
        if (e instanceof SinRed) informe.sinRed = true;
        else {
          this.#rechazados.set(id, { motivo: e.message, de: 'servidor' });
          informe.rechazados.push({ id, motivo: e.message, de: 'servidor' });
        }
        break;
      }
    }
  }

  /** La forma guardable (sin la clave de lectura: esa va aparte, en el almacén local de la cuenta). */
  serializar() {
    return {
      version: VERSION_SINCRONIA,
      url: this.#url,
      eje: this.#eje,
      desde: this.#desde,
      ordenes: [...this.#ordenes],
      recibidos: [...this.#recibidos],
      cola: [...this.#cola].map(([id, c]) => [id, { ...c }]),
      rechazados: [...this.#rechazados].map(([id, r]) => [id, { ...r }]),
      ...(this.#recibos.size ? { recibos: [...this.#recibos].map(([id, e]) => [id, typeof e === 'object' ? { ...e } : e]) } : {}),
      ...(this.#sellos.size ? { sellos: [...this.#sellos].map(([id, e]) => [id, typeof e === 'object' ? { ...e } : e]) } : {}),
    };
  }

  /** Reconstruye desde lo guardado; `opciones` trae la clave de lectura (y, si se quiere, otra url o eje, firmar, fetch). */
  static restaurar(datos, opciones = {}) {
    if (!datos || datos.version !== VERSION_SINCRONIA || typeof datos.url !== 'string' || typeof datos.eje !== 'string') throw new Error('datos de sincronía inválidos');
    const s = new Sincronia({ url: datos.url, eje: datos.eje, ...opciones });
    s.#desde = Number.isSafeInteger(datos.desde) && datos.desde >= 0 ? datos.desde : 0;
    for (const [id, orden] of datos.ordenes ?? []) s.#ordenes.set(id, orden);
    for (const [id, recibido] of datos.recibidos ?? []) s.#recibidos.set(id, recibido);
    for (const [id, c] of datos.cola ?? []) s.#cola.set(id, { intentos: c.intentos ?? 0, proximo: c.proximo ?? 0, error: c.error ?? null });
    for (const [id, r] of datos.rechazados ?? []) s.#rechazados.set(id, { motivo: r.motivo, de: r.de });
    for (const [id, e] of datos.recibos ?? []) {
      if (e === 'por pedir' || e === 'sin recibo') s.#recibos.set(id, e);
      else if (e && typeof e === 'object') s.#recibos.set(id, { instante: e.instante, rele: e.rele, firma: e.firma, ...(e.recibo ? { recibo: e.recibo } : {}) });
    }
    for (const [id, e] of datos.sellos ?? []) {
      if (e === 'por sellar' || e === 'pendiente') s.#sellos.set(id, e);
      else if (e && typeof e === 'object') s.#sellos.set(id, { altura: e.altura, hash: e.hash, instante: e.instante, verificado: e.verificado === true });
    }
    return s;
  }
}
