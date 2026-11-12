// B19 · El recibo único de las tres casas (aprobado por VG, 12-11). Lo usan StateArk (pagos, sellos,
// envíos por canal, rotaciones de clave), AARPIA (llegada 7701, aceptación y rechazo 7703, lo hecho fuera)
// y AGRAM (el «recibo de lo hecho fuera» que enciende la estación «ejecutado»).
//
// Un recibo dice lo que AFIRMA, lo que NO afirma, sobre qué SUJETO y con qué EVIDENCIA se comprueba. Es un
// sobre firmado como un evento de AGRAM:
//
//   { schema: 'stateark.recibo@1', emisor, t, recibo: <décupla BTML>, id, firma, sello?, evento? }
//   id    = SHA-256(canonico({ schema, emisor, t, recibo }))      (el canonico de AGRAM)
//   firma = BIP-340 del emisor sobre los 32 bytes del id          (fuera del hash, como en AGRAM)
//   sello = prueba de sello de tiempo del id (§3), si la hay      (fuera del hash: se añade después)
//   evento = el evento al que se refiere, si se anexa (p. ej. el rechazado en un 7703; fuera del hash:
//            no hace falta firmarlo, porque su id es el sujeto y quien verifica lo recalcula)
//
// La décupla: SIN HUECOS, SIN RELLENO Y SIN TUPLAS (VG, 12-11 y 13-11). Posiciones seguidas desde el 0,
// todas con contenido. Lo nombrado va en dos décuplas hermanas, CLAVES y VALORES, en el mismo orden y solo
// con lo que existe; lo opcional que no es nombrado va al final.
//   0  ['recibo', <clase>]
//   1  el sujeto: lista de ids (el evento, el txid, la clave…)
//   2  las CLAVES, en este orden: las propias de la clase («evento», «sucesora», «destino»…), «universo»
//      (siempre) y, solo si existen, «cuánto», «causa» (una vez por causa), «núcleo» y «época»; y al final
//      «no afirma», una vez por cada cosa que el recibo NO afirma (al menos una)
//   3  los VALORES, en el mismo orden (todos texto; «cuánto» como «61000 sat», que AGRAM despliega como D-VALOR)
//   4  la evidencia, si la clase la lleva, SIEMPRE como décupla (en un pago: [[transacción cruda], [cabecera],
//      lados, hermanos del camino de Merkle «bitcoin» si lo hay]; cada hoja suelta entre corchetes, o sería una
//      lista sin posiciones). Si no hay, el recibo acaba en el 3.

import { esId, sha256Texto } from './hash.js';
import { canonico } from './canon.js';
import { esquemaSimulado } from './custodia.js';

export const ESQUEMA_RECIBO_COMUN = 'stateark.recibo@1';
export const CLASES_DE_RECIBO = Object.freeze([
  'llegada', 'aceptación', 'rechazo', 'efecto', // AARPIA
  'pago', 'cobro', 'sello', 'envío', 'rotación', // StateArk
]);
/** Claves que tienen nombre propio en el recibo (no se pasan en `ata`). */
const RESERVADOS = Object.freeze(['universo', 'cuánto', 'causa', 'núcleo', 'época', 'no afirma']);

export class ErrorRecibo extends Error {}
const error = (m) => new ErrorRecibo(m);
const texto = (x) => typeof x === 'string' && x.length > 0;

const lista = (x, nombre) => {
  if (!Array.isArray(x) || x.length === 0) throw error(`${nombre}: una lista con al menos un elemento`);
  return x;
};

