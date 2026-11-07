import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { ejemploReserva } from '../ejemplos/ikisai/reserva-booking.mjs';
import { consolidar, autorizar, ejecutar, liberar, FABRICA } from '../src/motor.js';
import { ejeTemporal } from '../src/tiempo.js';
import { efectosDe, verEn, render, SIN_NOMBRE } from '../src/efectos.js';
import {
  BANDAS, RAZON, TOPE_MAS, PASADO, FUTURO, anchosDeBanda, distanciaAlPresente, geometria,
  datosHilos, svgHilos, htmlHilos, memoria, rotuloToken, efectosNuevos,
} from '../mundos/hilos.js';
import { crearUi, piezasHilos } from '../mundos/hilos-ui.js';

const AHORA = '2026-11-07T15:00:00Z';
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');

/** Etiquetas de apertura de los elementos que llevan data-evento = id. */
const elementosDe = (svg, id) => [...svg.matchAll(new RegExp(`<[a-z]+ [^>]*data-evento="${id}"[^>]*>`, 'g'))].map((m) => m[0]);
/** Todas las etiquetas de apertura con data-efecto. */
const conEfecto = (svg) => [...svg.matchAll(/<[a-z]+ [^>]*data-efecto="[^"]*"[^>]*>/g)].map((m) => m[0]);
const atributo = (etiqueta, nombre) => new RegExp(`${nombre}="([^"]*)"`).exec(etiqueta)?.[1];
/** ¿Se anima algo? Un elemento con la clase «nuevo». */
const animaAlgo = (s) => /class="[^"]*nuevo/.test(s);
const desescapar = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** El efecto con que el catálogo pone un evento en el eje, leído aquí sin pasar por mundos/hilos.js. */
function efectoEnEje(eje, id) {
  const l = efectosDe(eje, id);
  return l.find((e) => e.tipo === 'fase' || e.tipo === 'ruido') ?? l.find((e) => e.tipo !== 'token' && e.ruta.length === 0);
}

/** El ciclo sobre la compra: cuenta, una proyección, una consolidación ejecutada, otra autorizada y otra pendiente. */
async function ciclo() {
  const { eje, compra, menu, alta } = await ejemploCompra();
  const cuenta = await ejemploCuenta(eje, compra);
  const viernes = await eje.escribir({ autor: 'huesped', sobre: compra.id, en: '7000000000', t: '2026-11-13T13:30:00Z', movimientos: [gastaT('huesped')], payload: 'repetir el viernes' });
  const hecha = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: '2026-11-07T14:20:00Z', elecciones: { 1: 'dos menús' }, titulo: 'Pedir dos' });
  const aut = await autorizar(eje, { autorizante: 'casa', consolidacion: hecha.id, t: '2026-11-07T14:25:00Z' });
  const ejec = await ejecutar(eje, { autor: 'huesped', consolidacion: hecha.id, t: '2026-11-07T14:40:00Z', movimientos: [{ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 12, de: 'huesped', a: 'cocina' }] });
  // Autorizar es bloquear P (VG, 7-11 noche): ejecutada, la casa libera el suyo y bloquea 6 de 10 para la siguiente.
  await liberar(eje, { titular: 'casa', consolidacion: hecha.id, t: '2026-11-07T14:45:00Z' });
  const autorizada = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: '2026-11-07T14:50:00Z', elecciones: { 1: 'agua' }, titulo: 'Agua' });
  const aut2 = await autorizar(eje, { autorizante: 'casa', consolidacion: autorizada.id, cantidad: 6, t: '2026-11-07T14:55:00Z' });
  const pendiente = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: '2026-11-07T14:58:00Z', elecciones: { 1: 'postre <y> "café"' }, titulo: 'Postre & café' });
  return { eje, compra, menu, alta, cuenta, viernes, hecha, aut, ejec, autorizada, aut2, pendiente };
}

