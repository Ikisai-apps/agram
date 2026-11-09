// El libro: la capa cero (VG, 9-11: «la capa de abajo es la de
// transacciones»; mapa global §16). Registrar es hacer una transacción.
//
// Cinco primitivas, y nada más:
//
//   acuñar      acunar(serie, a, cantidad)              nace en la cartera de `a`
//   transferir  transferir(serie, de, a, cantidad)      del disponible de `de` al de `a`
//   bloquear    bloquear(serie, de, cantidad, salida)   del disponible de `de` a su bloqueado con esa salida
//   liberar     liberar(serie, de, cantidad, salida)    del bloqueado con esa salida al disponible
//   quemar      quemar(serie, de, cantidad)             sale del disponible de `de` y deja de existir
//
// más un ANCLAJE (`ancla: { sobre, en }`: el registro y la posición donde la
// transacción se escribe) y un MEMO (`memo`: el payload BTML, que el libro no
// lee). Una transacción es { movimientos, ancla, memo, autor, t, firma, … }:
// `movimientos` es la lista de PASOS, y cada paso es una primitiva o un grupo
// de primitivas (un array) que se aplica entero o nada dentro de la
// transacción. La transacción entera se aplica entera o nada.
//
// El libro no sabe de reglas de negocio: solo aritmética (disponible y
// bloqueado por titular, serie y salida; sumas) y atomicidad. Quién puede
// acuñar, cuánto, qué se puede bloquear o cuándo se libera son CONDICIONES DE
// VALIDEZ que se le pasan a `aplicar` (src/condiciones/): funciones
// (tx, libroAntes, contexto) → null | motivo, evaluadas en orden sobre el
// libro de ANTES de la transacción; si alguna da motivo, nada cambia.
//
// Tres campos opcionales de las primitivas, todos aritméticos, para que las
// reglas de hoy quepan sin cambiar de comportamiento:
//   clase, etiqueta   el libro suma aparte cada clase (emisión, asignación,
//                     informativo, reposición… texto opaco) y, por titular,
//                     cada etiqueta (un día civil, por ejemplo): sumas().
//   tope (acuñar)     acuña como mucho lo que falte para que lo acuñado a `a`
//                     con esa clase y esa etiqueta llegue a `tope` (la
//                     acuñación programada; quien fija el tope es la regla).
//   fuentes           (transferir, quemar) las series de donde sale, en orden:
//                     se toma de cada una lo que tenga hasta cubrir la
//                     cantidad. Lo que sale de una fuente que no es la serie
//                     queda en el diario como reposición: quemar en la fuente
//                     y acuñar en la serie, con factor 1.
//   salida            (transferir) sale de lo bloqueado de `de` con esa salida
//                     y llega a `a` bloqueado con la misma salida; si la salida
//                     es `a` (nombra a quien recibe), llega a su disponible. Es
//                     la transferencia con salida del mapa §15 (delegar P para
//                     una decisión) y lo que la invitación guarda para quien
//                     invita (§16: «lo que te doy»).
//
// El diario guarda cada asiento con su transacción; sumas() lee de un índice
// (sin recorrer el diario) salvo que se pida un tramo (desde, hasta).

export const PRIMITIVAS = Object.freeze(['acunar', 'transferir', 'bloquear', 'liberar', 'quemar']);

/** Clase por defecto de una acuñación: la emisión de una serie. */
export const EMISION = 'emision';

/** Clase de lo que pasa de una fuente a la serie (fuentes): quemar allí, acuñar aquí. */
export const REPOSICION = 'reposicion';

// ---------- las cinco primitivas ----------

/** Acuñar `cantidad` de `serie` en la cartera de `a`. Opciones: clase, etiqueta, tope y lo que se quiera llevar (el libro no lo lee). */
export function acunar(serie, a, cantidad, opciones = {}) {
  return { ...opciones, primitiva: 'acunar', serie, a, cantidad };
}

