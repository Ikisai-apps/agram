// Importa un paquete de arte como modelo de visualización (encargo 3c-2b, tras 3c-1; etapa 5, la fase 2; arte/MANIFIESTO.md).
// Lee el índice JSON del paquete (`<carpeta>/indice.json`: qué archivo es cada pieza, de qué mundo, de qué familia,
// con qué nombre, nivel, orientación, bucle y fotogramas; tolera campos que falten: los infiere del nombre del
// archivo, de la carpeta o de la cabecera de la época) y genera el JSON de un modelo (el registro del modelo y los
// registros de sus piezas, con las referencias de cada mundo), SIN copiar ningún archivo: las piezas referencian las
// rutas del paquete. Varios paquetes (los bloques de una entrega) entran en un solo modelo.
//
//   node arte/importar.mjs <carpeta> [<carpeta>…] [--nombre <n>] [--nota <texto>]   imprime el modelo (y sus avisos, en la salida de error);
//                                                                                    varios paquetes sin --nombre van en el modelo «general»
//   node arte/importar.mjs <carpeta>… --escribir                                     lo escribe en datos/epocas/modelos/<nombre>.json y <nombre>/;
//                                                                                     después, `npm run epocas` lo referencia desde epoch.9.7
//
// Desde código: importar(indice, { carpeta }) → { nombre, nivel, modelo, piezas: [{ archivo, registro }], avisos };
// importarPaquetes([{ indice, carpeta }…], { nombre, nota }) → lo mismo, con las piezas de todos.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cabecera, leerPieza, validarModelo, CUALQUIERA, POSICIONES } from '../src/modelos.js';
import { PV } from '../src/epocas.js';
import { formatear, kebab, modeloConPiezas, idDe, MODELOS, SIN_PIEZAS } from '../datos/epocas/generar.mjs';

const RAIZ_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Los mundos por su nombre corriente (docs/MUNDOS.md: la X y la cruz) y por el nombre de su regla corta (epoch.5.0.d). */
const MUNDOS = Object.freeze(Object.assign({ lente: 0, ciudad: 1, reino: 1, jardin: 2, bosque: 2, parque: 3, fabrica: 4, aro: 5, centro: 5, reverso: 5, pasado: 6, futuro: 7, cielo: 8, camino: 9 }, Object.fromEntries(PV.map((nombre, d) => [kebab(nombre), d]))));

/** La posición del modelo donde van los marcos y los iconos (el centro: epoch.9.7.0 dice «5 los marcos y los iconos del aro»). */
const CENTRO = 5;

/** La palabra del índice de la fase 2 para «en todos los mundos» (efectos) o «en el centro» (iconos, marcos). */
const COMUN = 'comun';

/** El formato de un archivo por su extensión (los de epoch.9.5.1). */
const FORMATOS = Object.freeze({ '.svg': 'svg', '.json': 'lottie', '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.webp': 'image', '.gif': 'image', '.mp4': 'video', '.webm': 'video', '.html': 'html' });

/** El rango de una pieza que queda de respaldo detrás de otra nueva con su misma clave (el 7 de la pieza). */
const RANGO_RESPALDO = 1;

const sinAcentos = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Un mundo (0-9) desde un dígito, un texto con un dígito o un nombre; undefined si no se reconoce. */
export function mundoDe(x) {
  if (Number.isInteger(x) && x >= 0 && x <= 9) return x;
  if (typeof x !== 'string') return undefined;
  if (/^[0-9]$/.test(x.trim())) return Number(x.trim());
  const nombre = sinAcentos(x.trim());
  return Object.hasOwn(MUNDOS, nombre) ? MUNDOS[nombre] : undefined;
}

/** Los segmentos de una ruta (carpetas y el nombre sin extensión partido por guiones), sin acentos, para inferir lo que falte. */
function segmentosDe(ruta) {
  const partes = String(ruta).split(/[\\/]+/);
  const archivo = partes.pop() ?? '';
  const nombre = archivo.replace(/\.[^.]+$/, '');
  return { carpetas: partes.map(sinAcentos), nombre: nombre.split('-').map(sinAcentos), base: nombre };
}

