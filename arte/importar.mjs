// Importa un paquete de arte como modelo de visualización (encargo 3c-2b, tras 3c-1; arte/MANIFIESTO.md). Lee el
// índice JSON del paquete (`<carpeta>/indice.json`: qué archivo es cada pieza, de qué mundo, de qué familia, con qué
// nombre, nivel, orientación, bucle y fotogramas; tolera campos que falten: los infiere del nombre del archivo, de la
// carpeta o de la cabecera de la época) y genera el JSON de un modelo (el registro del modelo y los registros de sus
// piezas, con las referencias de cada mundo), SIN copiar ningún archivo: las piezas referencian las rutas del paquete.
//
//   node arte/importar.mjs <carpeta>                       imprime el modelo (y sus avisos, en la salida de error)
//   node arte/importar.mjs <carpeta> --escribir             lo escribe en datos/epocas/modelos/<nombre>.json y <nombre>/;
//                                                           después, `npm run epocas` lo referencia desde epoch.9.7
//
// Desde código: importar(indice, { carpeta }) → { nombre, nivel, modelo, piezas: [{ archivo, registro }], avisos }.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cabecera, leerPieza, validarModelo, CUALQUIERA } from '../src/modelos.js';
import { PV } from '../src/epocas.js';
import { formatear, kebab, modeloConPiezas, idDe, MODELOS, SIN_PIEZAS } from '../datos/epocas/generar.mjs';

const RAIZ_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Los mundos por su nombre corriente (docs/MUNDOS.md: la X y la cruz) y por el nombre de su regla corta (epoch.5.0.d). */
const MUNDOS = Object.freeze(Object.assign({ lente: 0, ciudad: 1, reino: 1, jardin: 2, bosque: 2, parque: 3, fabrica: 4, aro: 5, centro: 5, pasado: 6, futuro: 7, cielo: 8, camino: 9 }, Object.fromEntries(PV.map((nombre, d) => [kebab(nombre), d]))));

/** El formato de un archivo por su extensión (los de epoch.9.5.1). */
const FORMATOS = Object.freeze({ '.svg': 'svg', '.json': 'lottie', '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.webp': 'image', '.gif': 'image', '.mp4': 'video', '.webm': 'video', '.html': 'html' });

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
 * Importa un índice: `indice` es { nombre, nivel, nota, procedencia, piezas: [entrada] } o la lista de entradas. Cada
 * entrada: { ruta (obligatoria, relativa a la carpeta del paquete), mundo | pv, familia | tipo, nombre, paso | accion |
 * primitiva | clave, nivel, orientacion | variante, bucle, fotogramas, tamano, formato }. Lo que falte se infiere: el
 * tipo y el mundo de las carpetas de la ruta (ciudad/elemento/…), la orientación y el nivel de los segmentos del nombre
 * del archivo (tienda-derecha-intermedio.svg), el formato de la extensión, los fotogramas de un Lottie leído del disco
 * (`carpeta`), el bucle de que sea animado; sin clave, la comodín. Devuelve { nombre, nivel, modelo (la décupla, con
 * las referencias de cada mundo), piezas: [{ archivo, id, registro }], avisos }.
 */
