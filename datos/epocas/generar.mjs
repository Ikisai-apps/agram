// Genera datos/epocas/epocas.js desde los JSON de esta carpeta (epoca-*.json),
// para que src/epocas.js los importe sin fetch, igual en Node que en el
// navegador. Los JSON mandan: se cambian ellos y se vuelve a generar con
// `npm run epocas`. Una prueba comprueba que epocas.js está al día.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CARPETA = dirname(fileURLToPath(import.meta.url));
const SALIDA = join(CARPETA, 'epocas.js');

/** 'epoca-1-propuesta.json' → 'EPOCA_1_PROPUESTA_DATOS'. */
export function nombreDeConstante(archivo) {
  return archivo.replace(/\.json$/, '').replace(/[^A-Za-z0-9]+/g, '_').toUpperCase() + '_DATOS';
}

/** Texto de epocas.js para los JSON de la carpeta, en orden de nombre de archivo. */
export function generar(carpeta = CARPETA) {
  const archivos = readdirSync(carpeta).filter((f) => /^epoca-.*\.json$/.test(f)).sort();
  const partes = [
    '// Generado por datos/epocas/generar.mjs desde los JSON de esta carpeta.',
    '// No se edita a mano: se cambia el JSON y se ejecuta `npm run epocas`.',
    '',
  ];
  for (const f of archivos) {
    const datos = JSON.parse(readFileSync(join(carpeta, f), 'utf8'));
    partes.push(`// ${f}`);
    partes.push(`export const ${nombreDeConstante(f)} = ${JSON.stringify(datos, null, 2)};`);
    partes.push('');
  }
  return partes.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(SALIDA, generar());
  console.log('escrito ' + SALIDA);
}
