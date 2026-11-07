import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { consolidar, autorizar, ejecutar } from '../src/motor.js';
import {
  BANDAS, RAZON, EFECTOS, anchosDeBanda, distanciaAlPresente, datosHilos, svgHilos, htmlHilos, memoria, nombreToken,
} from '../mundos/hilos.js';

const AHORA = '2026-11-07T15:00:00Z';
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

/** Todos los valores de un atributo en el SVG, en orden. */
const valores = (svg, atributo) => [...svg.matchAll(new RegExp(`${atributo}="([^"]*)"`, 'g'))].map((m) => m[1]);
/** Etiquetas de apertura de los elementos que llevan data-evento = id. */
const elementosDe = (svg, id) => [...svg.matchAll(new RegExp(`<[a-z]+ [^>]*data-evento="${id}"[^>]*>`, 'g'))].map((m) => m[0]);

/** El ciclo entero sobre la compra: cuenta, una proyección, una consolidación ejecutada, otra autorizada y otra pendiente. */
async function ciclo() {
  const { eje, compra, menu, alta } = await ejemploCompra();
  const cuenta = await ejemploCuenta(eje, compra);
  const viernes = await eje.escribir({ autor: 'huesped', sobre: compra.id, en: '7000000000', t: '2026-11-13T13:30:00Z', movimientos: [gastaT('huesped')], payload: 'repetir el viernes' });
  const hecha = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: '2026-11-07T14:20:00Z', elecciones: { 1: 'dos menús' }, titulo: 'Pedir dos' });
  const aut = await autorizar(eje, { autorizante: 'casa', consolidacion: hecha.id, t: '2026-11-07T14:25:00Z' });
  const ejec = await ejecutar(eje, { autor: 'huesped', consolidacion: hecha.id, t: '2026-11-07T14:40:00Z', movimientos: [{ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 12, de: 'huesped', a: 'cocina' }] });
  const autorizada = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: '2026-11-07T14:50:00Z', elecciones: { 1: 'agua' }, titulo: 'Agua' });
  const aut2 = await autorizar(eje, { autorizante: 'casa', consolidacion: autorizada.id, t: '2026-11-07T14:55:00Z' });
  const pendiente = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: '2026-11-07T14:58:00Z', elecciones: { 1: 'postre <y> "café"' }, titulo: 'Postre & café' });
  return { eje, compra, menu, alta, cuenta, viernes, hecha, aut, ejec, autorizada, aut2, pendiente };
}

test('bandas: cada una 2/3 de la interior, suman la mitad, y la distancia crece con el tiempo', () => {
  const a = anchosDeBanda(188);
  assert.equal(a.length, BANDAS.length);
  assert.equal(BANDAS[0], 'segundo');
  assert.equal(BANDAS.at(-1), 'mas');
  for (let i = 1; i < a.length; i++) assert.ok(Math.abs(a[i] / a[i - 1] - RAZON) < 1e-9);
  assert.ok(Math.abs(a.reduce((x, y) => x + y, 0) - 188) < 1e-9);
  const tiempos = [0, 0.5, 1, 30, 60, 600, 3600, 7200, 86400, 86400 * 10, 86400 * 100, 86400 * 400, 86400 * 4000];
  const d = tiempos.map((s) => distanciaAlPresente(-s, 188));
  for (let i = 1; i < d.length; i++) assert.ok(d[i] >= d[i - 1], 'monótona en ' + tiempos[i]);
  assert.equal(distanciaAlPresente(3600, 188), distanciaAlPresente(-3600, 188)); // pasado y futuro, simétricos
  assert.ok(d.at(-1) <= 188);
  assert.equal(distanciaAlPresente(Number.NaN, 188), 188);
  // Lo cercano tiene más espacio: el primer minuto ocupa más que el último año.
  assert.ok(distanciaAlPresente(60, 188) > 188 - distanciaAlPresente(86400 * 28, 188));
});

