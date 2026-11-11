// Lista las claves de traducción que la carta pide al núcleo (contrato.texto) y que no tienen texto en un idioma
// (por defecto «es») en epoch.9.4. Todo lo que la carta enseña de la época (nombres de plantillas y de acciones, etiquetas,
// ayudas y mensajes de los parámetros, niveles, órdenes, tamaños, formatos de legible y textos de la guía) pasa por una
// clave; si falta en el idioma, la carta lo enseña en inglés. Desde la raíz del repositorio:
//
//   node docs/sin-traducir.mjs          las claves sin traducir al español (sale con código 1 si hay alguna)
//   node docs/sin-traducir.mjs fr       lo mismo para otro idioma
//
// La prueba test/traducciones.test.js exige cero.
// Lo que la carta enseña sin pasar por una clave porque la época ya lo trae en español (los nombres de las diez
// posiciones de epoch.5, las escalas de T de epoch.1.3, los hitos de las bases, los pasos de epoch.9.8) no se pide aquí.

import { pathToFileURL } from 'node:url';
import { EPOCA_0_BTML } from '../src/epocas.js';
import * as contrato from '../src/contrato.js';
import * as acciones from '../src/acciones.js';
import { ARIDAD } from '../src/btml.js';
import { nombreDeRegla } from '../src/bqlm.js';

const hojas = (x) => (x === undefined || x === null ? [] : Array.isArray(x) ? x : [x]);
const cadenas = (x) => hojas(x).filter((h) => typeof h === 'string');
const K = contrato.claves;
/** Los formatos «legible <qué>» que contrato.legible y contrato.desdeLegible piden (src/contrato.js, sección 9). */
const LEGIBLE = ['price', 'amount', 'record', 'series E', 'series P', 'series P view', 'series R', 'series T', 'not a number', 'not an instant', 'unknown identity', 'unknown record', 'does not satisfy'];

/**
 * Todo lo que la carta pide por clave en esta época: [{ clave, tipo, de }] sin repetir (`de`: la plantilla, el nivel…
 * de donde sale), con el texto canónico (inglés) que se vería sin traducción en `original`.
 */