test('bandas: cada una 2/3 de la interior, suman la mitad, la distancia crece con el tiempo y «más» acaba en diez años', () => {
  const a = anchosDeBanda(188);
  assert.equal(a.length, BANDAS.length);
  assert.equal(BANDAS[0], 'segundo');
  assert.equal(BANDAS.at(-1), 'mas');
  for (let i = 1; i < a.length; i++) assert.ok(Math.abs(a[i] / a[i - 1] - RAZON) < 1e-9);
  assert.ok(Math.abs(a.reduce((x, y) => x + y, 0) - 188) < 1e-9);
  const tiempos = [0, 0.5, 1, 30, 60, 600, 3600, 7200, 86400, 86400 * 10, 86400 * 100, 86400 * 400, 86400 * 4000];
  const d = tiempos.map((s) => distanciaAlPresente(-s, 188));
  for (let i = 1; i < d.length; i++) assert.ok(d[i] > d[i - 1], 'crece en ' + tiempos[i]);
  assert.equal(distanciaAlPresente(3600, 188), distanciaAlPresente(-3600, 188)); // pasado y futuro, simétricos
  assert.equal(distanciaAlPresente(Number.NaN, 188), 188);
  // Lo cercano tiene más espacio: el primer minuto ocupa más que el último año.
  assert.ok(distanciaAlPresente(60, 188) > 188 - distanciaAlPresente(86400 * 28, 188));
  // La banda «más» llega a su borde en TOPE_MAS años, no antes; más allá, en el borde.
  const anio = 365 * 86400;
  assert.ok(distanciaAlPresente(anio * (TOPE_MAS - 1), 188) < 188 - 1e-6);
  assert.ok(Math.abs(distanciaAlPresente(anio * TOPE_MAS * 1.01, 188) - 188) < 1e-9);
  assert.ok(Math.abs(distanciaAlPresente(anio * 1000, 188) - 188) < 1e-9);
});

test('datos: el mismo eje temporal que el sobrio, con los efectos del catálogo y sin la regla del motor copiada', async () => {
  const { eje, compra, menu, alta, cuenta, viernes, hecha, aut, ejec, autorizada, aut2, pendiente } = await ciclo();
  // Una ejecución falsa (no la escribe el autor de la consolidación): es ruido, no ancla.
  const falsa = await eje.escribir({ autor: 'casa', sobre: autorizada.id, en: FABRICA, t: '2026-11-07T14:56:00Z', movimientos: [gastaT('casa')], payload: ['Ejecutado', { ref: autorizada.id }, { ref: aut2.id }], contexto: { motor: 'fabrica', fase: 'ejecutado', evidencia: [autorizada.id, aut2.id] } });
  const d = datosHilos(eje, compra.id, { ahora: AHORA });
  const sobrio = ejeTemporal(eje, compra.id, { ahora: AHORA });
  assert.deepEqual(d.pasado.map((p) => p.id), sobrio.pasado.map((p) => p.id), 'el pasado del sobrio');
  assert.deepEqual(d.futuro.map((f) => f.id + f.tipo), sobrio.futuro.map((f) => f.id + f.tipo), 'el futuro del sobrio');
  assert.equal(d.foco.sobre, menu.id);
  const porId = Object.fromEntries(d.pasado.map((p) => [p.id, p]));
  assert.ok(porId[menu.id].hilo && porId[alta.id].hilo && porId[eje.genesisId].hilo && porId[eje.genesisId].genesis);
  assert.equal(porId[cuenta.id].hilo, false);
  // Cada evento lleva sus efectos del catálogo: el principal, sus tokens y la lista entera.
  for (const p of d.pasado) assert.deepEqual(p.efecto, efectoEnEje(eje, p.id), p.id.slice(0, 8));
  assert.deepEqual(d.efectos[cuenta.id], efectosDe(eje, cuenta.id));
  assert.equal(porId[pendiente.id].efecto.tipo, 'fase');
  assert.equal(porId[pendiente.id].fase, 'consolidado');
  assert.deepEqual(porId[cuenta.id].tokens.map((t) => t.serie), ['T:minuto']);
  // Futuro: la pendiente, la autorizada (con su autorización) y la proyección; la ejecutada ya no.
  const cons = Object.fromEntries(d.futuro.filter((f) => f.tipo === 'consolidacion').map((f) => [f.id, f]));
  assert.equal(cons[pendiente.id].estado, 'PENDIENTE DE AUTORIZACIÓN');
  assert.equal(cons[pendiente.id].autorizacion, undefined);
  assert.equal(cons[autorizada.id].estado, 'AUTORIZADO', 'la ejecución falsa no la ejecuta');
  assert.equal(cons[autorizada.id].autorizacion.id, aut2.id);
  assert.equal(cons[autorizada.id].autorizacion.efecto.fase, 'autorizado');
  assert.equal(d.futuro.find((f) => f.tipo === 'proyeccion').id, viernes.id);
  assert.ok(!(hecha.id in cons));
  // La ejecución ancla, con la autorización que lleva en su evidencia; la falsa no ancla nada.
  assert.equal(d.anclas.length, 1);
  assert.equal(d.anclas[0].id, ejec.id);
  assert.equal(d.anclas[0].consolidacion, hecha.id);
  assert.equal(d.anclas[0].autorizacion, aut.id);
  assert.equal(d.anclas[0].efecto.fase, 'ejecutado');
  assert.ok(!d.anclas.some((a) => a.id === falsa.id));
  assert.equal(efectosDe(eje, falsa.id).at(-1).tipo, 'ruido');
  // Antes de ejecutarse, la consolidación estaba autorizada a la derecha: eso es lo que se suelta.
  assert.equal(d.anclas[0].antes.id, hecha.id);
  assert.equal(d.anclas[0].antes.estado, 'AUTORIZADO');
  assert.equal(d.anclas[0].antes.autorizacion.id, aut.id);
  assert.deepEqual(d.anclas[0].tokens.map((t) => [t.serie, t.de, t.a]), [['T:minuto', 'huesped', null], ['E:casa/EUR', 'huesped', 'cocina']]);
  assert.ok(d.orden[ejec.id] > d.orden[aut.id] && d.orden[aut.id] > d.orden[hecha.id]);
});

