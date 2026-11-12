// La celda 8 sobria y las medidas perezosas (VG, 8-11: «bien a ambos»; mapa
// §14.1, punto 12): hermanos por defecto con un toque para proyecto y todo el
// eje; primero las cantidades por serie y la cuota del foco frente a su
// padre, después los recuentos como información; mapped.mapa().medidas y la
// suma de Scened son la medida única del 8 y solo se calculan si se piden;
// el cielo animado lee con la misma función que la celda sobria.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { mapa, ocho, cuota, textoOcho, textoCuota, medicionesPedidas, medidasDe, recuentosDeCelda, COHORTES, RECUENTOS } from '../src/mapped.js';
import { escena, escenaDe, medidasDeEscena, render } from '../src/scened.js';
import { medir, hijos, MEDIDAS, SIN_BASE_ESCRITA } from '../src/bases.js';
import { datosCielo } from '../antigua/mundos/cielo.js';
import { htmlOcho, COHORTES_VISTA, cohorteOcho, elegirCohorteOcho, lecturaOcho } from '../antigua/ui/ocho.js';
import { htmlEscena, vistaEscena } from '../antigua/ui/escena.js';
import { ejemploComprasHermanas, escribirBasesDelEjemplo } from '../ejemplos/ikisai/compras-hermanas.mjs';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';

const AHORA = '2026-11-07T15:00:00Z';
const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');