export function clavesPedidas(opciones = {}) {
  const epoca = opciones.epoca ?? EPOCA_0_BTML;
  const fuera = new Map();
  const pide = (clave, tipo, de, original) => { if (!fuera.has(clave)) fuera.set(clave, { clave, tipo, de, original }); };

  // Las plantillas de transacción (las acciones del aro): su nombre, el de cada parámetro (etiqueta y ayuda) y su mensaje.
  for (const { nombre, plantilla } of acciones.plantillasDeTransaccion({ epoca })) {
    pide(K.plantilla(nombre), 'acción', nombre, nombre);
    for (const p of acciones.parametros(plantilla, { epoca })) {
      pide(K.parametro(nombre, p.nombre, 'label'), 'parámetro de acción', nombre, p.nombre);
      pide(K.parametro(nombre, p.nombre, 'help'), 'parámetro de acción', nombre, p.ayuda);
    }
    pide(K.mensaje(nombre), 'mensaje de acción', nombre, cadenas(plantilla[9]).at(-1) ?? nombre);
  }

  // Las plantillas de datos (la compra, la reserva, las preferencias, los ajustes de la guía…): su nombre y sus posiciones.
  for (const { nombre, registro } of contrato.plantillas(null, { epoca })) {
    pide(K.plantilla(nombre), 'plantilla', nombre, nombre);
    for (let d = 0; d < ARIDAD; d++) {
      const desc = registro[d];
      if (!Array.isArray(desc) || !Array.isArray(desc[0])) continue;
      const etiqueta = cadenas(desc[0])[0];
      if (etiqueta === undefined) continue;
      pide(K.parametro(nombre, etiqueta, 'label'), 'posición de plantilla', nombre, etiqueta);
      const nueve = cadenas(desc[9]);
      if (nueve.length) pide(K.parametro(nombre, etiqueta, 'help'), 'posición de plantilla', nombre, nueve.at(-1));
      if (nueve.length > 1) pide(K.parametro(nombre, etiqueta, 'placeholder'), 'posición de plantilla', nombre, nueve.slice(0, -1).join(' · '));
      // Los niveles propios de la plantilla (su 8.8): los estados de una compra, de una reserva…
      if (d === 8 && Array.isArray(desc[8])) for (const n of cadenas(desc[8])) pide(K.nivel(n), 'estado', nombre, n);
    }
  }

  // Los valores de las preferencias que son una enumeración (los interruptores de la barra, #25: sobrio, propio, todo): «template preferences param <clave> option <valor>».
  const preferencias = contrato.nombreDePlantilla(epoca.registro?.[9]?.[3]);
  for (const c of contrato.clavesDeConfiguracion({ epoca })) if (c.valores?.length >= 2) for (const v of c.valores) pide(K.parametro(preferencias, c.clave, 'option ' + v), 'opción de preferencia', preferencias, v);

  // Las plantillas de cerrado (el criterio por defecto de un registro).
  for (const c of hojas(epoca.registro?.[9]?.[0]?.[1]?.[1]).filter(Array.isArray)) {
    const nombre = cadenas(c[0])[0];
    if (nombre) pide(K.plantilla(nombre), 'plantilla de cerrado', nombre, nombre);
  }

  for (const n of contrato.niveles({ epoca })) pide(K.nivel(n), 'nivel de madurez', 'epoch.8.4', n);
  for (const o of contrato.ordenes({ epoca })) pide(K.orden(o.nombre), 'orden', 'epoch.8.5', o.nombre);
  for (const t of contrato.tamanos({ epoca })) pide(K.tamano(t.nombre), 'tamaño', 'epoch.9.5', t.nombre);
  for (const q of LEGIBLE) pide(K.legible(q), 'formato legible', 'legible', q);

  // Los motivos con que una acción rechaza antes de llegar al libro (src/acciones.js): «reason <qué>».
  for (const q of contrato.MOTIVOS) pide(K.motivo(q), 'motivo (acción)', 'src/acciones.js', q);

  // Los motivos: el mensaje de cada regla de la época (su 9, canónico en inglés), con el nombre de la regla por clave (contrato.mensaje).
  for (const { regla } of epoca.reglasConId ?? []) {
    const nombre = nombreDeRegla(regla);
    const mensaje = cadenas(regla[9]).at(-1);
    if (nombre && mensaje !== undefined) pide(nombre, 'motivo (regla)', nombre, mensaje);
  }

  // La guía del PV9: su papel, resumen, normas, respuesta y preguntas.
  const g = contrato.guia(null, 'en', { epoca });
  if (g) {
    for (const [clave, original] of [['guide role', g.papel], ['guide summary', g.resumen], ['guide rules', g.normas], ['guide answer', g.respuesta]]) pide(clave, 'guía', 'epoch.9.9', original);
    g.preguntas.forEach((q, k) => pide('guide question ' + (k + 1), 'guía', 'epoch.9.9', q));
  }
  return [...fuera.values()];
}

/** Las claves de un idioma en epoch.9.4: Set de claves. */
export function clavesDelIdioma(idioma, opciones = {}) {
  const epoca = opciones.epoca ?? EPOCA_0_BTML;
  const registros = hojas(epoca.registro?.[9]?.[4]).slice(1).filter(Array.isArray).filter((r) => hojas(r[0]).includes(idioma));
  const claves = new Set();
  for (const r of registros) for (const h of hojas(r[1])) { const i = typeof h === 'string' ? h.indexOf(': ') : -1; if (i > 0) claves.add(h.slice(0, i)); }
  return claves;
}

/** Las claves que la carta pide y que el idioma no traduce: [{ clave, tipo, de, original }]. */
export function sinTraducir(idioma = 'es', opciones = {}) {
  const tiene = clavesDelIdioma(idioma, opciones);
  return clavesPedidas(opciones).filter((c) => !tiene.has(c.clave));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const idioma = process.argv[2] ?? 'es';
  const pedidas = clavesPedidas();
  const faltan = sinTraducir(idioma);
  const porTipo = {};
  for (const f of faltan) (porTipo[f.tipo] ??= []).push(f);
  for (const [tipo, lista] of Object.entries(porTipo)) {
    console.log(`${tipo} (${lista.length})`);
    for (const f of lista) console.log('  ' + f.clave + '  ←  ' + JSON.stringify(f.original));
  }
  console.log(`${faltan.length} claves sin traducir al «${idioma}» de ${pedidas.length} que pide la carta`);
  process.exitCode = faltan.length ? 1 : 0;
}