test('datos: la autorización de un ancla sale de la evidencia, se lea en el orden que se lea', async () => {
  const { eje, compra } = await ejemploCompra();
  const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: '2026-11-07T14:20:00Z', elecciones: { 1: 'dos menús' }, titulo: 'Pedir dos' });
  const a = await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: '2026-11-07T14:25:00Z' });
  // Una ejecución válida para el motor con la evidencia al revés: [autorización, consolidación].
  const x = await eje.escribir({ autor: 'huesped', sobre: c.id, en: FABRICA, t: '2026-11-07T14:40:00Z', movimientos: [gastaT('huesped')], payload: ['Ejecutado', { ref: a.id }, { ref: c.id }], contexto: { motor: 'fabrica', fase: 'ejecutado', evidencia: [a.id, c.id] } });
  const d = datosHilos(eje, compra.id, { ahora: AHORA });
  assert.equal(d.anclas.length, 1);
  assert.equal(d.anclas[0].id, x.id);
  assert.equal(d.anclas[0].autorizacion, a.id);
});

test('nombres: cada elemento lleva el nombre que le da el catálogo en el mundo donde se dibuja', async () => {
  const { eje, compra, cuenta, viernes, hecha, aut, ejec, aut2, pendiente } = await ciclo();
  const d = datosHilos(eje, compra.id, { ahora: AHORA });
  const svg = svgHilos(d, { nuevos: new Set(eje.orden) });
  assert.ok(!/NaN|undefined|Infinity/.test(svg), 'sin números rotos');
  const etiquetas = conEfecto(svg);
  assert.ok(etiquetas.length > 15);
  const tokensDe = (id) => efectosDe(eje, id).filter((e) => e.tipo === 'token');
  for (const e of etiquetas) {
    const id = atributo(e, 'data-evento');
    const mundo = Number(atributo(e, 'data-mundo'));
    const nombre = desescapar(atributo(e, 'data-efecto'));
    const decision = desescapar(atributo(e, 'data-decision'));
    let efecto;
    if (e.includes('class="punto')) {
      efecto = tokensDe(id).find((t) => t.serie === desescapar(atributo(e, 'data-serie')) && (t.de ?? '∅') === atributo(e, 'data-de') && (t.a ?? '∅') === atributo(e, 'data-a'));
      assert.equal(mundo, efecto.mundo, 'un token se dibuja en su mundo');
    } else {
      efecto = efectoEnEje(eje, id);
      assert.ok(mundo === PASADO || mundo === FUTURO, 'en el eje, el 6 o el 7: ' + e.slice(0, 40));
    }
    const visto = verEn(efecto, mundo);
    assert.equal(nombre, visto?.nombre ?? efecto.nombre, e.slice(0, 60));
    if (visto) assert.equal(decision, visto.decisiones[0]);
    else if (efecto.mundo === mundo) assert.equal(decision, efecto.decisiones[0]);
    else {
      assert.equal(decision, SIN_NOMBRE);
      assert.equal(Number(atributo(e, 'data-nombre-de')), efecto.mundo, 'sin nombre en este mundo: el de su mundo');
    }
  }
  // Con el catálogo de la PR #45, en concreto:
  const de = (id, clase) => elementosDe(svg, id).find((e) => e.includes(`class="${clase}`));
  assert.equal(atributo(de(cuenta.id, 'nodo'), 'data-efecto'), 'entra por la izquierda');
  assert.equal(atributo(de(viernes.id, 'futuro'), 'data-efecto'), 'arco al futuro');
  assert.equal(atributo(de(pendiente.id, 'futuro'), 'data-efecto'), 'arco al futuro');
  assert.equal(atributo(de(pendiente.id, 'nodo'), 'data-efecto'), 'consolidar');
  assert.equal(atributo(de(pendiente.id, 'nodo'), 'data-nombre-de'), '4');
  assert.equal(atributo(de(aut2.id, 'nudo'), 'data-efecto'), 'autorizar');
  assert.equal(atributo(de(aut2.id, 'nudo'), 'data-nombre-de'), '4');
  assert.equal(atributo(de(ejec.id, 'ancla'), 'data-efecto'), 'ancla');
  assert.equal(atributo(de(ejec.id, 'ancla'), 'data-mundo'), '6', 'el ancla cae en el pasado');
  assert.equal(atributo(de(ejec.id, 'suelta'), 'data-mundo'), '7', 'el arco se suelta en el futuro');
  const puntos = elementosDe(svg, ejec.id).filter((e) => e.includes('class="punto'));
  assert.deepEqual(puntos.map((e) => [atributo(e, 'data-efecto'), atributo(e, 'data-mundo'), atributo(e, 'data-serie')]), [
    ['línea que se mueve', '4', 'T:minuto'],
    ['mercancía que fluye', '1', 'E:casa/EUR'],
  ]);
  assert.ok(svg.includes('12 E:casa/EUR'), 'el rótulo lleva la serie entera: emisor y denominación');
  // El texto de cada elemento es el render sobrio del mismo efecto.
  assert.ok(svg.includes(render([efectoEnEje(eje, hecha.id)], 'sobrio')));
  assert.ok(svg.includes(render([efectoEnEje(eje, aut.id)], 'sobrio')));
  assert.ok(svg.includes('Postre &amp; café') && !svg.includes('<y>'), 'los textos del dato se escapan');
});