test('datos: el mismo eje temporal que el sobrio, con hilos por referencia, autorización y anclas', async () => {
  const { eje, compra, menu, alta, cuenta, viernes, hecha, aut, ejec, autorizada, aut2, pendiente } = await ciclo();
  const d = datosHilos(eje, compra.id, { ahora: AHORA });
  assert.equal(d.foco.id, compra.id);
  assert.equal(d.foco.sobre, menu.id);
  // Pasado: el hilo hacia el génesis (en el carril del eje) y lo escrito sobre el foco.
  const porId = Object.fromEntries(d.pasado.map((p) => [p.id, p]));
  assert.ok(porId[menu.id].hilo && porId[alta.id].hilo && porId[eje.genesisId].hilo);
  assert.ok(porId[eje.genesisId].genesis);
  assert.equal(porId[cuenta.id].hilo, false);
  assert.equal(porId[cuenta.id].sobre, compra.id);
  assert.equal(porId[pendiente.id].fase, 'consolidado');
  assert.equal(porId[menu.id].sobre, alta.id);
  // Futuro: la consolidación pendiente, la proyección del viernes; la ejecutada ya no está.
  assert.deepEqual(d.futuro.map((f) => f.tipo).sort(), ['consolidacion', 'consolidacion', 'proyeccion']);
  const cons = Object.fromEntries(d.futuro.filter((f) => f.tipo === 'consolidacion').map((f) => [f.id, f]));
  assert.equal(cons[pendiente.id].estado, 'PENDIENTE DE AUTORIZACIÓN');
  assert.equal(cons[pendiente.id].autorizacion, undefined);
  assert.equal(cons[autorizada.id].estado, 'AUTORIZADO');
  assert.equal(cons[autorizada.id].autorizacion.id, aut2.id);
  assert.equal(d.futuro.find((f) => f.tipo === 'proyeccion').id, viernes.id);
  assert.ok(!d.futuro.some((f) => f.id === hecha.id));
  // La ejecución ancla la consolidación, con su autorización como evidencia y sus tokens.
  assert.equal(d.anclas.length, 1);
  assert.equal(d.anclas[0].id, ejec.id);
  assert.equal(d.anclas[0].consolidacion, hecha.id);
  assert.equal(d.anclas[0].autorizacion, aut.id);
  assert.equal(d.anclas[0].pendiente, 20 * 60);
  assert.deepEqual(d.anclas[0].movimientos.map((m) => m.token), ['T', 'E']);
  assert.deepEqual(d.identidades, ['casa', 'cocina', 'huesped']);
  assert.ok(d.orden[ejec.id] > d.orden[aut.id] && d.orden[aut.id] > d.orden[hecha.id]);
});

test('svg: función pura sin DOM, cada elemento con su evento y su efecto, en las tres ventanas', async () => {
  const { eje, compra, cuenta, viernes, pendiente, ejec } = await ciclo();
  const d = datosHilos(eje, compra.id, { ahora: AHORA });
  const todo = svgHilos(d);
  assert.ok(todo.startsWith('<svg class="hilos" viewBox="0 0 400 '));
  assert.ok(todo.endsWith('</svg>'));
  assert.ok(!/NaN|undefined|Infinity/.test(todo), 'sin números rotos');
  assert.equal(svgHilos(d), todo, 'determinista');
  // Cada registro, arco y ancla lleva data-evento y data-efecto.
  for (const p of d.pasado) assert.ok(elementosDe(todo, p.id).some((e) => e.includes('data-efecto="entra por la izquierda"')), 'registro ' + p.id.slice(0, 8));
  assert.ok(elementosDe(todo, pendiente.id).some((e) => e.includes('data-efecto="arco al futuro"') && e.includes('futuro consolidacion pendiente')));
  assert.ok(elementosDe(todo, viernes.id).some((e) => e.includes('data-efecto="arco al futuro"') && e.includes('futuro proyeccion')));
  assert.ok(elementosDe(todo, ejec.id).some((e) => e.includes('data-efecto="ancla"') && e.includes('class="ancla"')));
  assert.ok(elementosDe(todo, cuenta.id).every((e) => !e.includes('nuevo')), 'sin nuevos, nada se anima');
  assert.ok(valores(todo, 'data-efecto').every((n) => n.length > 0));
  // Lo que el corpus no nombra va marcado.
  assert.ok(valores(todo, 'data-decision').every((x) => x.startsWith('[X] decidir VG')));
  // Las celdas de Mapped: la mitad del pasado y la del futuro, sin carteras ni rótulos.
  const pasado = svgHilos(d, { ventana: 'pasado', compacto: true });
  const futuro = svgHilos(d, { ventana: 'futuro', compacto: true });
  assert.ok(pasado.includes('viewBox="0 0 200 ') && futuro.includes('viewBox="200 0 200 '));
  assert.ok(pasado.includes(`data-evento="${cuenta.id}"`) && !pasado.includes('class="futuro '));
  assert.ok(futuro.includes('class="futuro ') && !futuro.includes('class="nodo '));
  assert.ok(!pasado.includes('class="cartera') && !futuro.includes('<text') && !pasado.includes('<text'));
  assert.throws(() => svgHilos(d, { ventana: 'otra' }), /ventana desconocida/);
  // Los textos del dato se escapan.
  assert.ok(todo.includes('Postre &amp; café') && !todo.includes('<y>'));
});