/** Los fotogramas de un Lottie (op − ip) leído del disco, o undefined si no se puede leer. */
function fotogramasDeLottie(ruta) {
  try {
    const d = JSON.parse(readFileSync(ruta, 'utf8'));
    return typeof d.op === 'number' && typeof d.ip === 'number' ? Math.round(d.op - d.ip) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Las piezas de un índice, sin el modelo: [{ archivo, registro }] y los avisos. `indice` es { nombre, nivel, nota,
 * procedencia, piezas: [entrada] } o la lista de entradas. Cada entrada: { ruta (obligatoria, relativa a la carpeta del
 * paquete), mundo | pv, mundos, familia | tipo, nombre, paso | accion | primitiva | clave, nivel, orientacion |
 * variante, bucle, fotogramas, tamano, formato, respaldo, heredado, nota }. Lo que falte se infiere: el tipo y el mundo
 * de las carpetas de la ruta (ciudad/elemento/…), la orientación y el nivel de los segmentos del nombre del archivo
 * (tienda-derecha-intermedio.svg), el formato de la extensión, los fotogramas de un Lottie leído del disco
 * (`carpeta`), el bucle de que sea animado; sin clave, la comodín. De la fase 2: `pv: "comun"` es el centro (5) en
 * los tipos cuya clave es un mundo (iconos, marcos) y todos los mundos (*) en los demás (efectos); el mundo 0 (la
 * lente) va al centro, que no tiene posición propia en un modelo; `mundos: [6, 7]` son los mundos en que sirve;
 * `nombre` es la segunda componente de la clave en los tipos que la tienen (el rol del muñequito, el nombre del
 * elemento, del icono o del marco); `tamano` que falte sale del nivel (su posición entre los niveles de la cabecera:
 * sello 1, intermedio 2, ilustrado 3); `respaldo: true` pone la pieza con rango 1, detrás de la nueva de su misma clave.
 */
function piezasDeIndice(indice, { carpeta = '.', raiz = RAIZ_REPO, cabecera: c, nombres = new Set(), prefijo = '' } = {}) {
  const entradas = Array.isArray(indice) ? indice : Array.isArray(indice?.piezas) ? indice.piezas : [];
  const paquete = Array.isArray(indice) ? {} : indice ?? {};
  const absoluta = resolve(carpeta);
  const dentroDelRepo = !relative(raiz, absoluta).startsWith('..') && !relative(raiz, absoluta).includes(':');
  const rutaDelRepo = (ruta) => (dentroDelRepo ? relative(raiz, resolve(absoluta, ruta)).split(sep).join('/') : String(ruta).split(sep).join('/'));
  const nivelPaquete = c.niveles.includes(paquete.nivel) ? paquete.nivel : undefined;
  const avisos = [];
  const piezas = [];
  const tipos = c.tipos.map((t) => t.tipo);
  const claveDeMundo = (t) => t.clave === 'mundo';
  entradas.forEach((e, k) => {
    const donde = 'entrada ' + k + (e?.ruta ? ' (' + e.ruta + ')' : '');
    if (!e || typeof e.ruta !== 'string' || !e.ruta) { avisos.push('entrada ' + k + ': sin ruta, se omite'); return; }
    const seg = segmentosDe(e.ruta);
    const tipo = tipos.find((t) => t === e.familia || t === e.tipo) ?? tipos.find((t) => seg.carpetas.includes(sinAcentos(t))) ?? tipos.find((t) => seg.nombre.includes(sinAcentos(t)));
    if (!tipo) { avisos.push(donde + ': sin familia que la cabecera conozca (' + tipos.join(', ') + '), se omite'); return; }
    const t = c.tipos.find((x) => x.tipo === tipo);
    // El mundo: un dígito o un nombre; «comun» es el centro en lo que se clava por mundo (iconos, marcos) y todos los mundos en lo demás.
    const comun = e.pv === COMUN || (e.pv === undefined && e.mundo === COMUN); // el pv manda; «mundo» es el nombre para leer a ojo
    let mundo = comun ? (claveDeMundo(t) ? CENTRO : CUALQUIERA) : mundoDe(e.pv) ?? mundoDe(e.mundo) ?? seg.carpetas.map(mundoDe).find((m) => m !== undefined);
    if (mundo === undefined) { avisos.push(donde + ': sin mundo (un dígito 0-9 o su nombre), se omite'); return; }
    if (mundo === 0) { avisos.push(donde + ': el mundo 0 (la lente) no tiene posición en un modelo: va al centro (' + CENTRO + ')'); mundo = CENTRO; }
    // Lo que se clava por mundo (un icono, un marco) vive en el centro y su clave es el mundo del que es; «comun», la comodín.
    const porMundo = claveDeMundo(t);
    const mundos = porMundo ? [CENTRO] : [...new Set([mundo, ...(Array.isArray(e.mundos) ? e.mundos.map(mundoDe).filter((m) => Number.isInteger(m) && m > 0) : [])])];
    const variante = c.variantes.find((v) => v === e.orientacion || v === e.variante) ?? c.variantes.find((v) => seg.nombre.includes(sinAcentos(v))) ?? c.variantes[0];
    const nivel = c.niveles.find((n) => n === e.nivel) ?? c.niveles.find((n) => seg.nombre.includes(sinAcentos(n))) ?? nivelPaquete;
    const formato = c.formatos.includes(e.formato) ? e.formato : FORMATOS[extname(e.ruta).toLowerCase()];
    if (!formato) { avisos.push(donde + ': sin formato que la época conozca, se omite'); return; }
    // La clave: la condición (paso, acción, primitiva o mundo del icono) y, si el tipo la tiene, la segunda componente (el nombre o rol).
    // Un icono o un marco: su clave es el mundo del que es (un dígito, no el nombre del mundo que trae el índice).
    let clave = porMundo ? (comun ? e.clave : e.clave ?? (mundo !== CENTRO ? mundo : undefined)) : e.clave ?? e.paso ?? e.accion ?? e.primitiva ?? e[t.clave];
    if (clave === undefined && typeof e.nombre === 'string' && t.clave && t.claves.length < 2 && t.clave !== 'paso' && t.clave !== 'mundo') clave = e.nombre;
    if (clave === undefined && t.clave === 'paso' && typeof e.nombre === 'number') clave = e.nombre;
    if (typeof clave === 'string' && /^[0-9]+$/.test(clave.trim())) clave = Number(clave.trim());
    if (clave === undefined || clave === null || clave === '') { clave = CUALQUIERA; if (t.claves.length < 2 || typeof e.nombre !== 'string') avisos.push(donde + ': sin ' + (t.clave ?? 'clave') + ', sirve para cualquiera (*)'); }
    const segunda = t.claves[1] && typeof e[t.claves[1]] === 'string' ? e[t.claves[1]] : t.claves[1] && typeof e.nombre === 'string' ? e.nombre : undefined;
    const animado = c.animados.includes(formato);
    let fotogramas = Number.isInteger(e.fotogramas) && e.fotogramas > 0 ? e.fotogramas : undefined;
    if (fotogramas === undefined && formato === FORMATOS['.json']) fotogramas = fotogramasDeLottie(resolve(absoluta, e.ruta));
    if (fotogramas === undefined) { fotogramas = 1; if (animado) avisos.push(donde + ': animada sin fotogramas, se pone 1'); }
    const bucle = e.bucle === true || e.bucle === c.bucle ? true : e.bucle === false || e.bucle === c.fijo ? false : animado;
    const tamano = Number.isInteger(e.tamano) ? e.tamano : nivel ? c.niveles.indexOf(nivel) + 1 : 1;
    const nota = [rutaDelRepo('.') + (nivel ? ' (nivel ' + nivel + ')' : '') + (e.heredado ? ', heredada de la fase 1' : ''), ...(typeof e.origen === 'string' ? [e.origen] : []), ...(typeof e.nota === 'string' ? [e.nota] : [])];
    const registro = [[tipo], [tamano, formato], segunda === undefined ? [clave] : [clave, segunda], [variante], [bucle ? c.bucle : c.fijo, fotogramas], mundos, [rutaDelRepo(e.ruta), ...nota]];
    if (e.respaldo === true) registro[POSICIONES.pieza.rango] = [RANGO_RESPALDO];
    if (!leerPieza(registro, { cabecera: c, pv: mundos[0] })) { avisos.push(donde + ': no sale una pieza, se omite'); return; }
    let archivo = kebab([prefijo, tipo, clave === CUALQUIERA ? 'cualquiera' : clave, segunda ?? '', variante, seg.base, e.respaldo === true ? 'respaldo' : ''].filter((x) => x !== '').join(' ')) + '.json';
    let n = 2;
    while (nombres.has(archivo)) archivo = archivo.replace(/(-\d+)?\.json$/, '-' + n++ + '.json');
    nombres.add(archivo);
    piezas.push({ archivo, registro, nivel });
  });
  return { piezas, avisos, nivelPaquete, paquete, rutaDelRepo };
}

/** El modelo desde sus piezas: el 0 (nombre, el nivel más alto que haya, nota), la décupla, las piezas con id y los avisos de validarModelo. */
function modeloDesde({ nombre, nivel, nota, piezas, avisos, c, epoca }) {
  const conId = piezas.map(({ nivel: _n, ...p }) => ({ ...p, id: idDe(p.registro) }));
  const cero = [nombre, nivel, nota];
  const modelo = modeloConPiezas(cero, conId);
  const { motivos, avisos: deValidar } = validarModelo({ nombre, nivel, registro: modelo, cabecera: c, piezas: conId.map((p) => ({ ...leerPieza(p.registro, { cabecera: c, pv: typeof p.registro[5][0] === 'number' ? p.registro[5][0] : 1 }), donde: p.id })) }, epoca ? { epoca } : {});
  return { nombre, nivel, modelo, piezas: conId, avisos: [...avisos, ...motivos, ...deValidar] };
}

/** El nivel del modelo: el más alto (en el orden de la cabecera) entre los de sus piezas, o el del paquete, o el primero. */
const nivelMasAlto = (c, niveles, nivelPaquete) => nivelPaquete ?? [...c.niveles].reverse().find((n) => niveles.includes(n)) ?? c.niveles[0] ?? 'sin nivel';

/**
 * Importa un índice (piezasDeIndice dice qué admite): → { nombre, nivel, modelo (la décupla, con las referencias de
 * cada mundo), piezas: [{ archivo, id, registro }], avisos }. El nombre, el del paquete o el de la carpeta; el nivel,
 * el del paquete o el más alto de sus piezas.
 */
export function importar(indice, { carpeta = '.', raiz = RAIZ_REPO, epoca } = {}) {
  const c = cabecera(epoca ? { epoca } : {});
  const r = piezasDeIndice(indice, { carpeta, raiz, cabecera: c });
  const absoluta = resolve(carpeta);
  const nombre = typeof r.paquete.nombre === 'string' && r.paquete.nombre ? kebab(r.paquete.nombre) : kebab(basename(absoluta)) || 'paquete';
  const procedencia = [r.rutaDelRepo('.'), ...(typeof r.paquete.procedencia === 'string' ? [r.paquete.procedencia] : []), ...(typeof r.paquete.licencia === 'string' ? ['licencia: ' + r.paquete.licencia] : [])];
  const nivel = nivelMasAlto(c, r.piezas.map((p) => p.nivel), r.nivelPaquete);
  const nota = typeof r.paquete.nota === 'string' ? r.paquete.nota : 'importado de ' + procedencia.join('; ');
  return modeloDesde({ nombre, nivel, nota, piezas: r.piezas, avisos: r.avisos, c, epoca });
}

/**
 * Importa varios paquetes (los bloques de una entrega) en UN modelo: `paquetes` es [{ indice, carpeta }]; `nombre`
 * (obligatorio) y `nota` son los del modelo. Las piezas de cada paquete llevan su carpeta como prefijo del archivo;
 * el nivel del modelo es el más alto de todas. → como importar().
 */
export function importarPaquetes(paquetes, { nombre, nota, raiz = RAIZ_REPO, epoca } = {}) {
  const c = cabecera(epoca ? { epoca } : {});
  const nombres = new Set();
  const piezas = [];
  const avisos = [];
  const carpetas = [];
  for (const { indice, carpeta = '.' } of paquetes) {
    const r = piezasDeIndice(indice, { carpeta, raiz, cabecera: c, nombres, prefijo: kebab(basename(resolve(carpeta))) });
    piezas.push(...r.piezas);
    avisos.push(...r.avisos.map((a) => r.rutaDelRepo('.') + ': ' + a));
    carpetas.push(r.rutaDelRepo('.'));
  }
  const nivel = nivelMasAlto(c, piezas.map((p) => p.nivel));
  return modeloDesde({ nombre: kebab(nombre), nivel, nota: typeof nota === 'string' ? nota : 'importado de ' + carpetas.join(', '), piezas, avisos, c, epoca });
}

/** Escribe un modelo importado en datos/epocas/modelos/: <nombre>.json y <nombre>/<pieza>.json. Devuelve las rutas escritas. */
export function escribir({ nombre, modelo, piezas }, destino = join(RAIZ_REPO, 'datos', 'epocas', MODELOS)) {
  const carpeta = join(destino, nombre);
  mkdirSync(carpeta, { recursive: true });
  const rutas = [];
  for (const p of piezas) {
    const ruta = join(carpeta, p.archivo);
    writeFileSync(ruta, formatear(p.registro) + '\n');
    rutas.push(ruta);
  }
  const ruta = join(destino, nombre + '.json');
  writeFileSync(ruta, formatear(modelo) + '\n');
  rutas.push(ruta);
  return rutas;
}

/** El nombre del modelo cuando se importan varios paquetes sin --nombre: el arte general de la época (epoch.9.7.0.2). */
export const NOMBRE_GENERAL = 'general';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const carpetas = [];
  let nombre;
  let nota;
  let escribirlo = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--escribir') escribirlo = true;
    else if (args[i] === '--nombre') nombre = args[++i];
    else if (args[i] === '--nota') nota = args[++i];
    else carpetas.push(args[i]);
  }
  if (!carpetas.length) {
    console.error('uso: node arte/importar.mjs <carpeta del paquete> [<carpeta>…] [--nombre <nombre>] [--nota <texto>] [--escribir]');
    process.exit(2);
  }
  const paquetes = carpetas.map((carpeta) => {
    const indiceRuta = join(carpeta, 'indice.json');
    if (!existsSync(indiceRuta)) {
      console.error('no hay ' + indiceRuta + ' (arte/MANIFIESTO.md dice qué lleva)');
      process.exit(2);
    }
    return { indice: JSON.parse(readFileSync(indiceRuta, 'utf8')), carpeta };
  });
  // Varios paquetes (los bloques de una entrega) van en UN modelo; sin --nombre, el arte general de la época (#25: la
  // fase 2 es el general, no el de Ikisai; el arte propio de un elemento va anclado al registro, no en un modelo).
  if (carpetas.length > 1 && !nombre) nombre = NOMBRE_GENERAL;
  const resultado = carpetas.length === 1 && !nombre ? importar(paquetes[0].indice, { carpeta: paquetes[0].carpeta }) : importarPaquetes(paquetes, { nombre, nota });
  for (const a of resultado.avisos) console.error('aviso: ' + a);
  if (escribirlo) {
    for (const r of escribir(resultado)) console.error('escrito ' + r);
    console.error('ahora: npm run epocas (referencia el modelo desde epoch.9.7)');
  } else {
    console.log(JSON.stringify({ nombre: resultado.nombre, nivel: resultado.nivel, modelo: resultado.modelo, piezas: resultado.piezas }, null, 2));
  }
  if (resultado.modelo.includes(SIN_PIEZAS)) console.error('aviso: el modelo tiene mundos sin piezas delante de otros con ellas (' + SIN_PIEZAS + ')');
}
