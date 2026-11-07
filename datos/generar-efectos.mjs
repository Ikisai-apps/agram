// Genera datos/efectos.js desde datos/efectos.json, para que src/efectos.js
// lo importe sin fetch, igual en Node que en el navegador. El JSON manda: se
// cambia él y se vuelve a generar con `node datos/generar-efectos.mjs`. Una
// prueba comprueba que efectos.js está al día.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CARPETA = dirname(fileURLToPath(import.meta.url));
const ENTRADA = join(CARPETA, 'efectos.json');
const SALIDA = join(CARPETA, 'efectos.js');

/** Texto de efectos.js para el JSON del catálogo. */
export function generar(entrada = ENTRADA) {
  const datos = JSON.parse(readFileSync(entrada, 'utf8'));
  return [
    '// Generado por datos/generar-efectos.mjs desde datos/efectos.json.',
    '// No se edita a mano: se cambia el JSON y se ejecuta `node datos/generar-efectos.mjs`.',
    '',
    `export const CATALOGO_EFECTOS = ${JSON.stringify(datos, null, 2)};`,
    '',
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(SALIDA, generar());
  console.log('escrito ' + SALIDA);
}