test('animación: solo lo nuevo se anima, cada efecto con su clase, y los tokens van de «de» a «a»', async () => {
  const { eje, compra, cuenta, pendiente, hecha, ejec, aut, autorizada, aut2 } = await ciclo();
  const d = datosHilos(eje, compra.id, { ahora: AHORA });
  const nuevos = new Set([cuenta.id, pendiente.id, ejec.id, aut.id, aut2.id]);
  const svg = svgHilos(d, { nuevos });
  assert.ok(elementosDe(svg, cuenta.id).some((e) => e.includes('nuevo entra')), 'un registro nuevo entra por la izquierda');
  assert.ok(elementosDe(svg, cuenta.id).some((e) => e.includes('hilo nuevo traza')), 'y su hilo se traza');
  assert.ok(elementosDe(svg, pendiente.id).some((e) => e.includes('nuevo proyecta')), 'una consolidación nueva se proyecta a la derecha');
  assert.ok(elementosDe(svg, aut2.id).some((e) => e.includes('nudo nuevo anuda') && e.includes('data-efecto="autorizar"')), 'una autorización anuda su arco');
  assert.ok(elementosDe(svg, autorizada.id).some((e) => e.includes('futuro consolidacion autorizado') && !e.includes('nuevo')));
  assert.ok(elementosDe(svg, ejec.id).some((e) => e.includes('class="suelta nuevo"')), 'al ejecutar, el arco suelta el futuro');
  assert.ok(elementosDe(svg, ejec.id).some((e) => e.includes('ancla nuevo ancla-cae')), 'y se ancla');
  // Tokens de la ejecución: un minuto de T consumido (al ∅) y 12 EUR de huesped a cocina.
  const puntos = elementosDe(svg, ejec.id).filter((e) => e.includes('class="punto'));
  assert.equal(puntos.length, 2);
  assert.ok(puntos.some((e) => e.includes('data-efecto="consumir T"') && e.includes('data-de="huesped"') && e.includes('data-a="∅"')));
  assert.ok(puntos.some((e) => e.includes('data-efecto="mover E"') && e.includes('token-E') && e.includes('data-a="cocina"')));
  // Los retardos siguen el orden de entrada en el eje.
  const retardo = (id) => Number(/--retardo:([\d.]+)s/.exec(elementosDe(svg, id).find((e) => e.includes('--retardo')))[1]);
  assert.ok(retardo(cuenta.id) < retardo(ejec.id) && retardo(ejec.id) < retardo(aut2.id) && retardo(aut2.id) < retardo(pendiente.id));
  // En las celdas compactas no hay carteras ni puntos; el ancla cae en la del pasado y el arco suelta en la del futuro.
  const p6 = svgHilos(d, { ventana: 'pasado', compacto: true, nuevos });
  const p7 = svgHilos(d, { ventana: 'futuro', compacto: true, nuevos });
  assert.ok(!p6.includes('class="punto') && !p7.includes('class="punto'));
  assert.ok(p6.includes('ancla-cae') && !p6.includes('class="suelta'));
  assert.ok(p7.includes('class="suelta nuevo"') && !p7.includes('ancla-cae'));
  // Al reproducir, el arco de la consolidación ejecutada primero se proyecta y después se suelta.
  const repr = svgHilos(d, { nuevos: new Set(eje.orden) });
  assert.match(repr, new RegExp(`<g class="nuevo proyecta" [^>]*data-evento="${hecha.id}"[^>]*><path class="suelta nuevo"`));
  assert.ok(!svg.includes('<g class="nuevo proyecta"'), 'sin la consolidación entre los nuevos, el arco ya estaba');
  // Sin la ejecución entre los nuevos, el arco no se suelta: ya estaba anclado.
  assert.ok(!svgHilos(d, { nuevos: new Set([cuenta.id]) }).includes('class="suelta'));
});

