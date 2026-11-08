// Ejecuta los ejemplos de los documentos y compara su salida con la que el
// documento imprime. Desde la raíz del repositorio:
//
//   node docs/comprobar.mjs            todos los de docs/*.md y docs/notas/*.md
//   node docs/comprobar.mjs BQL        solo los documentos cuyo nombre contiene «BQL»
//
// Qué cuenta como ejemplo ejecutable:
// - un bloque ```sh que es `node --input-type=module -e '…'` o `-e "…"` (otro
//   comando, como `node datos/generar-efectos.mjs`, es una instrucción, no un
//   ejemplo con salida: no se ejecuta);
// - un bloque ```js seguido (a pocas líneas y sin un título en medio) de un
//   bloque de salida (```text o ``` sin lenguaje): se ejecuta entero, como
//   `node --input-type=module < archivo.mjs`.
// Un fragmento que no se ejecuta solo (usa un `eje` que no define, por
// ejemplo) lleva justo encima la línea `<!-- comprobar: fragmento -->`: se
// cuenta aparte y no se ejecuta.
// Un bloque «Leído:» (la lectura humana de un payload, src/lectura.js) lleva
// su código justo encima, en un comentario que no se ve al leer el documento:
//
//   <!-- comprobar: leído
//   import { leer } from './src/lectura.js';
//   console.log(leer(['Compra', 1]));
//   -->
//
// seguido (solo con líneas en blanco en medio) de un bloque ```text: se
// ejecuta ese código y su salida ha de ser el bloque. Un bloque así nunca se
// toma como la salida del bloque de código de encima (el payload que lee).
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

const FRAGMENTO = '<!-- comprobar: fragmento -->';
const LEIDO = '<!-- comprobar: leído';

function bloquesDe(archivo) {
  const bloques = [];
  let dentro = null;
  let comentario = null; // un <!-- comprobar: leído … --> abierto
  let leido = null; // el último cerrado: { codigo, fin }
  const lineas = readFileSync(archivo, 'utf8').split('\n').map((x) => x.replace(/\r$/, ''));
  lineas.forEach((l, i) => {
    if (!dentro && comentario) {
      if (l.trim() === '-->') {
        leido = { codigo: comentario.join('\n'), fin: i + 1 };
        comentario = null;
      } else comentario.push(l);
      return;
    }
    if (!dentro && l.trim() === LEIDO) {
      comentario = [];
      return;
    }
    const apertura = l.match(/^```(\w*)\s*$/);
    if (apertura && !dentro) {
      dentro = { linea: i + 1, lenguaje: apertura[1], texto: [], fragmento: lineas[i - 1]?.trim() === FRAGMENTO };
      // Un bloque de salida justo detrás de un comentario «leído» (solo líneas en blanco en medio) es la salida de ese código.
      if (leido && (apertura[1] === 'text' || apertura[1] === '') && lineas.slice(leido.fin, i).every((x) => !x.trim())) dentro.leido = leido.codigo;
      leido = null;
    } else if (l.startsWith('```') && dentro) {
      bloques.push({ ...dentro, fin: i + 1, texto: dentro.texto.join('\n') });
      dentro = null;
    } else if (dentro) dentro.texto.push(l);
  });
  // Si entre un bloque y el siguiente hay un título, el siguiente no es su salida.
  for (let k = 0; k + 1 < bloques.length; k++) {
    bloques[k].tituloDetras = lineas.slice(bloques[k].fin, bloques[k + 1].linea - 1).some((l) => /^#{1,6}\s/.test(l));
  }
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
let fragmentos = 0;
let leidos = 0;

/** Ejecuta `codigo` y compara su salida con el bloque `salida`; `b` es el bloque que se cita en el informe. */
function comparar(archivo, codigo, b, salida) {
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
    console.log(`✓ ${archivo}:${b.linea}${b.leido !== undefined ? ' · leído' : ''}`);
    return;
  }
  distintos++;
  console.log(`✗ ${archivo}:${b.linea} → salida en la línea ${salida.linea} (código de salida ${r.status})`);
  const e = esperado.split('\n');
  const g = real.split('\n');
  for (let i = 0; i < Math.max(e.length, g.length); i++) {
    if (e[i] !== g[i]) console.log(`    línea ${i + 1}\n      documento: ${e[i] ?? '∅'}\n      real:      ${g[i] ?? '∅'}`);
  }
}

for (const archivo of archivos) {
  const bloques = bloquesDe(archivo);
  bloques.forEach((b, k) => {
    const siguiente = bloques[k + 1];
    // Un bloque «Leído:» nunca es la salida del bloque de código de encima: es la de su propio comentario.
    const salida = siguiente && siguiente.leido === undefined && (siguiente.lenguaje === 'text' || siguiente.lenguaje === '') && siguiente.linea - b.fin <= 8 && !b.tituloDetras ? siguiente : null;
    let codigo = null;
    if (b.fragmento) {
      fragmentos++;
      return;
    }
    if (b.leido !== undefined) {
      // Un bloque «Leído:»: su código va en el comentario de encima y el propio bloque es la salida.
      leidos++;
      comparar(archivo, b.leido, b, b);
      return;
    }
    if (b.lenguaje === 'sh' && /^\s*node --input-type=module -e\b/.test(b.texto)) {
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
    comparar(archivo, codigo, b, salida);
  });
}
console.log(`\n${total - distintos} de ${total} ejemplos dan la salida impresa${leidos ? ` (${leidos} ${leidos === 1 ? 'bloque leído' : 'bloques leídos'})` : ''}${historicos ? ` · ${historicos} anexos históricos sin ejecutar` : ''}${fragmentos ? ` · ${fragmentos} ${fragmentos === 1 ? 'fragmento' : 'fragmentos'} sin ejecutar` : ''}`);
process.exitCode = distintos ? 1 : 0;
