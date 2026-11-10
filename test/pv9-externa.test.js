// La salida externa del PV9 y las opiniones como registros (carta/externa.js, docs/CONTRATO.md §16.6 y §12.7): exportar
// el contexto como markdown, importar las propuestas que vuelven (un .json o un .md con un bloque json) como pasos de la
// tercera fuente del camino, aceptar sin asentar nada por su cuenta (pasa por acciones.transaccion), y cada opinión de
// «opinar» como un registro «opinion» anclado en el proyecto AGRAM cuando hay ajuste «opinions anchor».

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as X from '../carta/externa.js';
import * as G from '../carta/guia.js';
import { nuevaOpinion } from '../carta/opinar.js';
import { html } from '../carta/dom.js';
import { arbol, formulario, preferencias } from '../carta/carta.js';
import { contrato, acciones as A, salida } from '../src/index.js';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';

const almacenFalso = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
};
const estadoDe = (id) => ({ foco: { X: id, pv: 0 }, niveles: {} });
const AHORA = Date.parse('2026-11-10T09:30:00Z');

/** La compra de Ikisai y el proyecto AGRAM: un registro que la huésped ancla con «anchor here» sobre su alta. */
async function mundo() {
  const { eje, compra, menu } = await ejemploCompra();
  const r = await A.transaccion(eje, 'anchor here', { X: eje.alta('huesped').id, title: 'AGRAM', content: 'el proyecto' }, 'huesped');
  assert.ok(r.ok, JSON.stringify(r.motivos));
  const proyecto = await eje.anadir(r.evento);
  return { eje, compra, menu, proyecto };
}
/** Escribe el ajuste «opinions anchor» de la huésped (su registro de ajustes de la guía). */
async function anclarEn(eje, dicho) {
  const a = G.ajustesEditables(eje, 'huesped', { 'opinions anchor': dicho });
  assert.equal(a.cambiado, true);
  await salida.escribirDesde(eje, { modo: 'sequenced', autor: 'huesped', sobre: a.sobre, en: a.en, payload: a.payload });
}
const clic = (nodo = {}, entorno = {}) => nuevaOpinion({
  nodo: { tipo: 'ocupante', pv: 3, X: null, X0: null, d: 1, tamano: 'tarjeta', representacion: 'texto@0', texto: 'Menú del día', ruta: ['carta', 'pv'], ...nodo },
  entorno: { modo: 'apilada', ancho: 400, alto: 700, render: 'sobrio', foco: { X: null, X0: null }, ...entorno },
  version: 'v-prueba', cuenta: 'ejemplo', ahora: AHORA,
}, 'el botón es pequeño');

// ---------- exportar ----------

