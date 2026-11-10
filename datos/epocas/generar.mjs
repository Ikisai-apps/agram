// Genera datos/epocas/epocas.js desde los JSON de esta carpeta (epoca-*.json)
// y de los registros de la época (reglas/*.json, correcciones/*.json), para
// que src/epocas.js los importe sin fetch, igual en Node que en el navegador.
// Los JSON mandan: se cambian ellos y se vuelve a generar con `npm run epocas`.
// Una prueba comprueba que epocas.js está al día.
//
// Las reglas como registros (VG, 10-11, A1: «Correcto»; encargo 3a): cada
// regla de la época es su propio registro, una décupla con las diez
// posiciones llenas, en reglas/<su 0 en kebab>.json. Su id es el hash de su
// cuerpo canónico, como el de un evento (SHA-256 de `canonico`, src/evento.js).
// El 2 de la época (epoca-0.btml.json) es la LISTA de referencias { ref } a
// esos registros, una por regla, en el orden que dice el 8 de cada una
// («first», «after <nombre>»): `npm run epocas` la reescribe desde los
// archivos de reglas/, así que no se edita a mano.
//
// Las traducciones del encargo 2 que el mapa §15 cambiaba (reglas-3b/: el P
// acuñado por el autor, el P del génesis, el escalonado, el colateral de R) se
// reescribieron en el encargo 3b como reglas de la época y la carpeta se retiró.
//
// Corregir una regla no la modifica en sitio: se añade un ocupante a su
// registro, un archivo en correcciones/ { "sobre": <id de la regla>, "en":
// <la posición, un dígito>, "ocupante": <lo nuevo>, "de": <procedencia> }.
// El registro de la regla (y su id) no cambia; quien lo lee toma el último
// ocupante de esa posición (src/epocas.js, cargarEpocaBtml; docs/BQLM.md §5).

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canonico } from '../../src/evento.js';

const CARPETA = dirname(fileURLToPath(import.meta.url));
const SALIDA = join(CARPETA, 'epocas.js');

/** La época cuyo 2 son las reglas de reglas/ (la única que hay hoy en forma de registro). */
export const RAIZ = 'epoca-0.btml.json';

/** 'epoca-0.json' → 'EPOCA_0_DATOS'. */
export function nombreDeConstante(archivo) {
  return archivo.replace(/\.json$/, '').replace(/[^A-Za-z0-9]+/g, '_').toUpperCase() + '_DATOS';
}

