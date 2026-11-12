// stateark-sim: StateArk fingido para que AGRAM funcione hoy «como si» StateArk existiera. SIMULADO:
// nada de esto toca Bitcoin.
//
//   §3 sello de tiempo:  import { sellar, prueba, verificar, minar } from './src/index.js';
//   §5 pagos y fondos:   import { crearCartera, direccion, acunar, preparar, autorizar, ejecutar,
//                                 recibo, verificarRecibo, verificarFondos } from './src/index.js';
//
// Las funciones sueltas usan una simulación por defecto, en memoria. §3 y §5 comparten la cadena:
// `minar()` mete en el mismo bloque los lotes por sellar y los pagos por confirmar. Para varias
// simulaciones independientes, usa `crearSimulacion`.

import { Sellador } from './sello.js';
import { Carril } from './pagos.js';

export { Sellador, VIA, selloComoDecupla } from './sello.js';
export { Cadena, RED, leerCabecera, aplicarOts, raizMerkleBitcoin, alturaLe } from './cadena.js';
export { esId } from './hash.js';
export { Carril, RechazoPago, firmaSimulada, mensajeAutorizacion, nuevoSecreto, hashDePreimagen, USO, UNIVERSO } from './pagos.js';

export { profundidad, madurez, CONFIRMACIONES_POR_DEFECTO } from './madurez.js';
export { politicaCandado, salidaTaproot, NUMS, numero, pk, vpk, sha256Frag, hash160Frag, after, older, andV, multiA, hoja, rama, ErrorMiniscript } from './miniscript.js';
export { ESQUEMA_RECIBO_COMUN, SIN_USO, CLASES_DE_RECIBO, ErrorRecibo, decuplaDeRecibo, camposDeRecibo, idDeRecibo, sobreDeRecibo, verificarReciboComun } from './recibo.js';
export { ESQUEMA_EQUIVOCACION, CLASES_DE_EQUIVOCACION, ErrorEquivocacion, claseDe, construirEquivocacion, verificarEquivocacion } from './equivocacion.js';
export { verificarObservacion, USO_OBSERVADOR } from './custodia.js';
export { Custodia, RechazoCustodia, esquemaSimulado, esquemaNoble, verificarVinculo, mensajeVinculo, verificarSesion, firmaDeWebhook, DOMINIOS, USO_VINCULO, USO_SESION, TIPOS_DE_CANAL } from './custodia.js';

export const SIMULADO = true;

export class Simulacion {
  constructor(sellador, opciones = {}) {
    this.sellador = sellador;
    this.carril = new Carril(sellador, opciones);
  }

  /**
   * @param {object} [opciones] { inicio, intervalo, reloj } de la cadena (cadena.js) y
   *        { verificarFirma } del carril (pagos.js)
   */
  static async crear(opciones = {}) {
    return new Simulacion(await Sellador.crear(opciones), opciones);
  }

  get cadena() {
    return this.sellador.cadena;
  }

  /** Mina un bloque con los lotes pendientes del §3 y los pagos pendientes del §5. */
  async minar() {
    const txids = this.carril.pendientes.splice(0);
    const b = await this.sellador.minar(txids);
    this.carril.confirmar(txids, b.altura);
    return { ...b, pagos: txids.length };
  }
}

export function crearSimulacion(opciones) {
  return Simulacion.crear(opciones);
}

/** Compatibilidad con la primera entrega (§3 solo): un sellador independiente con su propia cadena. */
export function crearSellador(opciones) {
  return Sellador.crear(opciones);
}

let porDefecto = null;
async function sim() {
  porDefecto ??= Simulacion.crear();
  return porDefecto;
}

// §3
export async function sellar(ids) { return (await sim()).sellador.sellar(ids); }
export async function prueba(id) { return (await sim()).sellador.prueba(id); }
export async function verificar(evento, p) { return (await sim()).sellador.verificar(evento, p); }

/** Solo en la simulación: mete lo pendiente (§3 y §5) en un bloque nuevo. */
export async function minar() { return (await sim()).minar(); }

// §5
export async function crearCartera(nombre, opciones) { return (await sim()).carril.crearCartera(nombre, opciones); }
export async function direccion(nombre) { return (await sim()).carril.direccion(nombre); }
export async function acunar(dir, sat) { return (await sim()).carril.acunar(dir, sat); }
export async function saldo(nombre) { return (await sim()).carril.saldo(nombre); }
export async function preparar(nombre, instruccion) { return (await sim()).carril.preparar(nombre, instruccion); }
export async function autorizar(plan, firma) { return (await sim()).carril.autorizar(plan, firma); }
export async function ejecutar(nombre, instruccion, plan, autorizacion) { return (await sim()).carril.ejecutar(nombre, instruccion, plan, autorizacion); }
export async function recibo(txid) { return (await sim()).carril.recibo(txid); }
export async function verificarRecibo(r, opciones) { return (await sim()).carril.verificarRecibo(r, opciones); }
export async function verificarFondos(serie, r) { return (await sim()).carril.verificarFondos(serie, r); }
export async function fondosDeSerie(nombre, serie) { return (await sim()).carril.fondosDeSerie(nombre, serie); }

// §8 (la pata de pago; la salida por hash en AGRAM es su #55)
export async function reclamar(nombre, hash, preimagen) { return (await sim()).carril.reclamar(nombre, hash, preimagen); }
export async function reembolsar(nombre, hash) { return (await sim()).carril.reembolsar(nombre, hash); }
export async function preimagenDe(hash) { return (await sim()).carril.preimagenDe(hash); }
export async function reciboCandado(hash) { return (await sim()).carril.reciboCandado(hash); }
export async function verificarCandado(rc) { return (await sim()).carril.verificarCandado(rc); }