test('exportar: un markdown con las instrucciones de la guía, el contexto de la pantalla y «Cómo responder», que sale de la época', async () => {
  const { eje, compra } = await mundo();
  const a = await X.exportar(estadoDe(compra.id), eje, 'huesped', { ahora: AHORA, ancho: 400, alto: 800 });
  assert.equal(a.nombre, 'agram-contexto-2026-11-10.md');
  assert.equal(a.tipo, 'text/markdown');
  const titulos = [...a.contenido.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(titulos, ['Instrucciones de la guía', 'Contexto de la pantalla', 'Acciones del aro y sus parámetros', 'Cómo responder']);
  const guia = contrato.guia(eje, 'en');
  // 1. Las instrucciones: las mismas que se mandan a la IA (la cascada del 9).
  const [, instr, ctx, acc, resp] = a.contenido.split(/^## .+$/m);
  assert.equal(instr.trim(), G.instrucciones(eje, compra.id, 'huesped'));
  assert.ok(instr.includes(guia.papel) && instr.includes(guia.resumen) && instr.includes(guia.normas));
  // 2. El contexto de la pantalla, sin el tope de 6000 de la guía.
  assert.ok(ctx.includes('foco: ' + compra.id.slice(0, 8)));
  assert.equal(ctx.trim(), (await G.contexto(estadoDe(compra.id), eje, 'huesped', { ancho: 400, alto: 800, tope: X.TOPE_EXPORTAR })).trim());
  // Las acciones con sus parámetros, para quien responde fuera (sus nombres canónicos).
  assert.match(acc, /^- anchor here · PV6/m);
  assert.match(acc, /^ {4}· title \[text, requerido\]/m);
  assert.match(acc, /^ {4}· who \[identity, requerido, ya tiene valor por defecto\]/m);
  // 3. Cómo responder: el texto de la época (guide, posición 6), en el idioma de quien mira.
  assert.equal(resp.trim(), guia.respuesta.trim());
  assert.match(guia.respuesta, /"propuestas"/);
  assert.match(guia.respuesta, /accion/); assert.match(guia.respuesta, /sobre/); assert.match(guia.respuesta, /parametros/); assert.match(guia.respuesta, /porque/);
  // En español, el de la época en es.
  const es = await mundo();
  const pref = preferencias(es.eje, 'huesped', { language: ['es'] });
  await salida.escribirDesde(es.eje, { modo: 'sequenced', autor: 'huesped', sobre: pref.sobre, en: pref.en, payload: pref.payload });
  const aes = await X.exportar(estadoDe(es.compra.id), es.eje, 'huesped', { ahora: AHORA });
  assert.ok(aes.contenido.includes(contrato.guia(es.eje, 'es').respuesta.trim()));
  assert.notEqual(contrato.guia(es.eje, 'es').respuesta, guia.respuesta);
});

test('lo que dice la guía de cómo responder no está escrito en el código: es dato de la época', () => {
  const fuente = readFileSync(new URL('../carta/externa.js', import.meta.url), 'utf8');
  const { respuesta } = contrato.guia(null, 'en');
  for (const frase of respuesta.split(/[.\n]/).map((f) => f.trim()).filter((f) => f.length > 25)) assert.ok(!fuente.includes(frase), 'carta/externa.js lleva escrito «' + frase + '»');
  // Ni los nombres de la época: la plantilla de la opinión y la transacción que la ancla las dice la guía.
  for (const nombre of [contrato.guia(null, 'en').opinion, contrato.guia(null, 'en').ancla]) assert.ok(!new RegExp("'" + nombre + "'").test(fuente), 'carta/externa.js lleva escrito «' + nombre + '»');
  assert.equal(contrato.guia(null, 'en').opinion, 'opinion');
  assert.equal(contrato.guia(null, 'en').ancla, 'anchor here');
});

// ---------- importar ----------

const PROPUESTAS = (sobre) => ({
  propuestas: [
    { accion: 'anchor here', sobre, parametros: { title: 'Una nota', content: 'de la guía' }, porque: 'para dejar constancia' },
    { accion: 'give own R', sobre, parametros: { amount: 1 }, porque: 'agradecerle' },
  ],
});

test('importar un JSON válido: pasos de la tercera fuente en el camino, con su porque y sus parámetros', async () => {
  const { eje, compra } = await mundo();
  const r = X.importar(JSON.stringify(PROPUESTAS(compra.id.slice(0, 8))), { ahora: AHORA });
  assert.equal(r.ok, true);
  assert.equal(r.propuestas.length, 2);
  assert.deepEqual(r.propuestas.map((p) => p.id), [AHORA.toString(36) + '-0', AHORA.toString(36) + '-1']);
  const e = X.evaluar(eje, 'huesped', r.propuestas[0]);
  assert.deepEqual([e.valida, e.sobre, e.accion, e.parametros, e.porque], [true, compra.id, 'anchor here', { title: 'Una nota', content: 'de la guía' }, 'para dejar constancia']);
  const c = await A.camino(eje, compra.id, 'huesped', { sugerencias: X.sugerenciasDe(r.propuestas) });
  const s = c.pasos.filter((p) => p.fuente === 'sugerencia');
  assert.deepEqual(s.map((p) => [p.hacer.plantilla, p.hacer.X, p.porque, p.propuesta, p.pasa, p.hecho]), [
    ['anchor here', compra.id, 'para dejar constancia', r.propuestas[0].id, true, false],
    ['give own R', compra.id, 'agradecerle', r.propuestas[1].id, true, false],
  ]);
  assert.equal(s[0].hacer.parametros.title, 'Una nota');
  assert.equal(s[1].hacer.parametros.amount, 1);
  // Por la etiqueta (en el idioma) y por el nombre del registro (su 0) también se entienden.
  const otra = X.importar(JSON.stringify({ propuestas: [{ accion: 'anchor here', sobre: 'AGRAM', parametros: { title: 'x', content: 'y' }, porque: '' }] }));
  const mio = await mundo();
  const eo = X.evaluar(mio.eje, 'huesped', otra.propuestas[0]);
  assert.equal(eo.valida, true);
  assert.equal(eo.sobre, mio.proyecto.id, 'el 0 del registro');
});

test('importar un .md con un bloque json; y la lista sola; y lo que no es ninguna de las dos cosas', async () => {
  const { compra } = await mundo();
  const md = 'Aquí tienes mis ideas.\n\n```json\n' + JSON.stringify(PROPUESTAS(compra.id), null, 2) + '\n```\n\nSuerte.\n';
  const r = X.importar(md, { ahora: AHORA });
  assert.equal(r.ok, true);
  assert.equal(r.propuestas.length, 2);
  assert.equal(r.propuestas[1].accion, 'give own R');
  assert.equal(X.importar(JSON.stringify(PROPUESTAS(compra.id).propuestas)).propuestas.length, 2, 'la lista sola');
  assert.equal(X.importar('sin ningún objeto json').ok, false);
  assert.match(X.importar('sin ningún objeto json').motivo, /ningún JSON/);
  assert.match(X.importar('{ "algo": 1 }').motivo, /«propuestas»/);
});

test('una propuesta que no se entiende sale como inválida con su motivo: no se descarta en silencio', async () => {
  const { eje, compra } = await mundo();
  const r = X.importar(JSON.stringify({ propuestas: [
    { accion: 'teletransportar', sobre: compra.id, parametros: {}, porque: 'porque sí' },
    { accion: 'anchor here', sobre: 'f'.repeat(64), parametros: { title: 'x' }, porque: 'otro registro' },
    { accion: 'anchor here', sobre: compra.id, parametros: { colores: 3 }, porque: 'un parámetro que no existe' },
    { accion: 'give own R', parametros: { amount: 1 } },
    'esto no es un objeto',
  ] }));
  const ev = X.evaluarTodas(eje, 'huesped', r.propuestas);
  assert.deepEqual(ev.map((e) => e.valida), [false, false, false, false, false]);
  assert.match(ev[0].motivo, /«teletransportar» no es ninguna del aro/);
  assert.match(ev[1].motivo, /ningún registro del libro/);
  assert.match(ev[2].motivo, /«colores» no es un parámetro de /);
  assert.match(ev[3].motivo, /falta «sobre»/);
  assert.match(ev[4].motivo, /no es una propuesta/);
  // En el camino del registro del que tratan, un paso inválido con su motivo (y su porque); las demás, en el panel de la guía.
  const c = await A.camino(eje, compra.id, 'huesped', { sugerencias: X.sugerenciasDe(r.propuestas) });
  const s = c.pasos.filter((p) => p.fuente === 'sugerencia');
  assert.equal(s.length, 2, 'solo las que tratan de este registro: la acción desconocida y el parámetro que no existe');
  assert.deepEqual(s.map((p) => [p.hacer, p.pasa, p.porque]), [[null, false, 'porque sí'], [null, false, 'un parámetro que no existe']]);
  assert.match(s[0].invalida, /«teletransportar» no es ninguna del aro/);
  assert.match(s[1].invalida, /«colores» no es un parámetro de /);
  // La carta las pinta: la inválida con su motivo y «rechazar», sin aceptar; en el panel, las de otros registros.
  const a = await arbol({ foco: { X: compra.id, pv: 0 }, niveles: { 9: 3 } }, eje, 'huesped', { ancho: 400, alto: 800 }, { sugerencias: X.sugerenciasDe(r.propuestas) });
  const pagina = html(a, {});
  assert.match(pagina, /propuesta inválida/);
  assert.match(pagina, /la acción «teletransportar» no es ninguna del aro/);
  assert.ok(!pagina.includes('data-propuesta-aceptar'), 'una inválida no se acepta: solo se rechaza');
  assert.match(pagina, /data-propuesta-rechazar=/);
});

test('el almacén de propuestas: por alta o ejemplo; aceptada o rechazada, deja de estar', () => {
  const alm = almacenFalso();
  const r = X.importar(JSON.stringify(PROPUESTAS('x')), { ahora: AHORA });
  assert.equal(X.anadirPropuestas(alm, 'ejemplo', r.propuestas), true);
  assert.ok(alm.m.has('agram.propuestas.ejemplo'));
  assert.equal(X.leerPropuestas(alm, 'ejemplo').length, 2);
  assert.equal(X.leerPropuestas(alm, 'otra-alta').length, 0);
  X.quitarPropuesta(alm, 'ejemplo', r.propuestas[0].id);
  assert.deepEqual(X.leerPropuestas(alm, 'ejemplo').map((p) => p.accion), ['give own R']);
  X.quitarPropuesta(alm, 'ejemplo', r.propuestas[1].id);
  assert.equal(alm.m.has('agram.propuestas.ejemplo'), false, 'vacía: se borra la clave');
  assert.equal(X.leerPropuestas({ getItem: () => '{rota' }, 'ejemplo').length, 0, 'un almacén roto no rompe');
  assert.equal(X.anadirPropuestas(undefined, 'ejemplo', []), false, 'sin almacenamiento: no se guarda');
});

test('aceptar construye la transacción con acciones.transaccion (reglas y firma) y no asienta nada por su cuenta', async () => {
  const { eje, compra } = await mundo();
  const antes = eje.orden.length;
  const r = X.importar(JSON.stringify(PROPUESTAS(compra.id.slice(0, 10))));
  const e = X.evaluar(eje, 'huesped', r.propuestas[0]);
  const firmados = [];
  const t = await A.transaccion(eje, e.accion, { X: e.sobre, ...e.parametros }, 'huesped', { firmar: async (ev) => { firmados.push(ev.id); return ev; } });
  assert.equal(t.ok, true);
  assert.equal(t.evento.sobre, compra.id);
  assert.equal(t.evento.payload[0][0], 'Una nota');
  assert.equal(firmados.length, 1, 'pasa por la firma');
  assert.equal(eje.orden.length, antes, 'nada se asienta sin que la carta lo lance');
  // Una propuesta que las reglas no dejan pasar se marca en el camino (pasa: false, motivos), no se esconde.
  const mala = X.importar(JSON.stringify({ propuestas: [{ accion: 'anchor here', sobre: compra.id, parametros: {}, porque: 'sin título' }] }));
  const c = await A.camino(eje, compra.id, 'huesped', { sugerencias: X.sugerenciasDe(mala.propuestas) });
  const paso = c.pasos.find((p) => p.fuente === 'sugerencia');
  assert.equal(paso.pasa, false);
  assert.ok(paso.motivos.length > 0);
  // La carta: el nombre abre el formulario con los parámetros, y los tres botones (aceptar, modificar, rechazar).
  const a = await arbol({ foco: { X: compra.id, pv: 0 }, niveles: { 9: 3 } }, eje, 'huesped', { ancho: 400, alto: 800 }, { sugerencias: X.sugerenciasDe(r.propuestas) });
  const pagina = html(a, {});
  for (const que of ['aceptar', 'modificar', 'rechazar']) assert.match(pagina, new RegExp('data-propuesta-' + que + '="' + r.propuestas[0].id + '"'));
  assert.match(pagina, /para dejar constancia/);
  assert.ok(!pagina.includes('data-seguir'), 'seguir no lanza propuestas: eso lo decide quien las acepta');
  // El formulario abierto con los parámetros rellenos (lo que hace «modificar»).
  const form = formulario(eje, e.sobre, e.accion, 'huesped', e.parametros);
  assert.equal(form.campos.find((c2) => c2.nombre === 'title').valor, 'Una nota');
  assert.equal(form.campos.find((c2) => c2.nombre === 'content').valor, 'de la guía');
});

// ---------- opiniones como registros ----------

test('la plantilla «opinion» y el ajuste «opinions anchor» son de la época', async () => {
  const { eje } = await mundo();
  const p = contrato.plantillas(eje).find((x) => x.nombre === 'opinion');
  assert.equal(p.donde, '9240000000');
  assert.ok(contrato.esPlantilla(p.registro));
  const posiciones = p.registro.map((d) => (Array.isArray(d) ? d[5]?.[0] : null));
  assert.deepEqual(posiciones, ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
  assert.deepEqual(p.registro.map((d) => d[0][0]), ['opinion', 'classification', 'criteria', 'who', 'actions', 'type', 'about', 'version', 'seen', 'route']);
  // Etiquetas y ayudas en es y en: «template opinion param …».
  for (const d of p.registro) {
    assert.ok(contrato.texto(eje, contrato.claves.parametro('opinion', d[0][0], 'label'), 'es', { original: '' }), d[0][0] + ' es');
    assert.ok(contrato.texto(eje, contrato.claves.parametro('opinion', d[0][0], 'help'), 'es', { original: '' }), d[0][0] + ' es');
    assert.ok(String(d[9][d[9].length - 1]).length > 10, d[0][0] + ': la ayuda en inglés, en la propia plantilla');
  }
  assert.equal(contrato.texto(eje, contrato.claves.parametro('opinion', 'classification', 'label'), 'es', { original: '' }), 'clasificación');
  // El ajuste, en la plantilla «guide settings» (la de preferencias tiene las diez posiciones llenas): posición 6, sin defecto.
  assert.deepEqual(contrato.clavesDeConfiguracionDe('guide settings').map((c) => [c.pv, c.clave, c.defecto]).slice(-1), [[6, 'opinions anchor', undefined]]);
  assert.deepEqual(contrato.clavesDeConfiguracion().map((c) => c.pv), [1, 2, 3, 4, 6, 7, 8, 9], 'preferences sigue llena (las diez posiciones, el 5 es el tipo): el ajuste no cupo ahí');
  assert.equal(contrato.anclaDeLasOpiniones(eje, 'huesped'), null);
  assert.equal(G.ajustes(eje, 'huesped').ancla, undefined);
});

test('con «opinions anchor», cada opinión guardada se escribe como un registro «opinion» anclado en el proyecto, con su clasificación y su referencia', async () => {
  const { eje, compra, proyecto } = await mundo();
  await anclarEn(eje, 'AGRAM'); // el 0 del proyecto
  assert.equal(contrato.anclaDeLasOpiniones(eje, 'huesped'), 'AGRAM');
  assert.equal(A.proyectoDeOpiniones(eje, 'huesped'), proyecto.id);
  assert.equal(G.ajustes(eje, 'huesped').ancla, 'AGRAM');
  const antes = eje.orden.length;
  const firmados = [];
  const op = clic({ X: compra.id, X0: 'Compra', representacion: 'texto@0' }, { foco: { X: compra.id, X0: 'Compra' } });
  const r = await X.anclarOpinion(eje, 'huesped', op, { firmar: async (ev) => { firmados.push(1); return ev; } });
  assert.equal(r.ok, true, r.motivo);
  assert.equal(eje.orden.length, antes + 1);
  assert.equal(firmados.length, 1, 'se firma como cualquier escritura');
  const ev = eje.obtener(r.id);
  assert.equal(ev.sobre, proyecto.id, 'anclada en el proyecto');
  assert.equal(ev.autor, 'huesped');
  assert.equal(contrato.nombreDePlantilla(contrato.plantilla(eje, ev)), 'opinion');
  assert.deepEqual(ev.payload[0], ['el botón es pequeño'], '0 el texto');
  assert.deepEqual(ev.payload[1], ['type: ocupante', 'pv: 3', 'd: 1', 'size: tarjeta', 'representation: texto@0', 'mode: apilada', 'width: 400', 'render: sobrio'], '1 la clasificación como ocupantes');
  assert.deepEqual(ev.payload[3], ['huesped'], '3 quién opina');
  assert.deepEqual(ev.payload[5], ['opinion'], '5 el tipo');
  assert.deepEqual(ev.payload[6], [{ ref: compra.id }], '6 la referencia al registro opinado');
  assert.deepEqual([ev.payload[7], ev.payload[8]], [['v-prueba'], ['Menú del día']], '7 la versión de la carta, 8 lo que enseñaba');
  assert.deepEqual(ev.payload[9], ['carta', 'pv'], '9 la ruta de ancestros');
  assert.ok(ev.movimientos.some((m) => m.token === 'T' && m.cantidad === 1), 'quema su T de minuto como todo registro');
  // La lectura de apoyo: la opinión, con su clasificación, y sus respuestas (registros anclados debajo).
  const resp = await A.transaccion(eje, 'anchor here', { X: r.id, title: 'Lo miro', content: 'respuesta de Core' }, 'huesped');
  const respuesta = await eje.anadir(resp.evento);
  const ops = A.opiniones(eje, proyecto.id);
  assert.equal(ops.length, 1);
  assert.deepEqual([ops[0].id, ops[0].autor, ops[0].texto, ops[0].sobre, ops[0].ruta], [r.id, 'huesped', 'el botón es pequeño', compra.id, ['carta', 'pv']]);
  assert.equal(ops[0].clasificacion[0], 'type: ocupante');
  assert.deepEqual(ops[0].respuestas.map((x) => [x.id, x.texto, x.respuestas.length]), [[respuesta.id, 'Lo miro', 0]]);
  assert.deepEqual(A.opiniones(eje, compra.id), [], 'solo lo anclado bajo ese registro');
  // Una opinión sobre algo que no es un registro (la barra) se refiere al que está en foco; sin ninguno, no lleva referencia ni nada de detrás.
  const barra = await X.anclarOpinion(eje, 'huesped', clic({ tipo: 'barra', pv: null, d: null, ruta: [] }, { foco: { X: compra.id, X0: 'Compra' } }));
  assert.equal(barra.ok, true, barra.motivo);
  assert.deepEqual(eje.obtener(barra.id).payload[6], [{ ref: compra.id }]);
  const suelta = await X.anclarOpinion(eje, 'huesped', clic({ tipo: 'barra', pv: null, d: null, texto: '', ruta: [] }));
  assert.equal(suelta.ok, true, suelta.motivo);
  assert.deepEqual([6, 7, 8, 9].map((d) => eje.obtener(suelta.id).payload[d]), [undefined, undefined, undefined, undefined]);
  assert.equal(A.opiniones(eje, proyecto.id).length, 3);
  // La carta las lista en el 6 (pasado) del proyecto.
  const arb = await arbol({ foco: { X: proyecto.id, pv: 0 }, niveles: { 6: 3 } }, eje, 'huesped', { ancho: 400, alto: 900 });
  const lateral = arb.laterales.find((n) => n.pv === 6);
  assert.equal(lateral.opiniones.length, 3);
  assert.deepEqual([lateral.opiniones[0].texto, lateral.opiniones[0].respuestas], ['el botón es pequeño', 1]);
  assert.match(html(arb, {}), /<section class="opiniones"[^>]*><h4>opiniones · 3<\/h4>/);
  // En otro registro, no se listan.
  const otro = await arbol({ foco: { X: compra.id, pv: 0 }, niveles: { 6: 3 } }, eje, 'huesped', { ancho: 400, alto: 900 });
  assert.equal(otro.laterales.find((n) => n.pv === 6).opiniones, undefined);
});

test('sin la preferencia no se escribe nada; con una que falla, la opinión queda solo en local y se dice por qué', async () => {
  const { eje, compra, proyecto } = await mundo();
  const antes = eje.orden.length;
  const r = await X.anclarOpinion(eje, 'huesped', clic({ X: compra.id }));
  assert.deepEqual(r, { ok: false, sinAncla: true });
  assert.equal(eje.orden.length, antes, 'sin la preferencia, todo sigue como hoy: solo local + exportar');
  assert.deepEqual(A.opiniones(eje, proyecto.id), []);
  // Un registro que no está en el libro.
  await anclarEn(eje, 'Un proyecto que no existe');
  const mala = await X.anclarOpinion(eje, 'huesped', clic({ X: compra.id }));
  assert.equal(mala.ok, false);
  assert.match(mala.motivo, /no está en el libro/);
  assert.equal(mala.sinAncla, undefined);
  // Sin T (las reglas): se dice y no se escribe.
  const { eje: b, proyecto: p2 } = await mundo();
  await anclarEn(b, p2.id);
  const n = b.orden.length;
  const sinT = await X.anclarOpinion(b, 'huesped', clic({}), { firmar: async () => { throw new Error('sin clave para firmar'); } });
  assert.equal(sinT.ok, false);
  assert.match(sinT.motivo, /sin clave para firmar/);
  assert.equal(b.orden.length, n);
  // «-» quita el ajuste.
  const quitar = G.ajustesEditables(eje, 'huesped', { 'opinions anchor': '-' });
  assert.equal(quitar.cambiado, true);
  await salida.escribirDesde(eje, { modo: 'sequenced', autor: 'huesped', sobre: quitar.sobre, en: quitar.en, payload: quitar.payload });
  assert.equal(contrato.anclaDeLasOpiniones(eje, 'huesped'), null);
  assert.deepEqual(await X.anclarOpinion(eje, 'huesped', clic({ X: compra.id })), { ok: false, sinAncla: true });
  // Lo que se cambia en otra cosa de los ajustes conserva el ancla.
  const otra = G.ajustesEditables(b, 'huesped', { 'guide context': '3000' });
  await salida.escribirDesde(b, { modo: 'sequenced', autor: 'huesped', sobre: otra.sobre, en: otra.en, payload: otra.payload });
  assert.equal(contrato.anclaDeLasOpiniones(b, 'huesped'), p2.id);
  assert.equal(G.ajustes(b, 'huesped').contexto, 3000);
});
