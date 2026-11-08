import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';
import { consolidar, proponer } from '../src/motor.js';
import { crearUi, piezasCruz, previaVigente, marcaDe, datosCaminoDe } from '../mundos/cruz-ui.js';
import { lenteDe } from '../mundos/cruz.js';
import { datosCielo } from '../mundos/cielo.js';
import { previsualizar, tituloPropuesta } from '../mundos/camino.js';

const AHORA = '2026-11-07T15:00:00Z';
const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
/** Si algo del texto se anima (una clase de animación de los mundos de la cruz). */
const animaAlgo = (s) => /class="[^"]*(nuevo|nace|recompone)/.test(s);

async function inicio() {
  const { eje, compra, menu } = await ejemploCompra();
  return { eje, compra, menu, estado: { eje, foco: compra.id, camino: [], modo: 'mapped', identidad: 'huesped' } };
}

test('la cruz entra con Mapped, no como modo; en sobrio, las celdas 8 y 9 solo añaden «ver la cruz»', async () => {
  const { estado } = await inicio();
  const ui = crearUi();
  assert.equal(piezasCruz({ ...estado, modo: 'pointed' }, ui), null, 'fuera de Mapped no se pone nada');
  const p = piezasCruz(estado, ui, { ahora: AHORA });
  assert.equal(p.celda8, '<button class="ver-hilos" data-cruz-vista aria-expanded="false">ver la cruz</button>');
  assert.equal(p.celda9, p.celda8);
  assert.equal(p.vista, null);
  // Abierta en sobrio: la tabla del cielo, las listas de los hilos, el 5 y los pasos sin dibujos.
  ui.vista = true;
  const v = piezasCruz(estado, ui, { ahora: AHORA, mensajes: () => '<div class="exito">hecho</div>' }).vista;
  assert.match(v, /^<section class="cruz-completa"/);
  assert.ok(v.includes('render sobrio') && v.includes('<div class="exito">hecho</div>'));
  assert.ok(v.includes('class="cielo-sobrio"') && v.includes('class="centro5"') && v.includes('class="camino-vista"'));
  assert.ok(!v.includes('<svg'), 'el sobrio no dibuja');
  assert.ok(v.includes('data-cruz-vista aria-expanded="true">cerrar la cruz'));
  assert.ok(v.indexOf('class="brazo b8"') < v.indexOf('class="brazo b6"') && v.indexOf('class="brazo b5"') < v.indexOf('class="brazo b9"'));
});

test('animado: el cielo y la senda en las celdas 8 y 9; la primera mirada no anima y lo escrito después sí', async () => {
  const { eje, compra, estado } = await inicio();
  const ui = crearUi();
  const primera = piezasCruz(estado, ui, { animado: true, ahora: AHORA });
  assert.ok(primera.celda8.includes('<svg class="cielo compacto') && /data-cohorte="proyecto" title="cohorte: hermanos, proyecto, general">→ proyecto</.test(primera.celda8));
  assert.ok(primera.celda8.startsWith('<div class="nota-celda">hermanos · sin base escrita</div>'));
  assert.ok(primera.celda9.includes('<svg class="camino compacto"') && primera.celda9.includes('data-cruz-vista'));
  assert.ok(!animaAlgo(primera.celda8) && !animaAlgo(primera.celda9), 'la primera mirada no anima');
  const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: '2026-11-07T15:10:00Z', elecciones: { 1: 'agua' }, titulo: 'Agua' });
  ui.vista = true;
  const segunda = piezasCruz(estado, ui, { animado: true, ahora: AHORA });
  assert.match(segunda.celda9, new RegExp(`class="paso tipo-autorizar nuevo aparece" [^>]*data-evento="${c.id}"`));
  assert.match(segunda.vista, new RegExp(`class="paso tipo-autorizar nuevo aparece" [^>]*data-evento="${c.id}"`), 'los brazos leen la misma mirada');
  assert.ok(segunda.vista.includes('<svg class="hilos compacto"') && segunda.vista.includes('<figure class="cielo-vista">'));
  const tercera = piezasCruz(estado, ui, { animado: true, ahora: AHORA });
  assert.ok(!animaAlgo(tercera.celda9) && !animaAlgo(tercera.vista), 'ya visto: no se repite');
});

test('cambiar de cohorte recompone el cielo una vez: es lectura y se consume al pintar', async () => {
  const { eje, compra, estado } = await inicio();
  const ui = crearUi();
  piezasCruz(estado, ui, { animado: true, ahora: AHORA });
  ui.cieloAnterior = datosCielo(eje, compra.id, { cohorte: 'hermanos' });
  ui.cohorte = 'general';
  const p = piezasCruz(estado, ui, { animado: true, ahora: AHORA });
  assert.ok(p.celda8.includes('recompone') && p.celda8.includes('data-transicion="cohorte"'));
  assert.equal(ui.cieloAnterior, null);
  assert.ok(!piezasCruz(estado, ui, { animado: true, ahora: AHORA }).celda8.includes('recompone'));
  // En sobrio no se anima y la lectura anterior también se olvida.
  ui.cieloAnterior = datosCielo(eje, compra.id, { cohorte: 'hermanos' });
  assert.ok(!piezasCruz(estado, ui, { ahora: AHORA }).celda8.includes('recompone'));
  assert.equal(ui.cieloAnterior, null);
});

