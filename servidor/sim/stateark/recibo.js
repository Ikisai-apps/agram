// B19 · El recibo único de las tres casas (aprobado por VG, 12-11). Lo usan StateArk (pagos, sellos,
// envíos por canal, rotaciones de clave), AARPIA (llegada 7701, aceptación y rechazo 7703, lo hecho fuera)
// y AGRAM (el «recibo de lo hecho fuera» que enciende la estación «ejecutado»).
//
// Un recibo dice lo que AFIRMA, lo que NO afirma, a qué se ATA y con qué PRUEBAS se comprueba. Es un sobre
// firmado como un evento de AGRAM:
//
//   { schema: 'stateark.recibo@1', emisor, t, recibo: <décupla BTML>, id, firma, sello? }
//   id    = SHA-256(canonico({ schema, emisor, t, recibo }))      (el canonico de AGRAM)
//   firma = BIP-340 del emisor sobre los 32 bytes del id          (fuera del hash, como en AGRAM)
//   sello = prueba de sello de tiempo del id (§3), si la hay      (fuera del hash: se añade después)
//   evento = el evento al que se refiere, si se anexa (p. ej. el rechazado en un 7703; fuera del hash:
//            no hace falta firmarlo, porque su id es el sujeto 2.0 y quien verifica lo recalcula)
//
// La décupla (BTML válido: sin huecos; una posición sin uso lleva la hoja «-», la que AGRAM ya usa como vacía):
//   0  ['recibo', <clase>]
//   2  2.0 sujeto: lista de ids (el evento, el txid, la clave…)
//      2.1 a qué se ata: lista de pares [campo, valor]
//      2.2 cuánto: [valor, unidad]                          (o «-»)
//   4  4.0 la causa (en un rechazo): un texto o, si son varias, una lista de textos (mejor que unirlas con
//        saltos de línea: así BQL las lee con `in`); o «-»;  4.1 el universo (dónde vale: «bitcoin», «regtest», un relé…)
//   8  8.0 pruebas: lista de [tipo, hash, dónde buscarla]   (o «-»)
//      8.1 núcleo (commit que juzgó) o «-»;  8.2 época (id) o «-»
//   9  9.0 lo que NO afirma: lista de textos, nunca vacía
//   1, 3, 5, 6, 7: «-». Son las que el núcleo de AGRAM rellena en un registro (movimientos, autor, id, t)
//   o la del futuro; así el mismo recibo vale como payload de un registro de AGRAM sin colisionar.

import { esId, sha256Texto } from './hash.js';
import { canonico } from './canon.js';
import { esquemaSimulado } from './custodia.js';

export const ESQUEMA_RECIBO_COMUN = 'stateark.recibo@1';
export const SIN_USO = '-'; // el guion ASCII que AGRAM ya usa como posición vacía
export const CLASES_DE_RECIBO = Object.freeze([
  'llegada', 'aceptación', 'rechazo', 'efecto', // AARPIA
  'pago', 'cobro', 'sello', 'envío', 'rotación', // StateArk
]);

export class ErrorRecibo extends Error {}
const error = (m) => new ErrorRecibo(m);

const lista = (x, nombre) => {
  if (!Array.isArray(x) || x.length === 0) throw error(`${nombre}: una lista con al menos un elemento`);
  return x;
};

