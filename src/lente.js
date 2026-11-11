// R según el corpus y la lente del lector (encargo 3b; VG, 9-11, mapa §15 [D] «R según el corpus, confirmado» y
// «R, últimas dos»; §16 [D] «PV3 = regla de atención»).
//
// R es crédito de atención específico de su emisor: no es fungible entre emisores ni es reputación global. Se emite
// libremente por su emisor, sin colateral (se retira el colateral de la #75: el respaldo es la obligación de atender,
// como la deuda de E); se transfiere libremente entre tenedores sin cambiar de emisor (se corrige la #62, que solo
// dejaba devolverla); se liquida devolviéndola a su emisor, que es pedirle atención; el emisor atiende según su PV2
// (por defecto, un registro suyo anclado sobre la petición, con T real: la lectura «attended» de la época); y el
// tenedor puede perdonar la deuda quemándola. Nada castiga solo: la lente del lector aprende. Todo eso son reglas de
// la época (datos/epocas/reglas/): aquí solo hay LECTURAS para la interfaz y BQL V0, que leen las mismas posiciones.
//
// La lente: el valor de la R de alguien para un tercero solo existe con la lente del lector, y cada unidad cuenta
// una (se retira la valoración por participación de la #75). La lente de R y las condiciones de aceptación son la
// misma cosa (§16): «aceptar tu R como pago es darte peso». La lente de un lector son los grupos de su PV3 (A.3, la
// vista de src/contexto-eje.js) cuyo precio es la R de quien escribe («their R»): los emisores que nombra ahí pesan
// 1; los demás, 0. Una identidad nueva que se autoemite mucha R no vale nada para quien no la nombra, y N identidades
// falsas que se emiten R entre sí no cambian el valor que un lector da a nadie.

import { evaluar, leerRegla } from './bqlm.js';
import { esPresente } from './evento.js';
import { ContextoEje } from './contexto-eje.js';
import { EPOCA_0_BTML } from './epocas.js';

/** Clave de la serie R de un emisor. */
export function claveR(emisor) {
  return 'R:' + emisor;
}

/** El precio de un grupo que hace de lente: aceptar como pago la R de quien escribe (mapa §16 [D]). */
export const PRECIO_LENTE = 'their R';

const contexto = (eje) => new ContextoEje(eje, { epoch: EPOCA_0_BTML });
const comillas = (x) => JSON.stringify(String(x));

/**
 * La lente de `lector`: { lector, pesos: Map(emisor → 1), grupos: [zonas] }, los emisores cuyos grupos de atención
 * (A.3) cobran con su R; null si el lector no tiene alta. Se lee con el BQL mínimo: la misma vista que la regla
 * «attention has a price».
 */
export function lenteDe(eje, lector) {
  if (!eje.alta(lector)) return null;
  const ctx = contexto(eje);
  const cobran = '(' + comillas(lector) + ').3 where last it.2.0 = ' + comillas(PRECIO_LENTE);
  const zonas = evaluar('(' + cobran + ') each 1', ctx);
  const quienes = evaluar('(' + cobran + ') each 3', ctx);
  const pesos = new Map();
  if (quienes.estado === 'RESUELTO') for (const q of quienes.valor) if (typeof q === 'string' && q !== lector) pesos.set(q, 1);
  return { lector, pesos, grupos: zonas.estado === 'RESUELTO' ? zonas.valor : [] };
}

/** Peso que `lector` da a `emisor`: 1 si acepta su R como pago, 0 si no, null si el lector no tiene alta. */
export function peso(eje, lector, emisor) {
  const l = lenteDe(eje, lector);
  return l ? l.pesos.get(emisor) ?? 0 : null;
}

/**
 * El valor de la R que tiene `titular`, visto con la lente de `lector`: { valor, porEmisor: [{ emisor, peso,
 * saldo, aporte }] }, por unidad (cada unidad de R cuenta una), solo de los emisores que la lente nombra y distintos
 * del titular (su propia R no es que otro responda por él); null si el lector no tiene lente.
 */