test('una previsualización vale solo para el eje, el foco, el camino y quien mira sobre los que se hizo', async () => {
  const { eje, compra, menu, estado } = await inicio();
  const ui = crearUi();
  const p = await previsualizar(eje, datosCaminoDe(estado), 'propuesta', { t: AHORA });
  ui.previa = { ...p, marca: marcaDe(estado) };
  assert.equal(previaVigente(ui, estado)?.clave, 'propuesta');
  ui.vista = true;
  const abierta = piezasCruz(estado, ui, { animado: true, ahora: AHORA });
  assert.ok(abierta.vista.includes('class="previa"') && abierta.celda9.includes('class="paso tipo-propuesta previsto"'));
  assert.ok(abierta.celda9.includes('<circle class="marca-previa"'), 'marcada quieta');
  for (const otro of [{ ...estado, identidad: 'casa' }, { ...estado, foco: menu.id }, { ...estado, camino: [1] }]) {
    const u = { ...ui, previa: ui.previa };
    assert.equal(previaVigente(u, otro), null);
  }
  // Se escribe algo desde cualquier sitio (aquí, Pointed): la previsualización se descarta.
  await eje.escribir({ autor: 'huesped', sobre: compra.id, t: '2026-11-07T15:20:00Z', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'huesped', a: null }], payload: 'pan del día' });
  const despues = piezasCruz(estado, ui, { animado: true, ahora: AHORA });
  assert.equal(ui.previa, null);
  assert.ok(!despues.vista.includes('class="previa"') && !despues.celda9.includes('previsto'));
  ui.previa = { clave: 'propuesta' };
  assert.equal(previaVigente(ui, estado), null, 'sin marca no vale');
});

test('la propuesta consolidada desde la cruz no vuelve a salir como paso', async () => {
  const { eje, compra, estado } = await inicio();
  const antes = datosCaminoDe(estado);
  assert.ok(antes.pasos.some((p) => p.tipo === 'propuesta') && antes.propuestaConsolidada === null);
  const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, elecciones: proponer(eje, compra.id).elecciones, titulo: tituloPropuesta(eje, compra.id), t: AHORA });
  const d = datosCaminoDe(estado);
  assert.ok(!d.pasos.some((p) => p.tipo === 'propuesta'));
  assert.deepEqual(d.propuestaConsolidada, { evento: c.id, estado: 'PENDIENTE DE AUTORIZACIÓN', titulo: tituloPropuesta(eje, compra.id) });
});

test('el 5: la lente es la posición 0 en el camino, como la celda 5 de Mapped', async () => {
  const { eje, compra } = await inicio();
  const ev = eje.obtener(compra.id);
  assert.equal(lenteDe(ev), String(ev.payload[0]));
  assert.equal(lenteDe({ payload: 'solo' }), 'solo');
  assert.equal(lenteDe({ payload: [[['a'], ['b']]] }), '[2]');
  assert.equal(lenteDe({ payload: [[['a'], ['b']]] }, [0]), '[1]');
  assert.equal(lenteDe({ payload: [{ ref: 'f'.repeat(64) }] }), '→ffffffff');
  assert.equal(lenteDe({ payload: ['x'] }, [3]), '—');
});

test('app: los ganchos de la cruz van después de los hilos; ningún modo «cruz»', () => {
  const index = leer('../index.html');
  const app = leer('../app.js');
  for (const css of ['cielo', 'camino', 'cruz']) assert.ok(index.includes(`<link rel="stylesheet" href="./mundos/${css}.css">`), css);
  assert.ok(!index.includes('data-modo="cruz"') && !app.includes("'cruz'"), 'la cruz no es un modo');
  assert.match(app, /import \{ instalarCruz, trasPintarCruz \} from '\.\/mundos\/cruz-ui\.js';/);
  assert.match(app, /instalarCruz\(\{ estado, pintar, irA, privadaDe, guardar, fallo, chip: chipTemporal, mensajes \}\)/);
  assert.match(app, /trasPintarHilos\(estado\);[^\n]*\n\s+trasPintarCruz\(estado\);/);
  // Las animaciones de la cruz son transiciones: ninguna en bucle.
  for (const css of ['cielo', 'camino', 'cruz']) assert.ok(!/infinite/.test(leer(`../mundos/${css}.css`)), css);
});