/**
 * Transferir `cantidad` de `serie` del disponible de `de` al de `a`. Opciones: fuentes, clase, etiqueta; y salida:
 * de lo bloqueado de `de` con esa salida a lo bloqueado de `a` con ella (a su disponible si la salida es `a`).
 */
export function transferir(serie, de, a, cantidad, opciones = {}) {
  return { ...opciones, primitiva: 'transferir', serie, de, a, cantidad };
}

/** Bloquear `cantidad` de `serie` de `de`, con su salida (la condición de liberación, declarada). */
export function bloquear(serie, de, cantidad, salida, opciones = {}) {
  return { ...opciones, primitiva: 'bloquear', serie, de, cantidad, salida };
}

/** Liberar `cantidad` de `serie` de `de` que estaba bloqueada con esa salida. */
export function liberar(serie, de, cantidad, salida, opciones = {}) {
  return { ...opciones, primitiva: 'liberar', serie, de, cantidad, salida };
}

/** Quemar `cantidad` de `serie` del disponible de `de`. Opciones: fuentes, clase, etiqueta. */
export function quemar(serie, de, cantidad, opciones = {}) {
  return { ...opciones, primitiva: 'quemar', serie, de, cantidad };
}

/**
 * Una transacción: { movimientos, ancla: { sobre, en }, memo, autor, t,
 * firma, … }. `abre` (opcional) son titulares cuya cuenta nace con ella
 * aunque no reciban nada (el autor del génesis). Lo demás se conserva tal
 * cual; el libro no lo lee.
 */
export function transaccion({ movimientos = [], ancla = { sobre: null, en: null }, memo = null, autor = null, t = null, firma = null, abre = [], ...resto } = {}) {
  return { ...resto, movimientos, ancla, memo, autor, t, firma, abre };
}

// ---------- llaves ----------

// Una llave de texto por partes (sin JSON: es el camino caliente). null y undefined son la misma parte; un número
// no se confunde con su texto.
// Los caracteres de control U+0000 a U+0003 de un texto se escapan, así que ninguna parte se confunde con otra.
const HAY_CONTROL = /[\u0000-\u0003]/;
const CONTROL = /[\u0000-\u0003]/g;
const escapar = (x) => (HAY_CONTROL.test(x) ? x.replace(CONTROL, (c) => '\u0003' + c) : x);
const parte = (x) => (x === null || x === undefined ? '\u0000' : typeof x === 'string' ? escapar(x) : '\u0002' + String(x));
const L = (...partes) => partes.map(parte).join('\u0001');
const texto = (x) => typeof x === 'string' && x.length > 0;
const pasos = (tx) => (Array.isArray(tx?.movimientos) ? tx.movimientos : []);
const comoGrupo = (paso) => (Array.isArray(paso) ? paso : paso ? [paso] : []);

/** Las llaves del índice de sumas que toca un asiento. */
function llavesDeSuma(asiento) {
  const { primitiva: p, serie: s, clase = null, etiqueta = null, titular = null, sobre = null } = asiento;
  return [L('p', p, s), L('c', p, s, clase), L('e', p, s, titular, clase, etiqueta), L('r', p, s, sobre)];
}

/** Por qué una primitiva no tiene forma (o null). Lo que no tiene forma no se simula. */
function formaDe(x) {
  if (!x || typeof x !== 'object' || !PRIMITIVAS.includes(x.primitiva)) return 'primitiva desconocida: ' + (x?.primitiva ?? x);
  if (!texto(x.serie)) return x.primitiva + ': la serie es texto';
  if (!(Number.isFinite(x.cantidad) && x.cantidad > 0)) return x.primitiva + ': la cantidad es un número > 0';
  if (x.primitiva === 'acunar') {
    if (!texto(x.a)) return 'acunar: falta a quién';
    if (x.tope !== undefined && !Number.isFinite(x.tope)) return 'acunar: el tope es un número';
    return null;
  }
  if (!texto(x.de)) return x.primitiva + ': falta de quién';
  if (x.primitiva === 'transferir' && !texto(x.a)) return 'transferir: falta a quién';
  if ((x.primitiva === 'bloquear' || x.primitiva === 'liberar') && !texto(x.salida)) return x.primitiva + ': falta la salida';
  if (x.fuentes !== undefined && (!Array.isArray(x.fuentes) || !x.fuentes.every(texto))) return x.primitiva + ': las fuentes son series';
  if (x.salida !== undefined && x.primitiva === 'transferir' && (!texto(x.salida) || x.fuentes !== undefined)) return 'transferir: la salida es texto, y sin fuentes';
  if (x.salida !== undefined && x.primitiva === 'quemar') return 'quemar: no lleva salida';
  return null;
}