test('animación: solo lo nuevo, y solo donde el catálogo lo nombra; una consolidación no se anima dos veces', async () => {
  const { eje, compra, cuenta, viernes, pendiente, ejec, aut2, autorizada } = await ciclo();
  const d = datosHilos(eje, compra.id, { ahora: AHORA });
  const nuevos = new Set([cuenta.id, pendiente.id, ejec.id, aut2.id]);
  const svg = svgHilos(d, { nuevos });
  const animados = (id) => elementosDe(svg, id).filter((e) => / nuevo|class="nuevo/.test(atributo(e, 'class')) || atributo(e, 'class').startsWith('suelta nuevo'));
  // Un registro nuevo entra por la izquierda y traza su hilo.
  assert.ok(elementosDe(svg, cuenta.id).some((e) => e.includes('nodo escrito nuevo entra')));
  assert.ok(elementosDe(svg, cuenta.id).some((e) => e.includes('hilo nuevo traza')));
  // Una consolidación nueva: un solo elemento animado, su arco al futuro; en el pasado está quieta.
  const cons = animados(pendiente.id).filter((e) => !e.includes('class="punto'));
  assert.equal(cons.length, 1, 'una consolidación, una animación');
  assert.ok(cons[0].includes('futuro consolidacion pendiente nuevo proyecta'));
  assert.ok(elementosDe(svg, pendiente.id).some((e) => e.includes('class="nodo escrito fase-consolidado"')), 'quieta en el 6');
  // Una autorización nueva: los hilos no la nombran; el nudo aparece quieto.
  assert.ok(elementosDe(svg, aut2.id).some((e) => e.includes('class="nudo"')));
  assert.ok(!svg.includes('anuda'));
  assert.ok(elementosDe(svg, autorizada.id).some((e) => e.includes('futuro consolidacion autorizado') && !e.includes('nuevo')));
  // Una ejecución nueva: se suelta el arco en el 7 y cae el ancla en el 6.
  assert.ok(elementosDe(svg, ejec.id).some((e) => e.includes('class="suelta nuevo"')));
  assert.ok(elementosDe(svg, ejec.id).some((e) => e.includes('ancla nuevo ancla-cae')));
  // Lo que no es nuevo no se mueve.
  assert.ok(!elementosDe(svg, viernes.id).some(animaAlgo));
  // Tokens: los de los eventos nuevos que se ven, y nada más.
  const puntos = conEfecto(svg).filter((e) => e.includes('class="punto'));
  assert.deepEqual([...new Set(puntos.map((e) => atributo(e, 'data-evento')))].sort(), [cuenta.id, pendiente.id, ejec.id, aut2.id].sort());
  // Los retardos siguen el orden de entrada en el eje.
  const retardo = (id) => Number(/--retardo:([\d.]+)s/.exec(elementosDe(svg, id).find((e) => e.includes('--retardo')))[1]);
  assert.ok(retardo(cuenta.id) < retardo(ejec.id) && retardo(ejec.id) < retardo(aut2.id) && retardo(aut2.id) < retardo(pendiente.id));
  // En las celdas compactas no hay carteras ni puntos; el ancla cae en la del pasado y el arco se suelta en la del futuro.
  const c6 = svgHilos(d, { ventana: 'pasado', compacto: true, nuevos });
  const c7 = svgHilos(d, { ventana: 'futuro', compacto: true, nuevos });
  assert.ok(c6.includes('viewBox="0 0 200 ') && c7.includes('viewBox="200 0 200 '));
  assert.ok(!c6.includes('class="punto') && !c7.includes('class="punto') && !c6.includes('class="cartera'));
  assert.ok(c6.includes('ancla-cae') && !c6.includes('class="suelta') && !c6.includes('class="futuro '));
  assert.ok(c7.includes('class="suelta nuevo"') && !c7.includes('ancla-cae') && !c7.includes('class="nodo '));
  // El dibujo es una imagen: nada tocable dentro; se navega con los botones del sobrio.
  for (const s of [svg, c6, c7]) assert.ok(s.includes('role="img"') && !s.includes('data-ir') && !s.includes('tabindex'));
});

test('ejecutar: el arco que se suelta es el de la consolidación, en su carril y en su sitio', async () => {
  // Dos ejes iguales hasta la autorización; en el segundo, además, se ejecuta.
  const preparar = async () => {
    const { eje, compra } = await ejemploCompra();
    // Una consolidación más antigua, que se queda pendiente, ocupa el primer carril del futuro.
    await consolidar(eje, { autor: 'huesped', foco: compra.id, t: '2026-11-07T14:00:00Z', elecciones: { 1: 'agua' }, titulo: 'Agua' });
    const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: '2026-11-07T14:20:00Z', elecciones: { 1: 'dos menús' }, titulo: 'Pedir dos' });
    await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: '2026-11-07T14:25:00Z' });
    await eje.escribir({ autor: 'huesped', sobre: compra.id, en: '7000000000', t: '2026-11-13T13:30:00Z', movimientos: [gastaT('huesped')], payload: 'repetir el viernes' });
    return { eje, compra, c };
  };
  const antes = await preparar();
  const despues = await preparar();
  const x = await ejecutar(despues.eje, { autor: 'huesped', consolidacion: despues.c.id, t: '2026-11-07T14:40:00Z' });
  /** El arco y el bloque de la consolidación c: [d, x, y]. */
  const dibujoDe = (svg, c) => {
    const m = new RegExp(`<g class="futuro consolidacion autorizado" data-evento="${c}"[^>]*><title>[^<]*</title><path class="arco" pathLength="1" d="([^"]*)"/><rect class="bloque" x="([^"]*)" y="([^"]*)"`).exec(svg);
    return m && m.slice(1);
  };
  for (const v of [{ ventana: 'futuro', compacto: true }, { ventana: 'todo' }]) {
    const g = geometria(Boolean(v.compacto));
    const arco = dibujoDe(svgHilos(datosHilos(antes.eje, antes.compra.id, { ahora: AHORA }), v), antes.c.id);
    assert.ok(arco, 'antes de ejecutar, el arco está');
    assert.notEqual(Number(arco[2]) + g.bloque[1] / 2 - g.eje, g.carrilesFuturo[0], 'la prueba exige que no esté en el primer carril');
    const svg = svgHilos(datosHilos(despues.eje, despues.compra.id, { ahora: AHORA }), { ...v, nuevos: new Set([x.id]) });
    const suelta = new RegExp(`<g class="suelta nuevo" data-evento="${x.id}"[^>]*data-consolidacion="${despues.c.id}"[^>]*>`).exec(svg);
    assert.ok(suelta, 'se suelta el arco de la consolidación ejecutada');
    assert.deepEqual(dibujoDe(svg.slice(suelta.index), despues.c.id), arco, 'el mismo arco y el mismo bloque, en el mismo carril');
    // Sin la ejecución entre los nuevos, no se suelta nada: ya estaba anclado.
    assert.ok(!svgHilos(datosHilos(despues.eje, despues.compra.id, { ahora: AHORA }), v).includes('class="suelta'));
  }
});