export function detalleValor(eje, lector, titular) {
  const l = lenteDe(eje, lector);
  if (!l) return null;
  let valor = 0;
  const porEmisor = [];
  for (const [emisor, p] of l.pesos) {
    if (!(p > 0) || emisor === titular) continue;
    const k = claveR(emisor);
    const saldo = eje.saldo(titular, k) + eje.bloqueado(titular, k);
    if (!(saldo > 0)) continue;
    valor += p * saldo;
    porEmisor.push({ emisor, peso: p, saldo, aporte: p * saldo });
  }
  return { valor, porEmisor };
}

/** valor(eje, lector, titular): Σ peso × unidades sobre los emisores de la lente; null sin lente. */
export function valor(eje, lector, titular) {
  return detalleValor(eje, lector, titular)?.valor ?? null;
}

/**
 * Las peticiones de atención a `emisor`: los registros que le devuelven su R (una transferencia de R:<emisor> de un
 * tenedor a su emisor), en orden, [{ id, de, cantidad, atencion }], con `atencion` = el primer registro del emisor
 * anclado sobre la petición que la atiende según la lectura «attended» de la época (con T real), o null.
 */
export function devoluciones(eje, emisor) {
  const k = claveR(emisor);
  const lectura = EPOCA_0_BTML.lecturas.find((r) => r[0][0] === 'attended');
  const ctx = contexto(eje);
  const fuera = [];
  for (const id of eje.orden) {
    const ev = eje.obtener(id);
    const vuelven = (ev.movimientos ?? []).filter((m) => m && m.token === 'R' && m.emisor === emisor && m.a === emisor && m.de !== null && m.de !== emisor && m.estado === undefined);
    if (!vuelven.length) continue;
    const atendida = lectura ? leerRegla(lectura, { k: 'reg', id }, ctx) : null;
    const atiende = atendida?.estado === 'RESUELTO' && atendida.valor[0] === true
      ? eje.sobre(id).find((h) => h.autor === emisor && esPresente(h))?.id ?? null
      : null;
    fuera.push({ id, clave: k, de: vuelven[0].de, cantidad: vuelven.reduce((s, m) => s + m.cantidad, 0), atencion: atiende });
  }
  return fuera;
}

/** Ids de las peticiones de atención a `emisor` sin atender. */
export function pendientes(eje, emisor) {
  return devoluciones(eje, emisor).filter((d) => d.atencion === null).map((d) => d.id);
}

/**
 * El estado de un registro como paquete de atención (VG, 10-11, el parque del 3: cada mensaje es un paquete): una
 * petición (devuelve R a su emisor) está «atendido» si la lectura «attended» de la época lo dice (el emisor ancló
 * sobre ella un registro suyo con T real) y «pendiente» si no; una R quemada por su tenedor (perdonar) es «perdonado»;
 * lo demás, null (un mensaje sin R no es una petición). «Rebotado» (sin pago) no existe en el libro: el motor rechaza
 * esa transacción y no queda nada que leer.
 */
export function estadoDePaquete(eje, id) {
  const ev = typeof id === 'string' ? eje?.obtener(id) : null;
  if (!ev) return null;
  const deR = (ev.movimientos ?? []).filter((m) => m && m.token === 'R' && typeof m.emisor === 'string' && m.de !== null && m.de !== m.emisor && m.estado === undefined);
  if (deR.some((m) => m.a === m.emisor)) {
    const lectura = EPOCA_0_BTML.lecturas.find((r) => r[0][0] === 'attended');
    const r = lectura ? leerRegla(lectura, { k: 'reg', id: ev.id }, contexto(eje)) : null;
    return r?.estado === 'RESUELTO' && r.valor[0] === true ? 'atendido' : 'pendiente';
  }
  if (deR.some((m) => m.a === null)) return 'perdonado';
  return null;
}