const TEXTO_FALTA = {
  forma: (f) => f.motivo,
  finito: (f) => 'la serie ' + f.serie + ' no admite tanto',
  disponible: (f) => 'saldo disponible insuficiente de ' + f.serie + ' en ' + f.titular + ': ' + f.cantidad + ' pedido',
  bloqueado: (f) => 'no hay ' + f.cantidad + ' de ' + f.serie + ' bloqueado en ' + f.titular + ' con la salida «' + f.salida + '»',
};

// ---------- la simulación: una vista sobre el libro ----------

/**
 * Una vista del libro con los pasos que se le van aplicando, sin tocarlo.
 * Lee de su padre (otra simulación o el libro) lo que no ha cambiado. La usa
 * `aplicar` para la atomicidad: la transacción se simula entera y solo se
 * confirma si nada falla.
 */
export class Simulacion {
  #base;
  disponible = new Map(); // L(titular, serie) → [titular, serie, valor]
  bloqueado = new Map(); // L(titular, serie, salida) → [titular, serie, salida, valor]
  sumas = new Map(); // llave de suma → lo añadido
  cuentas = []; // titulares cuya cuenta nace aquí, en orden
  asientos = []; // { paso, primitiva, serie, de, a, titular, cantidad, salida, clase, etiqueta, origen }
  version;

  constructor(base, version) {
    this.#base = base;
    this.version = version;
  }

  saldo(titular, serie) {
    const e = this.disponible.get(L(titular, serie));
    return e ? e[2] : this.#base.saldo(titular, serie);
  }

  bloqueadoCon(titular, serie, salida) {
    const e = this.bloqueado.get(L(titular, serie, salida));
    return e ? e[3] : this.#base.bloqueadoCon(titular, serie, salida);
  }

  suma(llave) {
    return this.#base.suma(llave) + (this.sumas.get(llave) ?? 0);
  }

  tiene(titular) {
    return this.cuentas.includes(titular) || this.#base.tiene(titular);
  }

  /** Lo acuñado a `titular` en `serie` con esa clase y esa etiqueta, con lo de la simulación. */
  acunadoA(serie, titular, clase = EMISION, etiqueta = null) {
    return this.suma(L('e', 'acunar', serie, titular, clase, etiqueta));
  }

  abrir(titular) {
    if (!this.tiene(titular)) this.cuentas.push(titular);
  }

  /**
   * Aplica un paso (una primitiva o un grupo) entero o nada: devuelve null o
   * el fallo { paso, primitiva, serie, titular, salida, cantidad, falta, texto }.
   */
  paso(paso, indice) {
    const hija = new Simulacion(this, this.version);
    for (const x of comoGrupo(paso)) {
      const fallo = hija.#primitiva(x, indice);
      if (fallo) return { paso: indice, ...fallo, grupo: comoGrupo(paso), texto: TEXTO_FALTA[fallo.falta](fallo) };
    }
    this.#fundir(hija);
    return null;
  }

