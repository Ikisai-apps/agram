import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { verEn, nombreMundo } from '../src/efectos.js';
import { INSPECCIONAR, htmlEstructura, htmlCentro, htmlCruz } from '../mundos/cruz.js';
import { datosHilos, svgHilos } from '../mundos/hilos.js';
import { datosCielo, svgCielo } from '../mundos/cielo.js';
import { datosCamino, svgCamino } from '../mundos/camino.js';

test('el 5: el registro como JSON plegable, con sus campos en orden y las referencias navegables', async () => {
  const { eje, compra, menu } = await ejemploCompra();
  const cuenta = await ejemploCuenta(eje, compra);
  const ev = eje.obtener(compra.id);
  const existe = (id) => Boolean(eje.obtener(id));
  const html = htmlEstructura(ev, { existe });
  assert.equal(htmlEstructura(ev, { existe }), html, 'determinista');
  assert.ok(html.startsWith('<div class="js-arbol"><details class="js-nodo" open><summary><span class="js-clave">registro</span>'));
  const claves = [...html.matchAll(/<span class="js-clave">([a-z]+)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(claves.slice(0, 7), ['registro', 'id', 'autor', 'sobre', 'en', 't', 'movimientos']);
  assert.deepEqual(claves.filter((c) => ['id', 'autor', 'sobre', 'en', 't', 'movimientos', 'contexto', 'payload'].includes(c)).slice(0, 8), ['id', 'autor', 'sobre', 'en', 't', 'movimientos', 'contexto', 'payload']);
  // El payload empieza abierto; lo demás, plegado.
  assert.match(html, /<details class="js-nodo" open><summary><span class="js-clave">payload<\/span><span class="js-resumen">\[5\]<\/span>/);
  assert.match(html, /<details class="js-nodo"><summary><span class="js-clave">movimientos<\/span>/);
  // Referencias del payload y el id de `sobre` llevan a su registro.
  assert.ok(html.includes(`data-ir="${menu.id}" data-dir="1000000000"`));
  assert.ok(html.includes(`<button class="js-ref" data-ir="${menu.id}" title="ir a ${menu.id}">"${menu.id.slice(0, 8)}…"</button>`));
  // Sin `existe`, nada es botón.
  assert.ok(!htmlEstructura(ev).includes('data-ir'));
  // Las fórmulas y los textos se escapan; lo largo se recorta con el texto entero en el título.
  const hc = htmlEstructura(eje.obtener(cuenta.id), { existe });
  assert.ok(hc.includes('&quot;=REF(\\&quot;'));
  const largo = htmlEstructura({ id: 'x', autor: 'a', payload: ['<b>' + 'm'.repeat(100)] });
  assert.ok(!largo.includes('<b>') && largo.includes('&lt;b&gt;') && largo.includes('title="&lt;b&gt;mmm'));
  assert.ok(htmlEstructura({ id: 'x', autor: 'a', payload: [], contexto: {} }).includes('<span class="js-vacio">[ ]</span>'));
});

test('la cruz: el 5 en el centro, el cielo arriba, los hilos a los lados y el camino abajo', async () => {
  const { eje, compra } = await ejemploCompra();
  const ev = eje.obtener(compra.id);
  const datos = datosHilos(eje, compra.id, { ahora: '2026-11-07T15:00:00Z' });
  const partes = {
    c8: svgCielo(datosCielo(eje, compra.id)),
    c6: svgHilos(datos, { ventana: 'pasado', compacto: true }),
    c5: htmlCentro(ev, { lente: 'Compra del menú del día' }),
    c7: svgHilos(datos, { ventana: 'futuro', compacto: true }),
    c9: svgCamino(datosCamino(eje, compra.id)),
  };
  const html = htmlCruz(partes);
  const brazos = [...html.matchAll(/<div class="brazo b(\d)" data-mundo="(\d)"><div class="brazo-cab">([^<]+)<\/div>/g)];
  assert.deepEqual(brazos.map((b) => Number(b[1])), [8, 6, 5, 7, 9]);
  assert.deepEqual(brazos.map((b) => b[3]), [8, 6, 5, 7, 9].map((pv) => pv + ' ' + nombreMundo(pv)));
  for (const [clave, parte] of Object.entries(partes)) assert.ok(html.includes(parte), clave);
  assert.ok(html.indexOf('svg class="cielo') < html.indexOf('class="centro5"') && html.indexOf('class="centro5"') < html.indexOf('svg class="camino'));
  assert.match(partes.c5, new RegExp(`<div class="centro5" data-mundo="5" data-efecto="${INSPECCIONAR}">`));
  assert.equal(INSPECCIONAR, verEn({ tipo: 'escrito' }, 5).nombre);
});