/** El 0 de una regla en kebab: «writing burns today's T» → «writing-burns-today-s-t». */
export function kebab(nombre) {
  return String(nombre).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** El id de un registro de la época: el hash de su cuerpo canónico (como el de un evento). */
export function idDe(registro) {
  return createHash('sha256').update(canonico(registro)).digest('hex');
}

const esHojaJSON = (x) => !Array.isArray(x);

/**
 * JSON con la forma de los datos de la época: un array solo de hojas en una
 * línea (si es de más de una y no cabe en cien caracteres, una por línea);
 * uno con arrays dentro, un elemento por línea; una lista de referencias,
 * una por línea.
 */
export function formatear(x, sangria = '') {
  if (!Array.isArray(x)) return JSON.stringify(x);
  const referencias = x.length > 1 && x.every((h) => h !== null && typeof h === 'object' && !Array.isArray(h));
  const enLinea = '[' + x.map((h) => JSON.stringify(h)).join(', ') + ']';
  if (x.every(esHojaJSON) && !referencias && (x.length === 1 || enLinea.length <= 100)) return enLinea;
  // Una décupla pequeña de listas de hojas, también en una línea: [["día"], [1]].
  const pequena = '[' + x.map((h) => formatear(h, '')).join(', ') + ']';
  if (x.every((h) => Array.isArray(h) && h.every(esHojaJSON)) && !pequena.includes('\n') && pequena.length <= 100) return pequena;
  const dentro = sangria + '  ';
  return '[\n' + x.map((h) => dentro + formatear(h, dentro)).join(',\n') + '\n' + sangria + ']';
}

const leerJSON = (ruta) => JSON.parse(readFileSync(ruta, 'utf8'));
const jsonDe = (carpeta) => (existsSync(carpeta) ? readdirSync(carpeta).filter((f) => f.endsWith('.json')).sort() : []);

/** Los registros de reglas de una carpeta: [{ archivo, id, registro }], por nombre de archivo. El nombre es el 0 en kebab. */
export function reglasDe(carpeta = join(CARPETA, 'reglas')) {
  return jsonDe(carpeta).map((archivo) => {
    const registro = leerJSON(join(carpeta, archivo));
    const nombre = Array.isArray(registro) && Array.isArray(registro[0]) ? registro[0][0] : undefined;
    if (archivo !== kebab(nombre) + '.json') throw new Error('reglas/' + archivo + ': el archivo se llama como el 0 de su regla en kebab (' + kebab(nombre) + '.json)');
    return { archivo, id: idDe(registro), registro };
  });
}

/**
 * Las plantillas de transacción de la época (encargo 3c-2a: las acciones del aro): un registro por acción en
 * plantillas/<su 0 en kebab>.json, con el molde de regla adaptado (0 nombre, 1 parámetros, 2 cuándo se ofrece, 3 quién
 * la lanza, 4 lo que mueve, 5 dónde ancla, 6 procedencia, 7 época, 8 [punto de vista, orden], 9 mensaje). Su id es el
 * hash de su cuerpo canónico, como el de una regla. El 9.6 de la época es la lista de referencias a ellas, en el
 * orden de su 8 (por punto de vista y, dentro de cada uno, por orden; la primera de cada uno es la acción por defecto).
 */
export function plantillasDe(carpeta = join(CARPETA, 'plantillas')) {
  return jsonDe(carpeta).map((archivo) => {
    const registro = leerJSON(join(carpeta, archivo));
    const nombre = Array.isArray(registro) && Array.isArray(registro[0]) ? registro[0][0] : undefined;
    if (archivo !== kebab(nombre) + '.json') throw new Error('plantillas/' + archivo + ': el archivo se llama como el 0 de su plantilla en kebab (' + kebab(nombre) + '.json)');
    return { archivo, id: idDe(registro), registro };
  });
}

/** Las plantillas de transacción en el orden de su 8: [punto de vista, orden]. */
export function ordenarPorAro(plantillas) {
  const ocho = (p) => (Array.isArray(p.registro[8]) ? p.registro[8] : []).map(Number);
  for (const p of plantillas) {
    const [pv, n] = ocho(p);
    if (!Number.isInteger(pv) || pv < 0 || pv > 9 || !Number.isInteger(n) || n < 1) throw new Error('plantillas: el 8 de «' + p.registro[0][0] + '» es [punto de vista, orden]');
  }
  const llave = (p) => ocho(p)[0] * 100 + ocho(p)[1];
  const vistas = new Set();
  for (const p of plantillas) {
    if (vistas.has(llave(p))) throw new Error('plantillas: dos plantillas con el mismo 8 ' + JSON.stringify(ocho(p)));
    vistas.add(llave(p));
  }
  return [...plantillas].sort((a, b) => llave(a) - llave(b));
}

/** Las correcciones de los registros de la época: [{ archivo, sobre, en, ocupante, de }], por nombre de archivo. */
export function correccionesDe(carpeta = join(CARPETA, 'correcciones')) {
  return jsonDe(carpeta).map((archivo) => ({ archivo, ...leerJSON(join(carpeta, archivo)) }));
}

/** Las reglas en el orden de su 8: la que dice «first» y, detrás de cada una, la que dice «after <su nombre>». */
export function ordenarPorOcho(reglas) {
  const nombre = (r) => r.registro[0][0];
  const orden = (r) => r.registro[8][r.registro[8].length - 1];
  const primeras = reglas.filter((r) => orden(r) === 'first');
  if (primeras.length !== 1) throw new Error('reglas: una sola dice «first» en su 8, no ' + primeras.length);
  const despues = new Map();
  for (const r of reglas) {
    const o = orden(r);
    if (o === 'first') continue;
    if (typeof o !== 'string' || !o.startsWith('after ')) throw new Error('reglas: el 8 de «' + nombre(r) + '» es «first» o «after <nombre>»');
    if (despues.has(o.slice(6))) throw new Error('reglas: dos reglas van después de «' + o.slice(6) + '»');
    despues.set(o.slice(6), r);
  }
  const fuera = [primeras[0]];
  while (despues.has(nombre(fuera[fuera.length - 1]))) fuera.push(despues.get(nombre(fuera[fuera.length - 1])));
  if (fuera.length !== reglas.length) throw new Error('reglas: el 8 no encadena todas (' + fuera.length + ' de ' + reglas.length + ')');
  return fuera;
}

// ---------- los modelos de visualización (encargo 3c-2b, tras 3c-1; docs/CONTRATO.md «Modelos de visualización») ----------
//
// Un modelo es un registro de la época como las reglas: modelos/<nombre>.json es su décupla (0 nombre, nivel y
// nota; 1-4 y 6-9 las piezas de cada mundo; 5 los marcos y los iconos del aro), y cada PIEZA es su propio registro,
// modelos/<nombre>/<pieza>.json, referenciada desde la posición del mundo en que sirve (lo que dice su 5: un
// dígito, varios, o «*» = todos los mundos). Así un modelo se rellena por partes (en el eje, anclando piezas en la
// posición de su mundo) y ninguna posición pasa de diez: una lista de referencias no tiene tope. `npm run epocas`
// reescribe las posiciones 1-9 de cada modelo desde su carpeta de piezas, y el 9.7 de la raíz (detrás de su
// cabecera) con las referencias a los modelos, por nombre de archivo. Una posición sin piezas delante de otra con
// ellas lleva la hoja SIN_PIEZAS (nunca se escribe []). Dentro de una posición, las piezas van por su rango (el 7 de la
// pieza; etapa 5): la nueva delante de la que quedó de respaldo con su misma clave.

/** La carpeta de los modelos de la época. */
export const MODELOS = 'modelos';

/** Lo que lleva una posición de un modelo que no tiene piezas, cuando una posterior sí las tiene (nunca []). */
export const SIN_PIEZAS = 'sin piezas';

/** Los mundos (los dígitos de la cruceta que son piezas de un mundo): 1-4 y 6-9; el 5 es el aro y los marcos. */
export const MUNDOS = Object.freeze([1, 2, 3, 4, 6, 7, 8, 9]);

/** Los registros de las piezas de una carpeta: [{ archivo, id, registro }], por nombre de archivo. */
export function piezasDe(carpeta) {
  return jsonDe(carpeta).map((archivo) => {
    const registro = leerJSON(join(carpeta, archivo));
    return { archivo, id: idDe(registro), registro };
  });
}

/** Los mundos en que sirve una pieza, según su 5: dígitos, o «*» = todos los mundos (nunca el 5). */
export function mundosDePieza(registro) {
  const cinco = Array.isArray(registro?.[5]) ? registro[5] : registro?.[5] === undefined ? [] : [registro[5]];
  const fuera = new Set();
  for (const h of cinco) {
    if (h === '*') MUNDOS.forEach((d) => fuera.add(d));
    else if (Number.isInteger(h) && h >= 0 && h < 10) fuera.add(h);
  }
  return [...fuera].sort((a, b) => a - b);
}

/**
 * La décupla de un modelo desde su cabecera (el 0 del archivo del modelo) y sus piezas: en cada posición 1-9 la
 * lista de referencias { ref } a las piezas que sirven en ese mundo, en el orden de las piezas; una posición sin
 * piezas delante de otra con ellas lleva SIN_PIEZAS; las de detrás no se escriben.
 */
export function modeloConPiezas(cabecera, piezas) {
  const posiciones = [];
  // Por rango (el 7 de la pieza: 0 o nada la primera opción, 1 la que queda de respaldo), estable: la nueva delante de la de respaldo.
  const rango = (p) => (Array.isArray(p.registro?.[7]) && typeof p.registro[7][0] === 'number' ? p.registro[7][0] : 0);
  const ordenadas = piezas.map((p, k) => ({ p, k })).sort((a, b) => rango(a.p) - rango(b.p) || a.k - b.k).map(({ p }) => p);
  for (let d = 1; d < 10; d++) posiciones[d] = ordenadas.filter((p) => mundosDePieza(p.registro).includes(d)).map(({ id }) => ({ ref: id }));
  let ultimo = 0;
  for (let d = 1; d < 10; d++) if (posiciones[d].length) ultimo = d;
  const fuera = [cabecera];
  for (let d = 1; d <= ultimo; d++) fuera.push(posiciones[d].length ? posiciones[d] : SIN_PIEZAS);
  return fuera;
}

/**
 * Los modelos de la época: [{ archivo, nombre, id, registro, piezas: [{ archivo, id, registro }] }], por nombre de
 * archivo; `registro` es la décupla con sus posiciones reescritas desde sus piezas (modeloConPiezas) y `id` su hash.
 */
export function modelosDe(carpeta = join(CARPETA, MODELOS)) {
  return jsonDe(carpeta).map((archivo) => {
    const nombre = archivo.replace(/\.json$/, '');
    const enDisco = leerJSON(join(carpeta, archivo));
    if (!Array.isArray(enDisco) || !Array.isArray(enDisco[0]) || enDisco[0][0] !== nombre) throw new Error(MODELOS + '/' + archivo + ': el archivo se llama como el 0.0 del modelo (' + String(enDisco?.[0]?.[0]) + ')');
    const piezas = piezasDe(join(carpeta, nombre));
    const registro = modeloConPiezas(enDisco[0], piezas);
    return { archivo, nombre, id: idDe(registro), registro, piezas };
  });
}

/**
 * La raíz de la época con su 2 = las referencias a las reglas de reglas/, en el orden de su 8; su 9.6 = su cabecera
 * (la que hay en disco) y, en su 9.6.1, las referencias a las plantillas de transacción de plantillas/, en el orden de
 * su 8 (encargo 3c-2a); y su 9.7 = su cabecera seguida de las referencias a los modelos de modelos/, por nombre de
 * archivo (encargo 3c-2b).
 */
export function raizConReglas(carpeta = CARPETA) {
  const raiz = leerJSON(join(carpeta, RAIZ));
  const reglas = ordenarPorOcho(reglasDe(join(carpeta, 'reglas')));
  const nueve = Array.isArray(raiz[9]) ? [...raiz[9]] : raiz[9];
  if (Array.isArray(nueve) && Array.isArray(nueve[7])) {
    const cabecera = Array.isArray(nueve[7][0]) ? nueve[7][0] : nueve[7];
    nueve[7] = [cabecera, ...modelosDe(join(carpeta, MODELOS)).map(({ id }) => ({ ref: id }))];
  }
  const plantillas = ordenarPorAro(plantillasDe(join(carpeta, 'plantillas')));
  if (plantillas.length && Array.isArray(nueve) && Array.isArray(nueve[6])) {
    // 9.6.0 la cabecera (la que hay en disco), 9.6.1 la lista de referencias: una posición no pasa de diez ocupantes
    // si lleva una décupla dentro, y una lista de referencias no tiene tope.
    const cabecera = Array.isArray(nueve[6][0]) ? nueve[6][0] : nueve[6];
    nueve[6] = [cabecera, plantillas.map(({ id }) => ({ ref: id }))];
  }
  return [...raiz.slice(0, 2), reglas.map(({ id }) => ({ ref: id })), ...raiz.slice(3, 9), nueve];
}

/** Texto de epocas.js para los JSON de la carpeta, en orden de nombre de archivo, y los registros de la época. */
export function generar(carpeta = CARPETA) {
  const archivos = readdirSync(carpeta).filter((f) => /^epoca-.*\.json$/.test(f)).sort();
  const partes = [
    '// Generado por datos/epocas/generar.mjs desde los JSON de esta carpeta.',
    '// No se edita a mano: se cambia el JSON y se ejecuta `npm run epocas`.',
    '',
  ];
  for (const f of archivos) {
    const datos = leerJSON(join(carpeta, f));
    partes.push(`// ${f}`);
    partes.push(`export const ${nombreDeConstante(f)} = ${JSON.stringify(datos, null, 2)};`);
    partes.push('');
  }
  partes.push('// reglas/*.json: los registros de las reglas de la época, { archivo, id, registro }; el id, el hash de su cuerpo canónico');
  partes.push(`export const REGLAS_DE_EPOCA_DATOS = ${JSON.stringify(reglasDe(join(carpeta, 'reglas')), null, 2)};`);
  partes.push('');
  partes.push('// plantillas/*.json: las plantillas de transacción (las acciones del aro, encargo 3c-2a), { archivo, id, registro }, en el orden de su 8 (el del 9.6 de la época)');
  partes.push(`export const PLANTILLAS_DE_EPOCA_DATOS = ${JSON.stringify(ordenarPorAro(plantillasDe(join(carpeta, 'plantillas'))), null, 2)};`);
  partes.push('');
  partes.push('// el id de la raíz de la época 0 (con su 2 = las referencias a sus reglas): el hash de su cuerpo canónico; lo nombran el génesis (contexto.epoca) y el 2 de una invitación (VG, 9-11: «se referencia, no se manda»)');
  partes.push(`export const EPOCA_0_BTML_ID = ${JSON.stringify(idDe(raizConReglas(carpeta)))};`);
  partes.push('');
  partes.push('// correcciones/*.json: ocupantes añadidos a un registro de la época, { archivo, sobre, en, ocupante, de }');
  partes.push(`export const CORRECCIONES_DE_EPOCA_DATOS = ${JSON.stringify(correccionesDe(join(carpeta, 'correcciones')), null, 2)};`);
  partes.push('');
  partes.push('// modelos/*.json y modelos/<nombre>/*.json: los modelos de visualización de la época (encargo 3c-2b) y sus piezas, { archivo, nombre, id, registro, piezas: [{ archivo, id, registro }] }; cada id, el hash de su cuerpo canónico; el 9.7 de la raíz los referencia');
  partes.push(`export const MODELOS_DE_EPOCA_DATOS = ${JSON.stringify(modelosDe(join(carpeta, MODELOS)), null, 2)};`);
  partes.push('');
  return partes.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Los modelos primero: sus posiciones (las referencias a sus piezas) cambian su id, y la raíz los referencia.
  for (const { archivo, registro } of modelosDe()) {
    const ruta = join(CARPETA, MODELOS, archivo);
    const texto = formatear(registro) + '\n';
    if (readFileSync(ruta, 'utf8').replace(/\r\n/g, '\n') !== texto) {
      writeFileSync(ruta, texto);
      console.log('reescritas las posiciones de ' + ruta + ' (las referencias a sus piezas, por mundo)');
    }
  }
  const raiz = join(CARPETA, RAIZ);
  const nueva = formatear(raizConReglas()) + '\n';
  if (readFileSync(raiz, 'utf8').replace(/\r\n/g, '\n') !== nueva) {
    writeFileSync(raiz, nueva);
    console.log('reescritos el 2 (las referencias a reglas/, en el orden de su 8), el 9.6 (las plantillas de plantillas/, en el orden de su 8) y el 9.7 (las referencias a modelos/) de ' + raiz);
  }
  writeFileSync(SALIDA, generar());
  console.log('escrito ' + SALIDA);
}