  #fundir(hija) {
    for (const [k, v] of hija.disponible) this.disponible.set(k, v);
    for (const [k, v] of hija.bloqueado) this.bloqueado.set(k, v);
    for (const [k, v] of hija.sumas) this.sumas.set(k, (this.sumas.get(k) ?? 0) + v);
    for (const t of hija.cuentas) this.abrir(t);
    this.asientos.push(...hija.asientos);
  }

  #poner(titular, serie, valor) {
    this.disponible.set(L(titular, serie), [titular, serie, valor]);
  }

  #ponerB(titular, serie, salida, valor) {
    this.bloqueado.set(L(titular, serie, salida), [titular, serie, salida, valor]);
  }

  #asentar(asiento) {
    this.asientos.push(asiento);
    for (const k of llavesDeSuma(asiento)) this.sumas.set(k, (this.sumas.get(k) ?? 0) + asiento.cantidad);
  }

  #primitiva(x, paso) {
    const mal = formaDe(x);
    if (mal) return { primitiva: x?.primitiva ?? null, serie: x?.serie ?? null, titular: null, cantidad: x?.cantidad, falta: 'forma', motivo: mal };
    const { primitiva, serie } = x;
    const clase = x.clase ?? (primitiva === 'acunar' ? EMISION : null);
    const etiqueta = x.etiqueta ?? null;
    const base = { paso, primitiva, serie, clase, etiqueta, origen: x };
    if (primitiva === 'acunar') {
      const cantidad = x.tope === undefined ? x.cantidad : Math.min(Math.max(0, x.tope - this.acunadoA(serie, x.a, clase, etiqueta)), x.cantidad);
      if (!(cantidad > 0)) return null; // la acuñación programada ya llegó a su tope: no acuña nada
      if (!Number.isFinite(this.suma(L('c', 'acunar', serie, clase)) + cantidad)) return { primitiva, serie, titular: x.a, cantidad, falta: 'finito' };
      this.abrir(x.a);
      this.#poner(x.a, serie, this.saldo(x.a, serie) + cantidad);
      this.#asentar({ ...base, de: null, a: x.a, titular: x.a, cantidad });
      return null;
    }
    const c = x.cantidad;
    const de = x.de;
    if (primitiva === 'bloquear') {
      if (this.saldo(de, serie) < c) return { primitiva, serie, titular: de, salida: x.salida, cantidad: c, falta: 'disponible' };
      this.#poner(de, serie, this.saldo(de, serie) - c);
      this.#ponerB(de, serie, x.salida, this.bloqueadoCon(de, serie, x.salida) + c);
      this.#asentar({ ...base, de, a: de, titular: de, salida: x.salida, cantidad: c });
      return null;
    }
    if (primitiva === 'liberar') {
      if (this.bloqueadoCon(de, serie, x.salida) < c) return { primitiva, serie, titular: de, salida: x.salida, cantidad: c, falta: 'bloqueado' };
      this.#ponerB(de, serie, x.salida, this.bloqueadoCon(de, serie, x.salida) - c);
      this.#poner(de, serie, this.saldo(de, serie) + c);
      this.#asentar({ ...base, de, a: de, titular: de, salida: x.salida, cantidad: c });
      return null;
    }
    // transferir y quemar: del disponible de `de`, de la serie o de sus fuentes, en orden.
    if (primitiva === 'transferir' && x.salida !== undefined) {
      // La transferencia con salida: sale de lo bloqueado con esa salida y llega bloqueada con ella (libre si la
      // salida nombra a quien recibe).
      if (this.bloqueadoCon(de, serie, x.salida) < c) return { primitiva, serie, titular: de, salida: x.salida, cantidad: c, falta: 'bloqueado' };
      this.#ponerB(de, serie, x.salida, this.bloqueadoCon(de, serie, x.salida) - c);
      this.abrir(x.a);
      if (x.a === x.salida) this.#poner(x.a, serie, this.saldo(x.a, serie) + c);
      else this.#ponerB(x.a, serie, x.salida, this.bloqueadoCon(x.a, serie, x.salida) + c);
      this.#asentar({ ...base, de, a: x.a, titular: de, salida: x.salida, cantidad: c });
      return null;
    }
    const fuentes = x.fuentes ?? [serie];
    const plan = [];
    let resta = c;
    for (const f of fuentes) {
      const hay = this.saldo(de, f);
      if (hay <= 0) continue;
      const usa = Math.min(hay, resta);
      plan.push([f, usa]);
      resta -= usa;
      if (resta <= 0) break;
    }
    if (resta > 0) return { primitiva, serie, titular: de, cantidad: c, fuentes, falta: 'disponible' };
    for (const [f, usa] of plan) {
      this.#poner(de, f, this.saldo(de, f) - usa);
      if (f !== serie) {
        // Reposición: lo que sale de otra serie se quema allí y se acuña aquí (factor 1).
        this.#asentar({ paso, primitiva: 'quemar', serie: f, clase: REPOSICION, etiqueta: null, de, a: null, titular: de, cantidad: usa, origen: x });
        this.#asentar({ paso, primitiva: 'acunar', serie, clase: REPOSICION, etiqueta: null, de: null, a: de, titular: de, cantidad: usa, origen: x });
      }
    }
    if (primitiva === 'transferir') {
      this.abrir(x.a);
      this.#poner(x.a, serie, this.saldo(x.a, serie) + c);
      this.#asentar({ ...base, de, a: x.a, titular: de, cantidad: c });
    } else {
      this.#asentar({ ...base, de, a: null, titular: de, cantidad: c });
    }
    return null;
  }
}

