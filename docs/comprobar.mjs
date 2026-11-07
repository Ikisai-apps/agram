// Ejecuta los ejemplos de los documentos y compara su salida con la que el
// documento imprime. Desde la raíz del repositorio:
//
//   node docs/comprobar.mjs            todos los de docs/*.md y docs/notas/*.md
//   node docs/comprobar.mjs BQL        solo los documentos cuyo nombre contiene «BQL»
//
// Qué cuenta como ejemplo ejecutable:
// - un bloque ```sh que es `node --input-type=module -e '…'` o `-e "…"`;
// - un bloque ```js seguido (a pocas líneas) de un bloque de salida (```text
//   o ``` sin lenguaje): se ejecuta entero, como `node --input-type=module < archivo.mjs`.
// Los bloques que importan por `file:///<repo>/` son anexos históricos (la
// salida es la de otro commit, y la nota lo dice): se cuentan, no se ejecutan.
//
// Sin dependencias y sin shell: el código se pasa a Node por la entrada
// estándar, con la raíz como directorio de trabajo, en Windows y en Unix.
// Sale con código 1 si algún ejemplo no da la salida impresa.
// [X] decidir VG: si esto entra en `node --test` (docs/notas/PRUEBA_DEL_EXTRANJERO.md §7, pregunta 7).

import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const filtro = process.argv[2];
const archivos = [
  ...readdirSync('docs').filter((f) => f.endsWith('.md')).map((f) => 'docs/' + f),
  ...readdirSync('docs/notas').filter((f) => f.endsWith('.md')).map((f) => 'docs/notas/' + f),
].filter((a) => !filtro || a.includes(filtro));

function bloquesDe(archivo) {
  const bloques = [];
  let dentro = null;
  readFileSync(archivo, 'utf8').split('\n').forEach((linea, i) => {
    const l = linea.replace(/\r$/, '');
    const apertura = l.match(/^```(\w*)\s*$/);
    if (apertura && !dentro) dentro = { linea: i + 1, lenguaje: apertura[1], texto: [] };
    else if (l.startsWith('```') && dentro) {
      bloques.push({ ...dentro, fin: i + 1, texto: dentro.texto.join('\n') });
      dentro = null;
    } else if (dentro) dentro.texto.push(l);
  });
  return bloques;
}

/** El código JavaScript de un `node --input-type=module -e …`, quitando las comillas como lo haría la shell. */
function codigoDeComando(comando) {
  const m = comando.trim().match(/^node --input-type=module -e (['"])([\s\S]*)\1$/);
  if (!m) return null;
  if (m[1] === "'") return m[2]; // comillas simples: literal
  if (/(^|[^\\])[$`]/.test(m[2])) return null; // haría falta la shell para expandirlo
  return m[2].replace(/\\(["\\$`])/g, '$1');
}

const normal = (s) => s.replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '');

let total = 0;
let distintos = 0;
let historicos = 0;
for (const archivo of archivos) {
  const bloques = bloquesDe(archivo);
  bloques.forEach((b, k) => {
    const siguiente = bloques[k + 1];
    const salida = siguiente && (siguiente.lenguaje === 'text' || siguiente.lenguaje === '') && siguiente.linea - b.fin <= 8 ? siguiente : null;
    let codigo = null;
    if (b.lenguaje === 'sh' && /^\s*node\b/.test(b.texto)) {
      codigo = codigoDeComando(b.texto);
      if (codigo === null) {
        total++;
        distintos++;
        console.log(`✗ ${archivo}:${b.linea} · comando que no se sabe ejecutar sin shell`);
        return;
      }
    } else if (b.lenguaje === 'js' && salida) {
      if (b.texto.includes('<repo>')) {
        historicos++;
        return;
      }
      codigo = b.texto;
    } else return;
    total++;
    const r = spawnSync(process.execPath, ['--input-type=module'], { input: codigo, encoding: 'utf8', timeout: 300000 });
    const real = normal((r.stdout ?? '') + (r.stderr ?? ''));
    if (!salida) {
      distintos++;
      console.log(`✗ ${archivo}:${b.linea} · sin bloque de salida detrás; salida real:\n${real}`);
      return;
    }
    const esperado = normal(salida.texto);
    if (real === esperado && r.status === 0) {
      console.log(`✓ ${archivo}:${b.linea}`);
      return;
    }
    distintos++;
    console.log(`✗ ${archivo}:${b.linea} → salida en la línea ${salida.linea} (código de salida ${r.status})`);
    const e = esperado.split('\n');
    const g = real.split('\n');
    for (let i = 0; i < Math.max(e.length, g.length); i++) {
      if (e[i] !== g[i]) console.log(`    línea ${i + 1}\n      documento: ${e[i] ?? '∅'}\n      real:      ${g[i] ?? '∅'}`);
    }
  });
}
console.log(`\n${total - distintos} de ${total} ejemplos dan la salida impresa${historicos ? ` · ${historicos} anexos históricos sin ejecutar` : ''}`);
process.exitCode = distintos ? 1 : 0;