test('junto al foco: lo del primer segundo se dibuja a la distancia mínima, no encima', async () => {
  const { eje, compra } = await ejemploCompra();
  const casi = await eje.escribir({ autor: 'huesped', sobre: compra.id, t: '2026-11-07T14:59:59.800Z', movimientos: [gastaT('huesped')], payload: 'ahora mismo' });
  const ya = await eje.escribir({ autor: 'huesped', sobre: compra.id, en: '7000000000', t: '2026-11-07T15:00:00.100Z', movimientos: [gastaT('huesped')], payload: 'enseguida' });
  const d = datosHilos(eje, compra.id, { ahora: AHORA });
  for (const compacto of [false, true]) {
    const g = geometria(compacto);
    const svg = svgHilos(d, { compacto });
    const nodo = new RegExp(`<g transform="translate\\(([\\d.]+) [\\d.]+\\)"><g class="nodo[^"]*" data-evento="${casi.id}"`).exec(svg);
    assert.equal(Number(nodo[1]), 200 - g.minimo, 'pasado, compacto=' + compacto);
    const bloque = new RegExp(`data-evento="${ya.id}"[^>]*>(?:<title>[^<]*</title>)<path[^>]*/><rect class="bloque" x="([\\d.]+)"`).exec(svg);
    assert.equal(Number(bloque[1]), 200 + g.minimo, 'futuro, compacto=' + compacto);
    assert.ok(g.minimo > g.r + 4 + g.r - 1, 'no pisa el anillo del foco');
  }
});