// ---------- condiciones ----------

/** Un resultado de condición, como lista de motivos { texto, … } con el nombre de la condición. */
function motivosDe(resultado, nombre) {
  if (resultado === null || resultado === undefined || resultado === false || resultado === '') return [];
  const lista = Array.isArray(resultado) ? resultado : [resultado];
  return lista.flatMap((m) => {
    if (m === null || m === undefined || m === false || m === '') return [];
    if (typeof m === 'string') return [{ texto: m, condicion: nombre }];
    return [{ condicion: nombre, ...m, texto: String(m.texto) }];
  });
}

// ---------- el libro ----------

export class Libro {
  #disponible = new Map(); // titular → Map(serie → cantidad)
  #bloqueado = new Map(); // titular → Map(serie → Map(salida → cantidad))
  #porSalida = new Map(); // salida → Map(serie → Map(titular → cantidad))
  #sumas = new Map(); // llave de suma → total
  #altas = new Map(); // titular → la transacción con la que nació su cuenta
  #diario = []; // asientos, en orden: { n, tx, paso, primitiva, serie, de, a, titular, cantidad, salida, clase, etiqueta, origen }
  #porSobre = new Map(); // registro (ancla.sobre) → índices de sus asientos en el diario
  #transacciones = [];
  #version = 0;

  // ---- lecturas ----

  /** Disponible de `titular` en `serie`: lo que se puede transferir, bloquear o quemar. */
  saldo(titular, serie) {
    return this.#disponible.get(titular)?.get(serie) ?? 0;
  }

  /** Bloqueado de `titular` en `serie` con esa salida (sin `salida`, todas sumadas). */
  bloqueado(titular, serie, salida) {
    const porSalida = this.#bloqueado.get(titular)?.get(serie);
    if (!porSalida) return 0;
    if (salida !== undefined) return porSalida.get(salida) ?? 0;
    let total = 0;
    for (const v of porSalida.values()) total += v;
    return total;
  }

  /** Lo mismo que bloqueado(titular, serie, salida), con la salida obligatoria (lo que lee una simulación). */
  bloqueadoCon(titular, serie, salida) {
    return this.#bloqueado.get(titular)?.get(serie)?.get(salida) ?? 0;
  }

  /** Lo bloqueado con una salida, sumando titulares: de una serie, o { serie: cantidad } de todas. */
  bloqueadoPorSalida(salida, serie) {
    const porSerie = this.#porSalida.get(salida);
    if (serie === undefined) {
      // Por un Map y Object.fromEntries: una serie o una salida llamada «__proto__» o «constructor» es una clave más (SEG-12).
      const r = new Map();
      for (const [s, porTitular] of porSerie ?? []) for (const v of porTitular.values()) r.set(s, (r.get(s) ?? 0) + v);
      return Object.fromEntries(r);
    }
    let total = 0;
    for (const v of porSerie?.get(serie)?.values() ?? []) total += v;
    return total;
  }

