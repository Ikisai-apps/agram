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

import { Eje } from './eje.js';

export const VERSION_SINCRONIA = 1;

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

  /**
   * url: la base del servidor (…/functions/v1 en Supabase; http://127.0.0.1:8787 en pruebas). eje: el nombre del eje.
   * claveLectura: la clave de lectura (va en X-Clave-Lectura; nunca se guarda aquí). firmar (opcional): async (evento) →
   * evento firmado, para lo local que llegara sin firma. fetch: la de la plataforma, o una de prueba.
   */
  constructor({ url, eje, claveLectura, firmar, fetch = globalThis.fetch?.bind(globalThis), ahora = () => Date.now() } = {}) {
    if (typeof url !== 'string' || !url) throw new TypeError('sincronía: hace falta la url del servidor');
    if (typeof eje !== 'string' || !eje) throw new TypeError('sincronía: hace falta el nombre del eje');
    this.#url = url.replace(/\/+$/, '');
    this.#eje = eje;
    this.#claveLectura = claveLectura;
    this.#firmar = firmar;
    this.#fetch = fetch;
    this.#ahora = ahora;
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
    return informe;
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
    return s;
  }
}
