// El libro local (encargo 3c-2b, tras 3c-1). Decisión de VG: cada interacción (ver, tocar) quema UN T DE SEGUNDO
// en un libro local de la persona, nunca en el eje compartido; al registrar, lo normal es ENGLOBAR todas esas
// interacciones en UN MINUTO y UN SOLO REGISTRO, anclado a lo anterior, y al eje solo llega el minuto. Las escalas de
// T son niveles de agregación: el segundo es una interacción; el minuto, un registro que engloba interacciones; la
// hora, el día, la semana, el ciclo y el año, registros que engloban registros (cada registro de una escala ancla en
// su 6 los de la escala inferior). Englobar hacia arriba sobre registros del eje (minutos en una hora, etc.) es la
// plantilla «aggregate T» del encargo 3c-2a: aquí solo lo local, segundos → minuto. Documentación: docs/CONTRATO.md,
// «Libro local».
//
//   new LibroLocal(eje, yo)          un Libro propio (la misma capa cero, src/libro.js) con la cartera de T de la escala
//                                    de interacción de `yo`: la asignación diaria de la época (epoch.1.3.1), que se
//                                    renueva cada día civil como en el eje y no se acumula
//   ver(X) · tocar(X, accion)        queman 1 T de segundo y anotan { t, X, accion }; sin T del día, { ok: false, motivo }
//                                    con el motivo de la regla de la época («writing burns today's T»), sin lanzar
//   recorrido(desde)                 lo anotado y aún no englobado
//   englobar(firmar, { nota })       UNA transacción para el eje: quema 1 T de minuto de `yo` (la regla la cobra como a
//                                    cualquier registro) y escribe un registro de escala minuto, anclado a lo anterior,
//                                    cuyo 6 ancla el recorrido y cuyo 7 dice la escala; marca lo local como englobado
//   serializar() · restaurar()       la forma guardable (la carta la guarda en el navegador) y su vuelta
//
// Nada de los segundos se publica: en el eje no entra ninguna serie de T de segundo por aquí.

import { Libro, acunar, quemar, transaccion } from './libro.js';
import { ESCALAS_T, diaCivil } from './tokens.js';
import { EPOCA_0_BTML } from './epocas.js';
import { crearEvento, canonico, hash, RAIZ } from './evento.js';
import { mensaje, configuracion } from './contrato.js';
import { quemaDelCoste } from './escritura.js';

/** La clase de la acuñación de la asignación del día en el libro local (la misma palabra que el eje: src/eje.js). */
const ASIGNACION = 'asignacion';
/** La escala de una interacción: la primera de la época (epoch.1.3.1.0: el segundo). */
export const ESCALA_INTERACCION = ESCALAS_T[0];
/** La escala del registro que engloba interacciones: la siguiente (epoch.1.3.1.1: el minuto). */
export const ESCALA_REGISTRO = ESCALAS_T[1];
/** La regla de la época que cobra el T del día; su mensaje es el motivo que devuelven ver y tocar sin T. */
export const REGLA_DEL_T = "writing burns today's T";
/** Las acciones de las interacciones que anota el libro local por defecto. */
export const VER = 'ver';

/** La versión de lo que serializa el libro local. */
export const VERSION_LOCAL = 1;

const raizDe = (epoca) => (Array.isArray(epoca) ? epoca : epoca.registro ?? epoca.payload);
const hoja = (x) => (Array.isArray(x) ? x[0] : x);

/** La asignación diaria de una escala según la época (epoch.1.3.1.k.1), o 0 si no es un número («sin límite» no es una asignación). */
function asignacionDe(epoca, escala) {
  const k = ESCALAS_T.indexOf(escala);
  const v = hoja(raizDe(epoca)?.[1]?.[3]?.[1]?.[k]?.[1]);
  return typeof v === 'number' ? v : 0;
}

export class LibroLocal {
  #eje;
  #yo;
  #epoca;
  #libro = new Libro();
  #anotaciones = []; // { t, X, accion, en: null | id del registro que lo englobó }, por llegada
  #anterior = null; // el último registro englobado en el eje (lo anterior a lo que se ancla el siguiente)

  /** `eje` es el eje compartido (se lee: el alta de `yo`, la época, los registros); `yo`, la identidad; `epoca`, la que se lee (por defecto la 0). */
  constructor(eje, yo, { epoca = EPOCA_0_BTML } = {}) {
    if (typeof yo !== 'string' || !yo) throw new TypeError('el libro local es de una identidad');
    this.#eje = eje ?? null;
    this.#yo = yo;
    this.#epoca = epoca;
  }

  get yo() {
    return this.#yo;
  }