  /** Bloqueos con una salida, de cualquier titular y serie: [{ titular, serie, cantidad }] con cantidad > 0. */
  bloqueosCon(salida) {
    const lista = [];
    for (const [serie, porTitular] of this.#porSalida.get(salida) ?? []) {
      for (const [titular, cantidad] of porTitular) if (cantidad > 0) lista.push({ titular, serie, cantidad });
    }
    return lista;
  }

  /** Bloqueos de un titular: [{ serie, salida, cantidad }] con cantidad > 0. */
  bloqueos(titular) {
    const lista = [];
    for (const [serie, porSalida] of this.#bloqueado.get(titular) ?? []) {
      for (const [salida, cantidad] of porSalida) if (cantidad > 0) lista.push({ serie, salida, cantidad });
    }
    return lista;
  }

  /** Lo bloqueado de cada serie, sumando titulares y salidas: Map(serie → cantidad), recorriendo titulares, series y salidas en su orden. */
  bloqueadoPorSerie() {
    const r = new Map();
    for (const porSerie of this.#bloqueado.values()) {
      for (const [serie, porSalida] of porSerie) for (const v of porSalida.values()) r.set(serie, (r.get(serie) ?? 0) + v);
    }
    return r;
  }

  /** ¿Tiene cuenta `titular`? (La abre la primera transacción que le da algo, o `abre`.) */
  tiene(titular) {
    return this.#disponible.has(titular);
  }

