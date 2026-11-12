// El sobre Nostr de un evento AGRAM (contrato §1, acordado con Core AGRAM el 12-11):
//
//   kind 7700 · content = el evento AGRAM tal cual (JSON) · etiquetas:
//     g  el id AGRAM            s  el «sobre» (si no es null)
//     p  la clave de cada destinatario de un movimiento (resuelta por su alta), sin el autor
//     h  el eje                 u  el autor AGRAM (su nombre de alta), para filtrar por autor
//
// Lo firma el propio autor con su clave mientras viva en el navegador; el servicio HTTP,
// que no tiene esa clave, lo firma con la clave de transporte del eje (ver LEEME).

import { firmar, valores } from './nostr.js';
import { KIND_EVENTO } from './rele.js';

/** Los nombres de los destinatarios de los movimientos de un evento (sin el autor ni null), sin repetir. */
export function destinatarios(evento) {
  const nombres = new Set();
  for (const m of evento.movimientos ?? []) if (typeof m?.a === 'string' && m.a && m.a !== evento.autor) nombres.add(m.a);
  return [...nombres];
}

/**
 * Envuelve un evento AGRAM en un 7700 firmado con `privada`.
 * @param {object} o
 * @param {object} o.evento      el evento AGRAM, tal como se guarda
 * @param {string} o.eje         el nombre del eje
 * @param {string} o.privada     la clave que firma el sobre (la del autor, o la de transporte)
 * @param {(nombre: string) => Promise<string|undefined>} [o.claveDe]  nombre de alta → clave x-only
 * @param {Date} [o.ahora]
 */
export async function envolver({ evento, eje, privada, claveDe = async () => undefined, ahora = new Date() }) {
  const tags = [['g', evento.id]];
  if (evento.sobre) tags.push(['s', evento.sobre]);
  for (const nombre of destinatarios(evento)) {
    const clave = await claveDe(nombre);
    if (clave) tags.push(['p', clave]);
  }
  tags.push(['h', eje], ['u', evento.autor]);
  return firmar({ kind: KIND_EVENTO, created_at: Math.floor(ahora.getTime() / 1000), tags, content: JSON.stringify(evento) }, privada);
}

/** El evento AGRAM de un 7700; lanza si el content no es JSON o si no casa con su etiqueta g. */
export function desenvolver(sobre) {
  const evento = JSON.parse(sobre.content);
  if (valores(sobre, 'g')[0] !== evento.id) throw new Error('el id AGRAM no casa con la etiqueta g');
  return evento;
}