/** La décupla del recibo a partir de sus campos. Lanza si falta algo obligatorio. */
export function decuplaDeRecibo({ clase, sujeto, ata, cuanto, causa, universo, pruebas, nucleo, epoca, noAfirma }) {
  if (!CLASES_DE_RECIBO.includes(clase)) throw error(`clase «${clase}»; las que hay: ${CLASES_DE_RECIBO.join(', ')}`);
  for (const s of lista(sujeto, 'sujeto')) if (typeof s !== 'string' || !s) throw error('sujeto: ids como texto');
  for (const p of lista(ata, 'a qué se ata')) if (!Array.isArray(p) || p.length !== 2 || p.some((v) => typeof v !== 'string' || !v)) throw error('a qué se ata: pares [campo, valor] de texto');
  if (typeof universo !== 'string' || !universo) throw error('universo: dónde vale el recibo');
  for (const t of lista(noAfirma, 'lo que NO afirma')) if (typeof t !== 'string' || !t) throw error('lo que NO afirma: textos');
  const causaValida = (typeof causa === 'string' && causa) || (Array.isArray(causa) && causa.length && causa.every((c) => typeof c === 'string' && c));
  if (causa !== undefined && !causaValida) throw error('la causa es un texto o una lista de textos');
  if (clase === 'rechazo' && !causaValida) throw error('un rechazo lleva su causa');
  if (cuanto !== undefined && (!Array.isArray(cuanto) || cuanto.length !== 2)) throw error('cuánto: [valor, unidad]');
  if (pruebas !== undefined) for (const p of lista(pruebas, 'pruebas')) if (!Array.isArray(p) || p.length !== 3 || p.some((v) => typeof v !== 'string' || !v)) throw error('pruebas: [tipo, hash, dónde]');
  return [
    ['recibo', clase],
    SIN_USO,
    [[...sujeto], ata.map((p) => [...p]), cuanto ? [...cuanto] : SIN_USO],
    SIN_USO,
    [Array.isArray(causa) ? [...causa] : causa ?? SIN_USO, universo],
    SIN_USO,
    SIN_USO,
    SIN_USO,
    [pruebas ? pruebas.map((p) => [...p]) : SIN_USO, nucleo ?? SIN_USO, epoca ?? SIN_USO],
    [[...noAfirma]],
  ];
}

/** Los campos legibles de una décupla de recibo (lo contrario de decuplaDeRecibo). */
export function camposDeRecibo(d) {
  const v = (x) => (x === SIN_USO ? undefined : x);
  return {
    clase: d[0][1],
    sujeto: d[2][0],
    ata: d[2][1],
    cuanto: v(d[2][2]),
    causa: v(d[4][0]),
    universo: d[4][1],
    pruebas: v(d[8][0]),
    nucleo: v(d[8][1]),
    epoca: v(d[8][2]),
    noAfirma: d[9][0],
  };
}

/** El id de un sobre de recibo: SHA-256 del canónico de { schema, emisor, t, recibo }. */
export function idDeRecibo({ schema, emisor, t, recibo }) {
  return sha256Texto(canonico({ schema, emisor, t, recibo }));
}

/** Arma el sobre sin firmar (la firma la pone quien tiene la clave: `Custodia.firmarRecibo`). */
export async function sobreDeRecibo(emisor, campos, t) {
  if (!esId(emisor)) throw error('el emisor es una clave x-only');
  if (typeof t !== 'string' || Number.isNaN(Date.parse(t))) throw error('t es un instante ISO');
  const sobre = { schema: ESQUEMA_RECIBO_COMUN, emisor, t, recibo: decuplaDeRecibo(campos) };
  return { ...sobre, id: await idDeRecibo(sobre) };
}

/** Comprueba un recibo sin fiarse de nadie: forma, id recalculado y firma del emisor. */
export async function verificarReciboComun(r, { esquema = esquemaSimulado } = {}) {
  if (r?.schema !== ESQUEMA_RECIBO_COMUN) return { ok: false, motivo: 'no es un recibo stateark.recibo@1' };
  let campos;
  try {
    campos = camposDeRecibo(r.recibo);
    decuplaDeRecibo(campos); // revalida la forma
  } catch (e) {
    return { ok: false, motivo: `forma: ${e.message}` };
  }
  if ((await idDeRecibo(r)) !== r.id) return { ok: false, motivo: 'el id no es el de su cuerpo' };
  if (!(await esquema.verificar(r.firma, r.id, r.emisor))) return { ok: false, motivo: 'la firma del emisor no verifica' };
  return { ok: true, motivo: 'recibo válido', id: r.id, emisor: r.emisor, ...campos };
}