  /** Titulares con cuenta, en el orden en que nacieron. */
  titulares() {
    return [...this.#disponible.keys()];
  }

  /** Disponible de un titular por serie: [[serie, cantidad]] en el orden en que tocó cada serie (ceros incluidos). */
  disponibles(titular) {
    return [...(this.#disponible.get(titular) ?? [])];
  }

  /**
   * La cartera de un titular por series (lo que será la posición 1 de su
   * alta): { serie: { disponible, bloqueado: { salida: cantidad } } }, solo
   * las series con algo.
   */
  vista(titular) {
    // Se monta en Maps y se devuelve con Object.fromEntries: las series y las salidas son textos de fuera, y una
    // llamada «__proto__» o «constructor» ha de ser una clave propia, no tocar el prototipo (SEG-12).
    const r = new Map();
    for (const [serie, v] of this.#disponible.get(titular) ?? []) if (v !== 0) r.set(serie, { disponible: v, bloqueado: new Map() });
    for (const [serie, porSalida] of this.#bloqueado.get(titular) ?? []) {
      for (const [salida, v] of porSalida) {
        if (v === 0) continue;
        if (!r.has(serie)) r.set(serie, { disponible: this.saldo(titular, serie), bloqueado: new Map() });
        r.get(serie).bloqueado.set(salida, v);
      }
    }
    return Object.fromEntries([...r].map(([serie, { disponible, bloqueado }]) => [serie, { disponible, bloqueado: Object.fromEntries(bloqueado) }]));
  }

  /** La transacción con la que nació la cuenta de `titular` (su alta), o null. */
  alta(titular) {
    return this.#altas.get(titular) ?? null;
  }

  /** Total de una llave del índice de sumas (lo usan las simulaciones). */
  suma(llave) {
    return this.#sumas.get(llave) ?? 0;
  }

  /**
   * Sumas del libro (lo que leen las bases): la cantidad de los asientos de
   * `primitiva` (por defecto, todas) en `serie`, filtrados por `registro` (el
   * ancla de su transacción), `titular` (quien recibe al acuñar; quien da en
   * lo demás), `clase` y `etiqueta`, y por tramo de transacciones [desde,
   * hasta) en orden de llegada. Sin `serie`, { serie: total } de todas.
   * Sin tramo y con una combinación indexada, no recorre el diario.
   */
  sumas({ primitiva, serie, registro, titular, clase, etiqueta, desde, hasta } = {}) {
    const tramo = desde !== undefined || hasta !== undefined;
    if (serie !== undefined && primitiva !== undefined && !tramo) {
      if (registro === undefined && titular === undefined && clase === undefined && etiqueta === undefined) return this.suma(L('p', primitiva, serie));
      if (registro === undefined && titular === undefined && etiqueta === undefined) return this.suma(L('c', primitiva, serie, clase));
      if (registro === undefined && titular !== undefined && clase !== undefined) return this.suma(L('e', primitiva, serie, titular, clase, etiqueta ?? null));
      if (registro !== undefined && titular === undefined && clase === undefined && etiqueta === undefined) return this.suma(L('r', primitiva, serie, registro));
    }
    const filtro = (a) => (primitiva === undefined || a.primitiva === primitiva) && (serie === undefined || a.serie === serie)
      && (titular === undefined || a.titular === titular) && (clase === undefined || a.clase === clase)
      && (etiqueta === undefined || a.etiqueta === etiqueta)
      && (desde === undefined || a.n >= desde) && (hasta === undefined || a.n < hasta);
    const fuente = registro === undefined ? this.#diario : (this.#porSobre.get(registro) ?? []).map((i) => this.#diario[i]);
    if (serie !== undefined) return fuente.filter(filtro).reduce((s, a) => s + a.cantidad, 0);
    const r = new Map(); // SEG-12: como en vista
    for (const a of fuente) if (filtro(a)) r.set(a.serie, (r.get(a.serie) ?? 0) + a.cantidad);
    return Object.fromEntries(r);
  }

  /** Asientos del diario (copias), con los mismos filtros que sumas: [{ n, primitiva, serie, de, a, titular, cantidad, salida, clase, etiqueta, origen, tx }]. */
  asientos({ primitiva, serie, registro, titular, clase, etiqueta, desde, hasta } = {}) {
    const fuente = registro === undefined ? this.#diario : (this.#porSobre.get(registro) ?? []).map((i) => this.#diario[i]);
    return fuente.filter((a) => (primitiva === undefined || a.primitiva === primitiva) && (serie === undefined || a.serie === serie)
      && (titular === undefined || a.titular === titular) && (clase === undefined || a.clase === clase)
      && (etiqueta === undefined || a.etiqueta === etiqueta)
      && (desde === undefined || a.n >= desde) && (hasta === undefined || a.n < hasta)).map((a) => ({ ...a }));
  }

  /** Cuántas transacciones se han asentado. */
  get longitud() {
    return this.#transacciones.length;
  }

  // ---- escribir ----

  /** Una simulación vacía sobre el libro de ahora. */
  simular() {
    return new Simulacion(this, this.#version);
  }

  /**
   * Solo las condiciones, en orden, sobre este libro (el de antes de la
   * transacción), sin simularla: la lista de sus motivos, cada uno con el
   * nombre de su condición. Una condición `soloSiValida` se salta si ya hay
   * algún motivo.
   */
  async evaluar(tx, condiciones = [], contexto = {}) {
    const motivos = [];
    for (const c of condiciones) {
      const evaluar = typeof c === 'function' ? c : c.evaluar;
      if (c.soloSiValida && motivos.length) continue;
      let r = evaluar(tx, this, contexto);
      if (r && typeof r.then === 'function') r = await r;
      motivos.push(...motivosDe(r, c.nombre ?? evaluar.name ?? null));
    }
    return motivos;
  }

  /**
   * Evalúa las condiciones y simula la transacción, sin tocar el libro.
   * Devuelve { motivos, simulacion }: `motivos` son los de las condiciones
   * que miran la transacción entera, en el orden de las condiciones, y
   * después los de cada paso, en el orden de los pasos: el de la condición
   * que lo rechazó (un motivo con `paso`; ese paso no se simula) o el fallo
   * aritmético de la simulación (con `fallo`).
   *
   * Una condición es una función (tx, libroAntes, contexto) → null | motivo
   * (texto, objeto { texto, … } o lista), o un objeto { nombre, evaluar,
   * soloSiValida }; `soloSiValida` la salta si ya hay algún motivo. Puede ser
   * asíncrona.
   */
  async probar(tx, condiciones = [], contexto = {}) {
    const deTx = [];
    const porPaso = new Map();
    for (const m of await this.evaluar(tx, condiciones, contexto)) {
      if (Number.isInteger(m.paso)) { if (!porPaso.has(m.paso)) porPaso.set(m.paso, m); }
      else deTx.push(m);
    }
    const simulacion = this.simular();
    for (const t of tx.abre ?? []) simulacion.abrir(t);
    const deLosPasos = [];
    pasos(tx).forEach((paso, j) => {
      if (porPaso.has(j)) { deLosPasos.push(porPaso.get(j)); return; }
      const fallo = simulacion.paso(paso, j);
      if (fallo) deLosPasos.push({ texto: fallo.texto, paso: j, fallo });
    });
    return { motivos: [...deTx, ...deLosPasos], simulacion };
  }

  /**
   * Aplica la transacción entera o nada: evalúa las condiciones (sobre el
   * libro de antes) y la simula; si no hay motivos, la asienta. Devuelve
   * { ok, motivos }.
   */
  async aplicar(tx, condiciones = [], contexto = {}) {
    const { motivos, simulacion } = await this.probar(tx, condiciones, contexto);
    if (motivos.length) return { ok: false, motivos };
    this.#confirmar(tx, simulacion);
    return { ok: true, motivos: [] };
  }

  /**
   * Asienta una transacción ya validada, sin condiciones (al reconstruir un
   * libro desde sus transacciones). Con `simulacion` (la de probar, si el
   * libro no ha cambiado desde entonces) no la vuelve a simular. Lanza si la
   * aritmética falla: nada cambia. Devuelve los asientos.
   */
  asentar(tx, simulacion) {
    let s = simulacion;
    if (!s || s.version !== this.#version) {
      s = this.simular();
      for (const t of tx.abre ?? []) s.abrir(t);
      pasos(tx).forEach((paso, j) => {
        const fallo = s.paso(paso, j);
        if (fallo) throw new Error('transacción rechazada por el libro: paso ' + j + ': ' + fallo.texto);
      });
    }
    return this.#confirmar(tx, s);
  }

  #confirmar(tx, s) {
    const n = this.#transacciones.length;
    this.#transacciones.push(tx);
    this.#version++;
    for (const t of s.cuentas) this.#abrir(t, tx);
    for (const [titular, serie, v] of s.disponible.values()) {
      this.#abrir(titular, tx);
      this.#disponible.get(titular).set(serie, v);
    }
    for (const [titular, serie, salida, v] of s.bloqueado.values()) {
      if (!this.#bloqueado.has(titular)) this.#bloqueado.set(titular, new Map());
      const porSerie = this.#bloqueado.get(titular);
      if (!porSerie.has(serie)) porSerie.set(serie, new Map());
      porSerie.get(serie).set(salida, v);
      if (!this.#porSalida.has(salida)) this.#porSalida.set(salida, new Map());
      const porSerieS = this.#porSalida.get(salida);
      if (!porSerieS.has(serie)) porSerieS.set(serie, new Map());
      porSerieS.get(serie).set(titular, v);
    }
    const sobre = tx.ancla?.sobre ?? null;
    const asientos = s.asientos.map((a) => {
      const asiento = Object.freeze({ ...a, n, tx, sobre });
      const i = this.#diario.length;
      this.#diario.push(asiento);
      if (sobre !== null) {
        if (!this.#porSobre.has(sobre)) this.#porSobre.set(sobre, []);
        this.#porSobre.get(sobre).push(i);
      }
      for (const k of llavesDeSuma(asiento)) this.#sumas.set(k, (this.#sumas.get(k) ?? 0) + asiento.cantidad);
      return asiento;
    });
    return asientos;
  }

  #abrir(titular, tx) {
    if (this.#disponible.has(titular)) return;
    this.#disponible.set(titular, new Map());
    this.#altas.set(titular, tx);
  }
}