  /** El libro de la capa cero del libro local: para leer (saldos, sumas, asientos). */
  get libro() {
    return this.#libro;
  }

  /** El id del último registro que englobó interacciones (lo anterior), o null si aún no hay ninguno. */
  get anterior() {
    return this.#anterior;
  }

  /** La serie de T de las interacciones (T:segundo). */
  get serie() {
    return 'T:' + ESCALA_INTERACCION;
  }

  /** Lo gastado hoy (el día civil de `t`) de la asignación de la escala de interacción: lo acuñado con esa etiqueta. */
  gastadoHoy(t = new Date().toISOString()) {
    return this.#libro.sumas({ primitiva: 'acunar', serie: this.serie, titular: this.#yo, clase: ASIGNACION, etiqueta: diaCivil(t) });
  }

  /** Lo que queda hoy de la asignación: la de la época menos lo gastado; nada se acumula de un día a otro. */
  quedaHoy(t = new Date().toISOString()) {
    return Math.max(0, asignacionDe(this.#epoca, ESCALA_INTERACCION) - this.gastadoHoy(t));
  }

  /** Las interacciones sobre un registro X (cuántos segundos lleva quemados ahí), englobadas o no. */
  tiempo(X) {
    return this.#libro.sumas({ primitiva: 'quemar', serie: this.serie, registro: X });
  }

  /** Ver X: una interacción. */
  ver(X, opciones = {}) {
    return this.#interaccion(X, VER, opciones);
  }

  /** Tocar X con una acción (un texto: lo que se hizo). */
  tocar(X, accion, opciones = {}) {
    if (typeof accion !== 'string' || !accion) return { ok: false, motivo: 'tocar: la acción es un texto' };
    return this.#interaccion(X, accion, opciones);
  }

  /**
   * Una interacción: quema 1 T de la escala de interacción en el libro local, sacado de la asignación del día (se
   * acuña con tope, como en el eje, y se quema en el mismo paso: nada queda, nada se acumula) y la anota. Si no queda
   * T del día, no lanza: { ok: false, motivo } con el mensaje de la regla de la época que cobra el T, en el idioma de
   * la configuración de `yo`. X es el id de un registro del eje.
   */
  #interaccion(X, accion, { t = new Date().toISOString() } = {}) {
    if (typeof X !== 'string' || !X) return { ok: false, motivo: 'la interacción es sobre un registro (su id)' };
    if (this.#eje && !this.#eje.obtener(X)) return { ok: false, motivo: 'registro desconocido: ' + X.slice(0, 8) };
    const dia = diaCivil(t);
    if (!Number.isFinite(dia)) return { ok: false, motivo: 't no es un instante' };
    const tx = transaccion({
      movimientos: [[acunar(this.serie, this.#yo, 1, { clase: ASIGNACION, etiqueta: dia, tope: asignacionDe(this.#epoca, ESCALA_INTERACCION) }), quemar(this.serie, this.#yo, 1)]],
      ancla: { sobre: X, en: null },
      memo: accion,
      autor: this.#yo,
      t,
    });
    const simulacion = this.#libro.simular();
    const fallo = simulacion.paso(tx.movimientos[0], 0);
    if (fallo) return { ok: false, motivo: this.#motivoSinT(X, accion, t) };
    this.#libro.asentar(tx, simulacion);
    const anotacion = { t, X, accion, en: null };
    this.#anotaciones.push(anotacion);
    return { ok: true, anotacion: { ...anotacion }, queda: this.quedaHoy(t) };
  }

  /** El motivo de la regla de la época cuando no queda T del día, con sus huecos rellenos sobre la interacción como candidata. */
  #motivoSinT(X, accion, t) {
    const candidata = { autor: this.#yo, sobre: X, en: RAIZ, t, movimientos: [{ token: 'T', escala: ESCALA_INTERACCION, cantidad: 1, de: this.#yo, a: null }], payload: [accion], contexto: {} };
    let idioma;
    try {
      idioma = this.#eje ? configuracion(this.#eje, this.#yo, { epoca: this.#epoca }).language : undefined;
    } catch {
      idioma = undefined;
    }
    let texto = null;
    try {
      texto = mensaje(this.#eje, REGLA_DEL_T, idioma, { ev: candidata, epoca: this.#epoca });
    } catch {
      texto = null;
    }
    return texto ?? REGLA_DEL_T + ': ' + this.#yo + ' has no T of ' + ESCALA_INTERACCION + ' left today';
  }

  /**
   * Lo anotado y aún no englobado, por llegada: [{ t, X, accion }]. `desde` es un índice (cuántas de las pendientes se
   * saltan) o un instante (solo las de t ≥ desde).
   */
  recorrido(desde = 0) {
    const pendientes = this.#anotaciones.filter((a) => a.en === null);
    const lista = typeof desde === 'string' ? pendientes.filter((a) => a.t >= desde) : pendientes.slice(Math.max(0, desde));
    return lista.map(({ t, X, accion }) => ({ t, X, accion }));
  }

  /** Todas las anotaciones, englobadas o no: [{ t, X, accion, en }]. */
  anotaciones() {
    return this.#anotaciones.map((a) => ({ ...a }));
  }

  /**
   * Englobar: UNA transacción para el eje con todo lo pendiente del libro local. Quema 1 T de la escala del registro
   * (el minuto) de `yo` (la regla «writing burns today's T» la cobra como a cualquier registro: sale de su asignación
   * del día en el eje) y escribe un registro de esa escala anclado a lo anterior (el último minuto englobado o, si no
   * hay, el alta de `yo`): 0 la nota; 1 cuántas interacciones; 2 el hash del tramo local (lo que lo acredita); 3 quién;
   * 4 las acciones, por llegada; 5 lo anterior (dónde encaja); 6 el recorrido, de dónde viene: [[los ids visitados, por
   * llegada], [cuántas interacciones], [el primer t, el último t], [el hash]]; 7 la escala. Nada de los segundos sale.
   * `firmar` es la clave privada de `yo` (eje.escribir la firma) o una función async (evento) → evento firmado; sin
   * nada, se escribe sin firma (un eje de demostración). `t` es el instante del registro (por defecto, el de la última
   * interacción). Marca lo local como englobado y devuelve el evento asentado; sin nada pendiente, null.
   */
  async englobar(firmar, { nota, t, en = RAIZ } = {}) {
    if (!this.#eje) throw new Error('englobar: hace falta el eje');
    const pendientes = this.#anotaciones.filter((a) => a.en === null);
    if (!pendientes.length) return null;
    const anterior = this.#anterior ?? this.#eje.alta(this.#yo)?.id;
    if (!anterior) throw new Error('englobar: ' + this.#yo + ' no tiene alta en el eje: nada a lo que anclar');
    const ids = [...new Set(pendientes.map((a) => a.X))];
    const n = pendientes.length;
    const tramo = pendientes.map(({ t: cuando, X, accion }) => ({ t: cuando, X, accion }));
    const h = await hash(canonico(tramo));
    const payload = [
      [nota ?? ESCALA_REGISTRO + ' de ' + this.#yo],
      [n],
      [h],
      [this.#yo],
      pendientes.map((a) => a.accion),
      [{ ref: anterior }],
      [ids, [n], [pendientes[0].t, pendientes[n - 1].t], [h]],
      [ESCALA_REGISTRO],
    ];
    const datos = {
      autor: this.#yo,
      sobre: anterior,
      en,
      t: t ?? pendientes[n - 1].t,
      movimientos: [quemaDelCoste(this.#yo, payload, ESCALA_REGISTRO, { eje: this.#eje })], // lo que la regla del coste exige por sus posiciones (VG 12-11, #64 b)
      payload,
    };
    const ev = typeof firmar === 'function' ? await this.#eje.anadir(await firmar(await crearEvento(datos))) : await this.#eje.escribir(datos, firmar);
    for (const a of pendientes) a.en = ev.id;
    this.#anterior = ev.id;
    return ev;
  }

  /** La forma guardable del libro local: la identidad, lo anterior y las anotaciones (la carta la guarda en el navegador). */
  serializar() {
    return { version: VERSION_LOCAL, yo: this.#yo, anterior: this.#anterior, anotaciones: this.#anotaciones.map((a) => ({ ...a })) };
  }

  /**
   * Reconstruye un libro local desde lo guardado, volviendo a quemar cada interacción en un libro nuevo (como el eje
   * revalida sus eventos). Lo englobado sigue englobado. Lanza si los datos no son de un libro local o una interacción
   * no cabe (la asignación del día no la cubre: alguien tocó lo guardado).
   */
  static restaurar(eje, datos, opciones = {}) {
    if (!datos || datos.version !== VERSION_LOCAL || typeof datos.yo !== 'string' || !Array.isArray(datos.anotaciones)) throw new Error('datos de libro local inválidos');
    const local = new LibroLocal(eje, datos.yo, opciones);
    for (const a of datos.anotaciones) {
      const r = local.#interaccion(a.X, a.accion, { t: a.t });
      if (!r.ok) throw new Error('libro local: una interacción guardada no cabe: ' + r.motivo);
      local.#anotaciones[local.#anotaciones.length - 1].en = a.en ?? null;
    }
    local.#anterior = typeof datos.anterior === 'string' ? datos.anterior : null;
    return local;
  }
}