test('contadores: lo que no cabe se cuenta con sus eventos; lo nuevo que cae ahí no se anima ni mueve tokens, y el sobrio lo lista', async () => {
  const { eje, compra } = await ejemploCompra();
  const notas = [];
  for (let k = 0; k < 8; k++) {
    notas.push(await eje.escribir({ autor: 'huesped', sobre: compra.id, t: `2026-11-07T14:58:3${k}Z`, movimientos: [gastaT('huesped')], payload: 'nota ' + k }));
  }
  const nuevos = new Set(notas.map((n) => n.id));
  const d = datosHilos(eje, compra.id, { ahora: AHORA });
  for (const compacto of [false, true]) {
    const svg = svgHilos(d, { compacto, ventana: compacto ? 'pasado' : 'todo', nuevos });
    const contadores = [...svg.matchAll(/<g class="contador"[^>]*>/g)].map((m) => m[0]);
    assert.equal(contadores.length, 1, 'un contador en la banda del minuto');
    const ocultos = atributo(contadores[0], 'data-eventos').split(' ');
    assert.equal(ocultos.length, notas.length - geometria(compacto).carrilesPasado.length);
    assert.equal(Number(atributo(contadores[0], 'data-nuevos')), ocultos.length);
    assert.ok(atributo(contadores[0], 'data-decision').startsWith('[X] decidir VG'));
    for (const id of ocultos) {
      assert.ok(nuevos.has(id));
      assert.equal(elementosDe(svg, id).length, 0, 'un oculto no tiene elementos: ni nodo ni tokens');
    }
    const visibles = notas.filter((n) => !ocultos.includes(n.id));
    for (const n of visibles) assert.ok(elementosDe(svg, n.id).some((e) => e.includes('nuevo entra')));
    if (!compacto) {
      const puntos = conEfecto(svg).filter((e) => e.includes('class="punto')).map((e) => atributo(e, 'data-evento'));
      assert.deepEqual(puntos.sort(), visibles.map((n) => n.id).sort(), 'solo se mueven los tokens de lo que se ve');
    }
  }
  // La vista completa lista en sobrio todo lo nuevo, también lo del contador.
  const html = htmlHilos(d, { nuevos });
  const lista = notas.flatMap((n) => efectosDe(eje, n.id));
  assert.deepEqual(efectosNuevos(d, nuevos), lista);
  assert.ok(html.includes('<pre>' + render(lista, 'sobrio').replace(/&/g, '&amp;') + '</pre>'));
});