export function importar(indice, { carpeta = '.', raiz = RAIZ_REPO, epoca } = {}) {
  const c = cabecera(epoca ? { epoca } : {});
  const entradas = Array.isArray(indice) ? indice : Array.isArray(indice?.piezas) ? indice.piezas : [];
  const paquete = Array.isArray(indice) ? {} : indice ?? {};
  const absoluta = resolve(carpeta);
  const dentroDelRepo = !relative(raiz, absoluta).startsWith('..') && !relative(raiz, absoluta).includes(':');
  const rutaDelRepo = (ruta) => (dentroDelRepo ? relative(raiz, resolve(absoluta, ruta)).split(sep).join('/') : String(ruta).split(sep).join('/'));
  const nombre = typeof paquete.nombre === 'string' && paquete.nombre ? kebab(paquete.nombre) : kebab(basename(absoluta)) || 'paquete';
  const nivelPaquete = c.niveles.includes(paquete.nivel) ? paquete.nivel : undefined;
  const procedencia = [rutaDelRepo('.'), ...(typeof paquete.procedencia === 'string' ? [paquete.procedencia] : []), ...(typeof paquete.licencia === 'string' ? ['licencia: ' + paquete.licencia] : [])];
  const avisos = [];
  const piezas = [];
  const nombres = new Set();
  entradas.forEach((e, k) => {
    if (!e || typeof e.ruta !== 'string' || !e.ruta) { avisos.push('entrada ' + k + ': sin ruta, se omite'); return; }
    const seg = segmentosDe(e.ruta);
    const tipos = c.tipos.map((t) => t.tipo);
    const tipo = tipos.find((t) => t === e.familia || t === e.tipo) ?? tipos.find((t) => seg.carpetas.includes(sinAcentos(t))) ?? tipos.find((t) => seg.nombre.includes(sinAcentos(t)));
    if (!tipo) { avisos.push('entrada ' + k + ' (' + e.ruta + '): sin familia que la cabecera conozca (' + tipos.join(', ') + '), se omite'); return; }
    const t = c.tipos.find((x) => x.tipo === tipo);
    const mundo = mundoDe(e.mundo) ?? mundoDe(e.pv) ?? seg.carpetas.map(mundoDe).find((m) => m !== undefined);
    if (mundo === undefined) { avisos.push('entrada ' + k + ' (' + e.ruta + '): sin mundo (un dígito 0-9 o su nombre), se omite'); return; }
    const variante = c.variantes.find((v) => v === e.orientacion || v === e.variante) ?? c.variantes.find((v) => seg.nombre.includes(sinAcentos(v))) ?? c.variantes[0];
    const nivel = c.niveles.find((n) => n === e.nivel) ?? c.niveles.find((n) => seg.nombre.includes(sinAcentos(n))) ?? nivelPaquete;
    const formato = c.formatos.includes(e.formato) ? e.formato : FORMATOS[extname(e.ruta).toLowerCase()];
    if (!formato) { avisos.push('entrada ' + k + ' (' + e.ruta + '): sin formato que la época conozca, se omite'); return; }
    let clave = e.clave ?? e.paso ?? e.accion ?? e.primitiva ?? e[t.clave];
    if (clave === undefined && typeof e.nombre === 'string' && t.clave && t.clave !== 'paso' && t.clave !== 'mundo') clave = e.nombre;
    if (clave === undefined && t.clave === 'paso' && typeof e.nombre === 'number') clave = e.nombre;
    if (typeof clave === 'string' && /^[0-9]+$/.test(clave.trim())) clave = Number(clave.trim());
    if (clave === undefined || clave === null || clave === '') { clave = CUALQUIERA; avisos.push('entrada ' + k + ' (' + e.ruta + '): sin ' + (t.clave ?? 'clave') + ', sirve para cualquiera (*)'); }
    const animado = c.animados.includes(formato);
    let fotogramas = Number.isInteger(e.fotogramas) && e.fotogramas > 0 ? e.fotogramas : undefined;
    if (fotogramas === undefined && formato === FORMATOS['.json']) fotogramas = fotogramasDeLottie(resolve(absoluta, e.ruta));
    if (fotogramas === undefined) { fotogramas = 1; if (animado) avisos.push('entrada ' + k + ' (' + e.ruta + '): animada sin fotogramas, se pone 1'); }
    const bucle = e.bucle === true || e.bucle === c.bucle ? true : e.bucle === false || e.bucle === c.fijo ? false : animado;
    const tamano = Number.isInteger(e.tamano) ? e.tamano : 1;
    const nota = [rutaDelRepo('.') + (nivel ? ' (nivel ' + nivel + ')' : ''), ...(typeof e.nota === 'string' ? [e.nota] : [])];
    const registro = [[tipo], [tamano, formato], [clave], [variante], [bucle ? c.bucle : c.fijo, fotogramas], [mundo], [rutaDelRepo(e.ruta), ...nota]];
    if (!leerPieza(registro, { cabecera: c, pv: mundo })) { avisos.push('entrada ' + k + ' (' + e.ruta + '): no sale una pieza, se omite'); return; }
    let archivo = kebab([tipo, clave === CUALQUIERA ? 'cualquiera' : clave, variante, seg.base].join(' ')) + '.json';
    let n = 2;
    while (nombres.has(archivo)) archivo = archivo.replace(/(-\d+)?\.json$/, '-' + n++ + '.json');
    nombres.add(archivo);
    piezas.push({ archivo, registro });
  });
  const nivel = nivelPaquete ?? c.niveles.find((n) => piezas.some((p) => p.registro[6].some((x) => typeof x === 'string' && x.includes('nivel ' + n)))) ?? c.niveles[0] ?? 'sin nivel';
  const cero = [nombre, nivel, typeof paquete.nota === 'string' ? paquete.nota : 'importado de ' + procedencia.join('; ')];
  const conId = piezas.map((p) => ({ ...p, id: idDe(p.registro) }));
  const modelo = modeloConPiezas(cero, conId);
  const { motivos, avisos: deValidar } = validarModelo({ nombre, nivel, registro: modelo, cabecera: c, piezas: conId.map((p) => ({ ...leerPieza(p.registro, { cabecera: c, pv: p.registro[5][0] }), donde: p.id })) }, epoca ? { epoca } : {});
  return { nombre, nivel, modelo, piezas: conId, avisos: [...avisos, ...motivos, ...deValidar] };
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [carpeta, ...resto] = process.argv.slice(2);
  if (!carpeta) {
    console.error('uso: node arte/importar.mjs <carpeta del paquete> [--escribir]');
    process.exit(2);
  }
  const indiceRuta = join(carpeta, 'indice.json');
  if (!existsSync(indiceRuta)) {
    console.error('no hay ' + indiceRuta + ' (arte/MANIFIESTO.md dice qué lleva)');
    process.exit(2);
  }
  const resultado = importar(JSON.parse(readFileSync(indiceRuta, 'utf8')), { carpeta });
  for (const a of resultado.avisos) console.error('aviso: ' + a);
  if (resto.includes('--escribir')) {
    for (const r of escribir(resultado)) console.error('escrito ' + r);
    console.error('ahora: npm run epocas (referencia el modelo desde epoch.9.7)');
  } else {
    console.log(JSON.stringify({ nombre: resultado.nombre, nivel: resultado.nivel, modelo: resultado.modelo, piezas: resultado.piezas }, null, 2));
  }
  if (resultado.modelo.includes(SIN_PIEZAS)) console.error('aviso: el modelo tiene mundos sin piezas delante de otros con ellas (' + SIN_PIEZAS + ')');
}