test('memoria: la primera mirada no anima; después, solo lo que entra; reproducir cuenta todo en su orden', async () => {
  const { eje, compra } = await ejemploCompra();
  const m = memoria();
  assert.equal(m.nuevos(eje).size, 0);
  assert.equal(m.nuevos(eje).size, 0);
  const cuenta = await ejemploCuenta(eje, compra);
  assert.deepEqual([...m.nuevos(eje)], [cuenta.id]);
  assert.equal(m.nuevos(eje).size, 0, 'lo ya visto no vuelve a animarse');
  assert.equal(m.nuevos(eje, { reproducir: true }).size, eje.orden.length);
  const otro = (await ejemploCompra()).eje;
  assert.equal(m.nuevos(otro).size, 0, 'otro eje: primera mirada');
});

test('vista completa: SVG con leyenda y botón de reproducir; nombres de efecto y de tokens', async () => {
  const { eje, compra } = await ejemploCompra();
  const html = htmlHilos(datosHilos(eje, compra.id, { ahora: AHORA }));
  assert.ok(html.startsWith('<figure class="hilos-vista"><svg class="hilos"'));
  assert.ok(html.includes('data-reproducir') && html.includes('hilos-leyenda'));
  assert.ok(html.includes('class="cartera vacio"'), 'el ∅ de emitir y consumir');
  assert.equal(nombreToken({ token: 'T', de: 'a', a: null }), 'consumir T');
  assert.equal(nombreToken({ token: 'E', de: null, a: 'casa' }), 'emitir E');
  assert.equal(nombreToken({ token: 'P', de: 'casa', a: 'cocina' }), 'mover P');
  // Otro catálogo puede dar los nombres.
  const svg = svgHilos(datosHilos(eje, compra.id, { ahora: AHORA }), { nombrar: (clave) => (clave === 'registro' ? 'llega' : null) });
  assert.ok(svg.includes('data-efecto="llega"'));
});

// La PR #45 trae src/efectos.js con el catálogo de efectos. Cuando esté en main,
// los nombres de este mundo deben ser los suyos vistos desde los mundos 6 y 7.
const conCatalogo = existsSync(new URL('../src/efectos.js', import.meta.url));
test('los nombres coinciden con el catálogo de efectos (src/efectos.js)', { skip: conCatalogo ? false : 'src/efectos.js aún no está en main (PR #45)' }, async () => {
  const ef = await import('../src/efectos.js');
  for (const [clave, e] of Object.entries(EFECTOS)) {
    const visto = ef.verEn({ tipo: e.tipo, ...(e.fase ? { fase: e.fase } : {}) }, e.mundo);
    const esperado = visto?.nombre ?? ef.CATALOGO.tipos.fase.generico[e.fase];
    assert.equal(e.nombre, esperado, clave);
  }
  for (const [mov, nombre] of Object.entries(ef.CATALOGO.tipos.token.generico)) {
    assert.equal(nombreToken({ token: 'T', de: mov === 'emitir' ? null : 'x', a: mov === 'consumir' ? null : 'y' }), nombre + ' T');
  }
});