test('tokens: los movimientos que no caben se cuentan; los rótulos llevan la serie entera', async () => {
  const { eje, compra, ejec, cuenta, pendiente } = await ciclo();
  const d = datosHilos(eje, compra.id, { ahora: AHORA });
  const nuevos = new Set([cuenta.id, ejec.id, pendiente.id]);
  const todos = conEfecto(svgHilos(d, { nuevos })).filter((e) => e.includes('class="punto')).length;
  assert.equal(todos, 4);
  const svg = svgHilos(d, { nuevos, maximoPuntos: 1 });
  assert.equal(conEfecto(svg).filter((e) => e.includes('class="punto')).length, 1);
  const cont = /<g class="contador-tokens"[^>]*>/.exec(svg)[0];
  assert.equal(Number(atributo(cont, 'data-sin-dibujar')), 3);
  assert.ok(atributo(cont, 'data-decision').startsWith('[X] decidir VG'));
  assert.ok(svg.includes('+3 movimientos'));
  // Las series, estandarizadas (mapa §12 [D]): E con su emisor, P con su ámbito, R con su emisor.
  assert.notEqual(rotuloToken({ serie: 'E:casa/EUR', cantidad: 5 }), rotuloToken({ serie: 'E:banco/EUR', cantidad: 5 }));
  assert.equal(rotuloToken({ serie: 'E:casa/EUR', cantidad: 5 }), '5 E:casa/EUR');
  assert.equal(rotuloToken({ serie: 'T:minuto', cantidad: 3 }), '3 T:minuto');
  assert.equal(rotuloToken({ serie: 'P:genesis', cantidad: 1 }), '1 P:genesis');
  assert.equal(rotuloToken({ serie: 'P:' + compra.id, cantidad: 2 }), '2 P:' + compra.id.slice(0, 8));
  assert.equal(rotuloToken({ serie: 'R:casa', cantidad: 4 }), '4 R:casa');
});

test('memoria: la primera mirada no anima; después, solo lo que entra; otro eje es otra primera mirada', async () => {
  const { eje, compra } = await ejemploCompra();
  const m = memoria();
  assert.equal(m.nuevos(eje).size, 0);
  assert.equal(m.nuevos(eje).size, 0);
  const cuenta = await ejemploCuenta(eje, compra);
  assert.deepEqual([...m.nuevos(eje)], [cuenta.id]);
  assert.equal(m.nuevos(eje).size, 0, 'lo ya visto no vuelve a animarse');
  const otro = (await ejemploCompra()).eje;
  assert.equal(m.nuevos(otro).size, 0, 'otro eje: primera mirada');
});

