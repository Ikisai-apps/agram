import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');

test('app.js conserva los ganchos de ui/ y de los mundos, en su orden: hilos, cruz y X', () => {
  const app = leer('../antigua/app.js');
  for (const g of ['instalarHilos(', 'trasPintarHilos(estado)', 'instalarCruz(', 'trasPintarCruz(estado)', 'instalarX(', 'trasPintarX(estado)',
    'instalarEncaje(', 'instalarFabrica(', 'trasPintarFabrica(estado)', 'instalarEpocas(', 'trasPintarEpocas()', 'instalarEjemplos(', 'trasPintarEjemplos(estado)']) {
    assert.ok(app.includes(g), 'falta el gancho ' + g);
  }
  assert.ok(app.indexOf('trasPintarHilos(estado)') < app.indexOf('trasPintarCruz(estado)'), 'la cruz lee el render que ponen los hilos');
  assert.ok(app.indexOf('trasPintarCruz(estado)') < app.indexOf('trasPintarX(estado)'), 'la X se abre debajo de la cruz');
  assert.match(app, /class="celda esquina c\$\{i\}/, 'las celdas 1–4 llevan su número de clase');
  const html = leer('../antigua/index.html');
  for (const css of ['ui/ui.css', 'mundos/hilos.css', 'mundos/cielo.css', 'mundos/camino.css', 'mundos/cruz.css', 'mundos/x.css']) {
    assert.ok(html.includes(`href="./${css}"`), 'falta ' + css);
  }
});