/** Los botones de cohorte del HTML: [alcance, pulsado, texto]. */
function botones(html) {
  return [...html.matchAll(/<button type="button" data-ocho-cohorte="(\w+)" aria-pressed="(true|false)" title="[^"]+">([^<]+)<\/button>/g)].map((m) => [m[1], m[2] === 'true', m[3]]);
}

test('celda 8: hermanos por defecto y un toque para proyecto y todo el eje; cada cohorte lee su 8', async () => {
  const { eje, guisos } = await ejemploComprasHermanas();
  assert.deepEqual(COHORTES, ['hermanos', 'proyecto', 'general']);
  assert.deepEqual(COHORTES_VISTA.map((c) => [c.alcance, c.nombre]), [['hermanos', 'hermanos'], ['proyecto', 'proyecto'], ['general', 'todo el eje']]);
  // Por defecto, hermanos (en Node no hay almacenamiento: no se recuerda nada y no pasa nada).
  assert.equal(cohorteOcho(), 'hermanos');
  assert.equal(ocho(eje, guisos.id).alcance, 'hermanos');
  const porDefecto = htmlOcho(eje, guisos.id);
  assert.deepEqual(botones(porDefecto), [['hermanos', true, 'hermanos'], ['proyecto', false, 'proyecto'], ['general', false, 'todo el eje']]);
  assert.match(porDefecto, /<div class="ocho-cohortes" role="group" aria-label="cohorte de la celda 8">/);
  // General: todo el eje, con las altas de huesped y vecina (B1); encargo 3b: también la emisión inicial de la casa y sus
  // dos invitaciones, de las que cuelgan esas altas (mapa §16 [D]).
  const n = { hermanos: 4, proyecto: 9, general: 20 };
  for (const c of COHORTES) {
    const o = ocho(eje, guisos.id, { alcance: c });
    assert.equal(o.n, n[c], c);
    const html = htmlOcho(eje, guisos.id, { alcance: c });
    assert.deepEqual(botones(html).filter(([, p]) => p).map(([a]) => a), [c]);
    const donde = { hermanos: 'entre hermanos', proyecto: 'en el proyecto', general: 'en todo el eje' }[c];
    assert.ok(html.includes(`${donde} · <b>sin base escrita (respaldo al vuelo)</b> · n ${o.n}`), c);
  }
  // El toque elige y se queda (como comodidad); lo que no es una cohorte vuelve a hermanos.
  try {
    assert.equal(elegirCohorteOcho('proyecto'), 'proyecto');
    assert.deepEqual(botones(htmlOcho(eje, guisos.id)).filter(([, p]) => p).map(([a]) => a), ['proyecto']);
    assert.equal(elegirCohorteOcho('mejores'), 'hermanos');
  } finally {
    elegirCohorteOcho('hermanos');
  }
  assert.throws(() => ocho(eje, guisos.id, { alcance: 'mejores' }), /cohorte desconocida: mejores/);
  // El génesis no tiene padre: sin hermanos y sin cuota; en las otras cohortes, sí se lee.
  const g = ocho(eje, eje.genesisId);
  assert.deepEqual([g.estado, g.cantidades, g.recuentos, g.cuota], ['PENDIENTE', [], [], null]);
  assert.match(htmlOcho(eje, eje.genesisId), /entre hermanos · <b>sin cohorte: el génesis no tiene padre<\/b><\/div>$/);
  assert.equal(ocho(eje, eje.genesisId, { alcance: 'general' }).cuota, null);
});

test('celda 8: primero las cantidades por serie y la cuota frente al padre; los recuentos, después y como información', async () => {
  const ej = await ejemploComprasHermanas();
  const { eje, guisos, menu } = ej;
  const o = ocho(eje, guisos.id);
  // Las cantidades son las series (T por escala, E por emisor y denominación, P por ámbito, R por emisor), situadas en la cohorte.
  assert.deepEqual(o.cantidades.map((x) => x.clave), ['E:casa/EUR', 'T:hora']);
  for (const x of o.cantidades) {
    assert.equal(x.foco, medir(eje, guisos.id).tokens[x.clave] ?? 0);
    assert.equal(x.debajo + x.enCaja + x.encima, o.n);
    assert.ok(!('hito' in x) && !('puesto' in x) && !('puntuacion' in x));
    assert.equal(x.cuota, x.suma ? x.foco / x.suma : null); // la cuota en la cohorte, la de bases (R7)
    assert.equal(x.cuota, o.cuota.series.find((y) => y.clave === x.clave).cuota); // entre hermanos, la cohorte es el padre
  }
  // La cuota: lo que mueve el foco ÷ lo que mueven entre todos los hijos de su padre, serie a serie (aquí, sin bases.js).
  const delPadre = (k) => hijos(eje, menu.id).reduce((s, h) => s + (medir(eje, h.id).tokens[k] ?? 0), 0);
  for (const x of o.cuota.series) assert.equal(x.cuota, medir(eje, guisos.id).tokens[x.clave] / delPadre(x.clave), x.clave);
  assert.deepEqual(o.cuota.series.map((x) => [x.clave, x.foco, x.padre, x.cuota]), [['E:casa/EUR', 12, 32, 0.375], ['T:hora', 1, 4, 0.25]]);
  assert.deepEqual([o.cuota.padre, o.cuota.escrita, o.cuota.frescura, o.cuota.incluido], [menu.id, false, SIN_BASE_ESCRITA, true]);
  assert.deepEqual([textoCuota(0.375), textoCuota(0.25), textoCuota(1 / 3), textoCuota(null)], ['37,5 %', '25 %', '33,3 %', '—']);
  // Frente al padre en cualquier cohorte: la de proyecto lee las cantidades del proyecto, pero la cuota sigue siendo la del padre.
  assert.deepEqual(ocho(eje, guisos.id, { alcance: 'proyecto' }).cuota, cuota(eje, guisos.id));
  // Los recuentos: todas las medidas de bases.MEDIDAS, valores de la medida única, sin caja (R7).
  assert.deepEqual(o.recuentos.map((r) => r.clave), MEDIDAS.map((m) => m.clave));
  for (const r of o.recuentos) assert.ok(r.recuento === true && !('caja' in r) && !('cuota' in r), r.clave);
  assert.deepEqual(o.recuentos.map((r) => r.foco), MEDIDAS.map((m) => medir(eje, guisos.id)[m.clave]));
  // La celda enseña cinco, con su nombre corto.
  const celda = recuentosDeCelda(o);
  assert.deepEqual(celda.map((r) => r.clave), RECUENTOS.map((r) => r.clave));
  assert.deepEqual(celda.map((r) => r.etiqueta), ['hilo', 'escritos', 'movimientos', 'posiciones', 'identidades']);
  assert.deepEqual(celda.map((r) => r.valor), RECUENTOS.map((r) => medir(eje, guisos.id)[r.clave]));
  // En el texto: la lectura, las series y, al final, los recuentos marcados como información.
  const lineas = textoOcho(o).split('\n');
  assert.equal(lineas[0], '8 · hermanos · sin base escrita (respaldo al vuelo) · n 4');
  assert.equal(lineas[1], 'E:casa/EUR 12: caja 6 · cuota frente al padre 37,5 %');
  assert.equal(lineas[2], 'T:hora 1: caja 1 · cuota frente al padre 25 %');
  // Fuera de hermanos, también la cuota en la cohorte.
  assert.match(textoOcho(ocho(eje, guisos.id, { alcance: 'general' })), /\nE:casa\/EUR 12: caja 6 · cuota frente al padre 37,5 % · en la cohorte [\d,]+ %\n/);
  assert.equal(lineas[3], 'recuentos (información): hilo 3 · escritos 0 · movimientos 2 · posiciones 5 · identidades 2');
  // En el HTML: cantidades antes que recuentos; los recuentos, aparte y marcados.
  const html = htmlOcho(eje, guisos.id);
  const [i, j] = [html.indexOf('class="ocho-cantidades"'), html.indexOf('class="ocho-recuentos"')];
  assert.ok(i > 0 && j > i, 'cantidades primero, recuentos después');
  assert.match(html, /<li><span class="serie" title="E movido \(EUR de casa\)">E:casa\/EUR<\/span> <b>12<\/b> · caja 6 · <span class="cuota">cuota 37,5 %<\/span><\/li>/);
  assert.match(html, /<div class="ocho-recuentos" title="información: los recuentos no deciden cajas ni criterios"><span class="marca">información<\/span> hilo 3 · escritos 0 · movimientos 2 · posiciones 5 · identidades 2<\/div>$/);
  assert.ok(!/caja \d/.test(html.slice(j)), 'los recuentos no llevan caja');
  // Con la base escrita, la celda la lee y lo dice; las cantidades y la cuota no cambian.
  await escribirBasesDelEjemplo(ej);
  const escrita = ocho(eje, guisos.id);
  assert.equal(escrita.escrita, true);
  assert.match(lecturaOcho(escrita), /^base [0-9a-f]{8} · sin novedades$/);
  assert.deepEqual(escrita.cantidades, o.cantidades);
  assert.deepEqual(escrita.cuota.series, o.cuota.series);
  assert.equal(escrita.cuota.escrita, true);
});

test('medidas perezosas: mapa() sin { medidas: true } no mide; con ella, la medida única del 8, una vez', async () => {
  const { eje, compra, menu } = await ejemploCompra();
  const antes = medicionesPedidas();
  const m = mapa(eje, compra.id);
  mapa(eje, menu.id, { camino: [1] });
  assert.equal(m.medidas, null);
  assert.equal(medicionesPedidas(), antes, 'mapa() sin la opción no llama a medir');
  const conMedidas = mapa(eje, compra.id, { medidas: true });
  assert.equal(medicionesPedidas(), antes + 1);
  const unica = medir(eje, compra.id);
  for (const { clave } of MEDIDAS) assert.equal(conMedidas.medidas[clave], unica[clave], clave);
  assert.deepEqual(conMedidas.medidas.tokens, unica.tokens);
  assert.deepEqual(medidasDe(eje, compra.id), conMedidas.medidas);
  // Lo demás del mapa no cambia por pedir las medidas.
  const { medidas: _a, ...resto1 } = m;
  const { medidas: _b, ...resto2 } = conMedidas;
  assert.deepEqual(resto1, resto2);
  // En el código: mapped.js llama a bases.medir en un solo sitio (medidasDe, que cuenta), y mapa() solo si se pide.
  const fuente = leer('../src/mapped.js');
  assert.equal(fuente.match(/\bmedir\(/g).length, 1);
  assert.match(fuente, /const medidas = pedirMedidas \? medidasDe\(eje, id\) : null;/);
});

test('medidas perezosas: Scened no mide por registro al componer; la suma se pide aparte, con la misma función', async () => {
  const ej = await ejemploComprasHermanas();
  const { eje, guisos } = ej;
  const antes = medicionesPedidas();
  const e = escenaDe(eje, guisos.id, { alcance: 'general', ahora: AHORA });
  assert.equal(e.focos.length, eje.orden.length);
  assert.equal(medicionesPedidas(), antes, 'componer la escena no mide ningún registro');
  assert.equal(e.recuentos.medidas, null);
  assert.ok(e.focos.every((f) => f.mapa.medidas === null));
  assert.match(render(e), /\nmedidas del 8: bajo demanda \(escena con \{ medidas: true \}\)$/);
  // La vista: un botón la pide.
  assert.match(htmlEscena(e), /<button type="button" data-escena-medidas aria-pressed="false" title="[^"]+">medir la escena<\/button>/);
  assert.equal(medicionesPedidas(), antes);
  // Pedida: una medida por foco, la misma que la celda 8 (medidasDe, es decir, bases.medir).
  const pedida = medidasDeEscena(eje, e);
  assert.equal(medicionesPedidas(), antes + e.focos.length);
  for (const { clave } of MEDIDAS) assert.equal(pedida[clave], e.focos.reduce((s, f) => s + medir(eje, f.id)[clave], 0), clave);
  assert.equal(pedida.focos, e.focos.length);
  const conOpcion = escena(eje, e.focos.map((f) => f.id), { ahora: AHORA, medidas: true });
  assert.deepEqual(conOpcion.recuentos.medidas, pedida);
  assert.match(render(conOpcion), new RegExp('\\nmedidas del 8 \\(suma de ' + e.focos.length + ' focos\\): escritos ' + pedida.escritos + ' · movimientos ' + pedida.movimientos + ' · posiciones ' + pedida.posiciones + ' · identidades ' + pedida.identidades + '$'));
  assert.match(vistaEscena(eje, guisos.id, { alcance: 'hermanos', medidas: true }), /<div class="medidas-escena">medidas del 8 \(suma de 4 focos\): escritos \d+ · movimientos \d+/);
  // En el código: Scened no llama a bases.medir; usa medidasDe de Mapped.
  const fuente = leer('../src/scened.js');
  assert.doesNotMatch(fuente, /\bmedir\(/);
  assert.doesNotMatch(fuente, /mapa\.medidas\./);
});

test('una sola verdad: el cielo animado y la celda sobria leen lo mismo, con la misma función', async () => {
  const ej = await ejemploComprasHermanas();
  const { eje } = ej;
  const comprobar = () => {
    for (const foco of [ej.guisos.id, ej.cafe.id, ej.manzanas.id, ej.menu.id]) {
      for (const c of COHORTES) {
        const o = ocho(eje, foco, { alcance: c });
        const d = datosCielo(eje, foco, { cohorte: c });
        const donde = foco.slice(0, 8) + ' ' + c;
        assert.equal(d.escrita, o.escrita, donde);
        assert.equal(d.base.n, o.n, donde);
        assert.equal(d.base.id, o.base, donde);
        assert.equal(d.incluido, o.incluido, donde);
        assert.deepEqual(d.cambiadas, o.cambiadas, donde);
        const deCaja = (x) => [x.clave, x.foco, x.caja, x.cuota, x.cajaCuota, x.enCaja, x.debajo, x.encima, x.n, x.cajas, x.cortes];
        const delCielo = (m) => [m.medida, m.valor, m.caja, m.cuota, m.cajaCuota, m.enCaja, m.debajo, m.encima, m.n, m.cajas, m.cortes];
        const cajas = d.medidas.filter((m) => m.tipo === 'caja');
        assert.deepEqual(cajas.map(delCielo), o.cantidades.map(deCaja), donde);
        assert.deepEqual(d.recuentos.map((r) => [r.medida, r.valor, r.n, r.suma]), o.recuentos.map((r) => [r.clave, r.foco, r.n, r.suma]), donde);
        assert.deepEqual(d.medidas.find((m) => m.tipo === 'pv').cajas, o.posiciones.map((p) => p.comparables), donde);
      }
    }
  };
  comprobar(); // sin bases: los dos, el mismo respaldo al vuelo
  await escribirBasesDelEjemplo(ej);
  comprobar(); // con bases: los dos, la base escrita
  // En el código: el cielo lee con mapped.ocho y ya no llama a situar por su cuenta.
  const fuente = leer('../antigua/mundos/cielo.js');
  assert.match(fuente, /import \{ ocho \} from '\.\.\/\.\.\/src\/mapped\.js';/);
  assert.match(fuente, /const o = ocho\(eje, foco, \{ alcance: cohorte, epoca \}\);/);
  assert.doesNotMatch(fuente, /\bsituar\(/);
});

test('celda 8 a 400 px: todo envuelve, sin scroll horizontal; la app la pinta con ui/ocho.js y no mide en mapa()', async () => {
  const html = leer('../antigua/index.html');
  assert.match(html, /\.matriz\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(html, /\.celda\{min-width:0;[^}]*overflow:hidden/);
  assert.match(html, /\.ocho-cohortes\{display:flex;flex-wrap:wrap;[^}]*min-width:0\}/);
  assert.match(html, /\.ocho-cohortes button\{[^}]*max-width:100%;overflow-wrap:anywhere\}/);
  for (const clase of ['ocho-donde', 'ocho-cantidades', 'ocho-recuentos', 'medidas-escena']) assert.match(html, new RegExp('\\.' + clase + '\\{[^}]*overflow-wrap:anywhere'), clase);
  // Nada largo sin cortar: ningún id entero en el texto. Encargo 3b: ya no hay P del génesis (mapa §15 [D]); la serie
  // de la casa que se ve es su R, que emite al empezar y guarda en sus invitaciones.
  const ej = await ejemploComprasHermanas();
  const celda = htmlOcho(ej.eje, ej.guisos.id, { alcance: 'general' });
  assert.match(celda, />R:casa<\/span>/);
  assert.match(celda, />tiempo:minuto<\/span>/); // el T consumido sobre el registro, tal cual
  assert.match(celda, /<span class="cuota">cuota 37,5 %<\/span> · <span class="cuota">[\d,]+ % en todo el eje<\/span>/);
  assert.doesNotMatch(celda.replace(/<[^>]+>/g, ' '), /[0-9a-f]{9,}/);
  // app.js: la celda 8 la pinta htmlOcho al pintarse; mapa() se pide sin medidas.
  const app = leer('../antigua/app.js');
  assert.match(app, /htmlOcho\(estado\.eje, m\.foco, \{ epoca: epocaActual\(\) \}\)/);
  assert.match(app, /instalarOcho\(\{ pintar \}\)/);
  assert.match(app, /mapped\.mapa\(estado\.eje, estado\.foco, \{ camino: estado\.camino, epoca: epocaActual\(\) \}\)/);
  assert.doesNotMatch(app, /m\.medidas|mapped\.ocho\(/);
});
