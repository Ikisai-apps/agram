// Los servicios de fuera (docs/CONTRATO.md §16.2 bis, decisión #58 de VG): dónde viaja el libro (relé: eventos y recibo de
// llegada), dónde están los archivos (Blossom) y dónde se sella (StateArk). Son los ajustes de una plantilla de la época,
// «exterior settings», como «guide settings»: un registro más anclado en el 9 del alta por su dueño. Elegir Supabase o la
// simulación (servidor/sim/) es solo configuración: sin `relay url` los eventos y el recibo van por `sync url` de las
// preferencias (el mismo eje, la misma clave de lectura); sin `blossom url`, los archivos también; sin `seal url`, nada se
// sella. El nombre de la plantilla y de sus claves se leen aquí, no en src/contrato.js (que no lleva ninguna palabra de la
// época); sus etiquetas y ayudas, en es y en, son datos de la época.
//
//   AJUSTES                    { plantilla, relevo, archivos, sello }: el nombre de la plantilla y las claves de sus posiciones 1-3
//   exterior(eje, yo)          → { relevo, archivos, sello }: cada url (http o https, sin la barra final) o null

import { configuracionDe } from './contrato.js';

/** El nombre de la plantilla de los ajustes del exterior y las claves de sus posiciones: el nombre y las etiquetas son de la época; las posiciones 1-3 (4, reservada a los pagos) son el contrato. */
export const AJUSTES = Object.freeze({ plantilla: 'exterior settings', relevo: 'relay url', archivos: 'blossom url', sello: 'seal url' });

/** Una url http o https sin la barra final, o null si está vacía o no es una url. */
export function url(x) {
  const v = Array.isArray(x) ? x.find((h) => typeof h === 'string') : x;
  if (typeof v !== 'string' || !v.trim()) return null;
  try {
    if (!/^https?:$/.test(new URL(v.trim()).protocol)) return null;
  } catch {
    return null;
  }
  return v.trim().replace(/\/+$/, '');
}

/**
 * Dónde están los servicios de fuera de `quien`, según su registro «exterior settings» (el último, anclado en el 9 de su
 * alta): { relevo, archivos, sello }, cada uno la url o null si no la ha dicho o no es una url.
 */
export function exterior(eje, quien, opciones = {}) {
  const c = configuracionDe(eje, quien, AJUSTES.plantilla, opciones);
  return { relevo: url(c[AJUSTES.relevo]), archivos: url(c[AJUSTES.archivos]), sello: url(c[AJUSTES.sello]) };
}
