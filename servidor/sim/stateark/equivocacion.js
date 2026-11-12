// B9 · La equivocación como prueba portable (aprobado por VG, 12-11). Viene de la evidencia de fraude de
// StateArk (S1-A, EquivocationProofV1): material público, verificable offline, con la clase DERIVADA de
// los enunciados (quien acusa no la declara) y un id estable que no depende del orden.
//
// Una equivocación es un PAR DE RECIBOS (stateark.recibo@1) firmados por el MISMO emisor que no pueden ser
// ciertos a la vez. Cualquiera la comprueba sin libro, sin relé y sin servidor: dos firmas, dos ids y un
// predicado puro.
//
//   { schema: 'stateark.equivocacion@1', clase, acusado, a, b, id }
//   id = SHA-256(canonico({ schema, clase, ids: [id menor, id mayor] }))
//
// Clases v1 (las únicas que se derivan; lo demás NO es equivocación):
//   «veredictos contradictorios»  la misma autoridad acepta y rechaza el mismo evento con el mismo núcleo
//                                  y la misma época (un 7701 de aceptación y un 7703)
//   «dos sucesoras de una clave»  la misma clave firma su rotación a dos claves distintas (B3)
//
// Lo que NO es equivocación, a propósito: dos recibos de llegada del mismo evento con instantes distintos
// (un reenvío); una aceptación y un rechazo con núcleos o épocas distintos (las reglas cambiaron); dos
// cabeceras distintas a la misma altura firmadas por el observador (puede ser una reorganización real).

import { sha256Texto } from './hash.js';
import { canonico } from './canon.js';
import { verificarReciboComun } from './recibo.js';
import { esquemaSimulado } from './custodia.js';

export const ESQUEMA_EQUIVOCACION = 'stateark.equivocacion@1';
export const CLASES_DE_EQUIVOCACION = Object.freeze(['veredictos contradictorios', 'dos sucesoras de una clave']);

export class ErrorEquivocacion extends Error {}

const valor = (campos, nombre) => campos.ata.find(([c]) => c === nombre)?.[1];

/** El predicado puro: de dos recibos ya verificados, la clase de equivocación o null. */
export function claseDe(ca, cb) {
  if (ca.emisor !== cb.emisor || ca.id === cb.id) return null;
  const clases = [ca.clase, cb.clase].sort().join('+');
  if (clases === 'aceptación+rechazo'
    && ca.sujeto[0] === cb.sujeto[0]
    && ca.nucleo && ca.nucleo === cb.nucleo
    && ca.epoca && ca.epoca === cb.epoca) return 'veredictos contradictorios';
  if (ca.clase === 'rotación' && cb.clase === 'rotación'
    && ca.sujeto[0] === cb.sujeto[0] && ca.sujeto[0] === ca.emisor
    && valor(ca, 'sucesora') && valor(cb, 'sucesora') && valor(ca, 'sucesora') !== valor(cb, 'sucesora')) return 'dos sucesoras de una clave';
  return null;
}

async function idDe(clase, a, b) {
  return sha256Texto(canonico({ schema: ESQUEMA_EQUIVOCACION, clase, ids: [a.id, b.id].sort() }));
}

/** Arma la prueba desde dos recibos. La clase se deriva; si no hay conflicto objetivo, lanza. */
export async function construirEquivocacion(a, b, { esquema = esquemaSimulado } = {}) {
  const [va, vb] = [await verificarReciboComun(a, { esquema }), await verificarReciboComun(b, { esquema })];
  if (!va.ok) throw new ErrorEquivocacion(`el primer recibo: ${va.motivo}`);
  if (!vb.ok) throw new ErrorEquivocacion(`el segundo recibo: ${vb.motivo}`);
  const clase = claseDe(va, vb);
  if (!clase) throw new ErrorEquivocacion('no hay conflicto objetivo entre estos dos recibos: no es una equivocación');
  return { schema: ESQUEMA_EQUIVOCACION, clase, acusado: a.emisor, a, b, id: await idDe(clase, a, b) };
}

/** Comprueba una prueba sin fiarse de quien la trae: las dos firmas, el predicado RECALCULADO y el id. */
export async function verificarEquivocacion(e, { esquema = esquemaSimulado } = {}) {
  if (e?.schema !== ESQUEMA_EQUIVOCACION) return { ok: false, motivo: 'no es una prueba stateark.equivocacion@1' };
  const [va, vb] = [await verificarReciboComun(e.a, { esquema }), await verificarReciboComun(e.b, { esquema })];
  if (!va.ok) return { ok: false, motivo: `el primer recibo: ${va.motivo}` };
  if (!vb.ok) return { ok: false, motivo: `el segundo recibo: ${vb.motivo}` };
  if (va.emisor !== e.acusado || vb.emisor !== e.acusado) return { ok: false, motivo: 'los recibos no son del acusado' };
  const clase = claseDe(va, vb);
  if (!clase) return { ok: false, motivo: 'no hay conflicto objetivo' };
  if (clase !== e.clase) return { ok: false, motivo: `la clase declarada no es la que se deriva (${clase})` };
  if ((await idDe(clase, e.a, e.b)) !== e.id) return { ok: false, motivo: 'el id no es el de la prueba' };
  return { ok: true, motivo: 'equivocación probada', clase, acusado: e.acusado, id: e.id };
}