test('vista completa: la leyenda usa los nombres del catálogo y debajo va lo nuevo en sobrio', async () => {
  const { eje, compra, cuenta } = await ciclo();
  const d = datosHilos(eje, compra.id, { ahora: AHORA });
  const html = htmlHilos(d);
  assert.ok(html.startsWith('<figure class="hilos-vista"><svg class="hilos"'));
  assert.ok(html.includes('class="cartera vacio"'), 'el ∅ de emitir y consumir');
  assert.ok(html.includes(verEn({ tipo: 'escrito' }, PASADO).nombre));
  assert.ok(html.includes(verEn({ tipo: 'fase', fase: 'consolidado' }, FUTURO).nombre));
  assert.ok(html.includes('Nada nuevo desde la última mirada'));
  assert.ok(!html.includes('data-reproducir'), 'sin botón de reproducir');
  const conNuevo = htmlHilos(d, { nuevos: new Set([cuenta.id]) });
  assert.ok(conNuevo.includes('<pre>' + render(efectosDe(eje, cuenta.id), 'sobrio') + '</pre>'));
});

test('app: los hilos entran con Mapped, no como modo; el dibujo se pone junto a los botones del sobrio', async () => {
  const { eje, compra } = await ejemploCompra();
  const estado = { eje, foco: compra.id, camino: [], modo: 'mapped' };
  const ui = crearUi();
  assert.equal(piezasHilos(estado, ui, { ahora: AHORA }), null, 'en sobrio no se dibuja');
  ui.render = 'animado';
  assert.equal(piezasHilos({ ...estado, modo: 'pointed' }, ui, { ahora: AHORA }), null, 'fuera de Mapped tampoco');
  const primera = piezasHilos(estado, ui, { ahora: AHORA });
  assert.ok(primera.celda6.startsWith('<svg class="hilos compacto"') && primera.celda6.includes('data-ventana="pasado"'));
  assert.ok(primera.celda7.includes('data-ventana="futuro"'));
  assert.ok(!animaAlgo(primera.celda6) && !animaAlgo(primera.celda7), 'la primera mirada no anima');
  assert.ok(primera.celda6.includes('data-hilos-vista') && primera.vista === null);
  const cuenta = await ejemploCuenta(eje, compra);
  const segunda = piezasHilos(estado, ui, { ahora: AHORA });
  assert.ok(elementosDe(segunda.celda6, cuenta.id).some((e) => e.includes('nuevo entra')), 'lo escrito después entra por la izquierda');
  ui.vista = true;
  const tercera = piezasHilos(estado, ui, { ahora: AHORA });
  assert.ok(tercera.vista.includes('<figure class="hilos-vista">') && tercera.celda6.includes('aria-expanded="true"'));
  assert.ok(!animaAlgo(tercera.vista) && !animaAlgo(tercera.celda6), 'ya visto');
  // app.js e index.html: un botón «animado» y el gancho; ningún modo «hilos».
  const index = leer('../index.html');
  const app = leer('../app.js');
  assert.match(index, /<button data-render aria-pressed="false"[^>]*>animado<\/button>/);
  assert.ok(!index.includes('data-modo="hilos"') && !app.includes("'hilos'"), 'los hilos no son un modo');
  assert.ok(index.includes('<link rel="stylesheet" href="./mundos/hilos.css">'));
  assert.match(app, /import \{ instalarHilos, trasPintarHilos \} from '\.\/mundos\/hilos-ui\.js';/);
  assert.match(app, /instalarHilos\(\{ pintar \}\)/);
  assert.match(app, /pintarSequenced\(\);\n\s+trasPintarHilos\(estado\);/);
});

test('reserva: el render no se rompe con las series de plazas y noches', async () => {
  const { eje, reserva, habitacion } = await ejemploReserva();
  for (const foco of [reserva.id, habitacion.id]) {
    const d = datosHilos(eje, foco, { ahora: '2026-11-10T12:00:00Z' });
    const svg = svgHilos(d, { nuevos: new Set(eje.orden) });
    assert.ok(svg.endsWith('</svg>') && !/NaN|undefined|Infinity/.test(svg));
    for (const e of conEfecto(svg).filter((x) => x.includes('class="punto'))) assert.ok(atributo(e, 'data-serie').startsWith('E:') || atributo(e, 'data-serie').startsWith('T:') || atributo(e, 'data-serie').startsWith('P:') || atributo(e, 'data-serie').startsWith('R:'));
  }
});