/** La décupla del recibo a partir de sus campos. Lanza si falta algo obligatorio. */
export function decuplaDeRecibo({ clase, sujeto, ata = [], cuanto, causa, universo, nucleo, epoca, noAfirma, evidencia }) {
  if (!CLASES_DE_RECIBO.includes(clase)) throw error(`clase «${clase}»; las que hay: ${CLASES_DE_RECIBO.join(', ')}`);
  for (const s of lista(sujeto, 'sujeto')) if (!texto(s)) throw error('sujeto: ids como texto');
  if (!Array.isArray(ata)) throw error('a qué se ata: una lista de pares');
  for (const p of ata) {
    if (!Array.isArray(p) || p.length !== 2 || !p.every(texto)) throw error('a qué se ata: pares [campo, valor] de texto');
    if (RESERVADOS.includes(p[0])) throw error(`«${p[0]}» tiene su propio campo en el recibo`);
  }
  if (!texto(universo)) throw error('universo: dónde vale el recibo');
  for (const t of lista(noAfirma, 'lo que NO afirma')) if (!texto(t)) throw error('lo que NO afirma: textos');
  const causas = causa === undefined ? [] : Array.isArray(causa) ? causa : [causa];
  if (causa !== undefined && (!causas.length || !causas.every(texto))) throw error('la causa es un texto o una lista de textos');
  if (clase === 'rechazo' && !causas.length) throw error('un rechazo lleva su causa');
  if (cuanto !== undefined && (!Array.isArray(cuanto) || cuanto.length !== 2 || !cuanto.every((v) => texto(String(v))))) throw error('cuánto: [valor, unidad]');
  for (const [n, v] of [['núcleo', nucleo], ['época', epoca]]) if (v !== undefined && !texto(v)) throw error(`${n}: un texto`);
  if (evidencia !== undefined && (!Array.isArray(evidencia) || evidencia.length === 0)) throw error('evidencia: una décupla o lista no vacía');

  const pares = [
    ...ata,
    ['universo', universo],
    ...(cuanto ? [['cuánto', `${cuanto[0]} ${cuanto[1]}`]] : []),
    ...causas.map((c) => ['causa', c]),
    ...(nucleo ? [['núcleo', nucleo]] : []),
    ...(epoca ? [['época', epoca]] : []),
    ...noAfirma.map((t) => ['no afirma', t]),
  ];
  const d = [['recibo', clase], [...sujeto], pares.map(([c]) => c), pares.map(([, v]) => v)];
  if (evidencia) d.push(structuredClone(evidencia));
  return d;
}

/** Los campos legibles de una décupla de recibo (lo contrario de decuplaDeRecibo). */
export function camposDeRecibo(d) {
  if (!Array.isArray(d) || d.length < 4 || d.length > 5) throw error('un recibo tiene de 4 a 5 posiciones');
  if (!Array.isArray(d[2]) || !Array.isArray(d[3]) || d[2].length !== d[3].length) throw error('claves y valores, en paralelo y del mismo largo');
  const pares = d[2].map((c, i) => [c, d[3][i]]);
  const uno = (n) => pares.find(([c]) => c === n)?.[1];
  const causas = pares.filter(([c]) => c === 'causa').map(([, v]) => v);
  const cuanto = uno('cuánto');
  const i = cuanto?.lastIndexOf(' ') ?? -1;
  return {
    clase: d[0][1],
    sujeto: d[1],
    ata: pares.filter(([c]) => !RESERVADOS.includes(c)),
    universo: uno('universo'),
    cuanto: cuanto === undefined ? undefined : [cuanto.slice(0, i), cuanto.slice(i + 1)],
    causa: causas.length === 0 ? undefined : causas.length === 1 ? causas[0] : causas,
    nucleo: uno('núcleo'),
    epoca: uno('época'),
    noAfirma: pares.filter(([c]) => c === 'no afirma').map(([, v]) => v),
    evidencia: d[4],
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
    if (canonico(decuplaDeRecibo(campos)) !== canonico(r.recibo)) throw error('la décupla no es la que dan sus campos');
  } catch (e) {
    return { ok: false, motivo: `forma: ${e.message}` };
  }
  if ((await idDeRecibo(r)) !== r.id) return { ok: false, motivo: 'el id no es el de su cuerpo' };
  if (!(await esquema.verificar(r.firma, r.id, r.emisor))) return { ok: false, motivo: 'la firma del emisor no verifica' };
  return { ok: true, motivo: 'recibo válido', id: r.id, emisor: r.emisor, ...campos };
}
