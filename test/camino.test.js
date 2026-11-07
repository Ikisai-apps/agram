import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra, ejemploCuenta, ejemploComprasVecinas } from '../ejemplos/ikisai/compra-food.mjs';
import { consolidar, autorizar, ejecutar, liberar, proponer, FABRICA } from '../src/motor.js';
import { efectosDe, verEn, MARCAS_EFECTO } from '../src/efectos.js';
import { serializar } from '../src/persistencia.js';
import {
  TIPOS, datosCamino, previsualizar, svgCamino, htmlCamino, htmlPrevia, actorDe, tituloPropuesta, copiar, contenidoPropuesto,
} from '../mundos/camino.js';

const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const T = '2026-11-07T16:00:00Z';

/** La compra con su cuenta, una consolidación ejecutada, otra autorizada y otra pendiente. */
async function ciclo() {
  const { eje, compra, menu, alta } = await ejemploCompra();
  const cuenta = await ejemploCuenta(eje, compra);
  const hecha = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: '2026-11-07T14:20:00Z', elecciones: { 1: 'dos menús' }, titulo: 'Pedir dos' });
  const aut = await autorizar(eje, { autorizante: 'casa', consolidacion: hecha.id, t: '2026-11-07T14:25:00Z' });
  const ejec = await ejecutar(eje, { autor: 'huesped', consolidacion: hecha.id, t: '2026-11-07T14:40:00Z' });
  // Autorizar es bloquear P (VG, 7-11 noche): ejecutada, la casa libera el suyo, y para la siguiente bloquea 6 de sus
  // 10 (más de la mitad), así que le quedan 4 con los que aún puede autorizar.
  await liberar(eje, { titular: 'casa', consolidacion: hecha.id, t: '2026-11-07T14:45:00Z' });
  const autorizada = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: '2026-11-07T14:50:00Z', elecciones: { 1: 'agua' }, titulo: 'Agua' });
  const aut2 = await autorizar(eje, { autorizante: 'casa', consolidacion: autorizada.id, cantidad: 6, t: '2026-11-07T14:55:00Z' });
  const pendiente = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: '2026-11-07T14:58:00Z', elecciones: { 1: 'postre <y> "café"' }, titulo: 'Postre & café' });
  return { eje, compra, menu, alta, cuenta, hecha, aut, ejec, autorizada, aut2, pendiente };
}

const paso = (d, tipo) => d.pasos.find((p) => p.tipo === tipo);

test('pasos: del foco hacia la acción, en orden, leídos del motor', async () => {
  const { eje, compra, hecha, ejec, autorizada, aut2, pendiente } = await ciclo();
  const n = eje.orden.length;
  const d = datosCamino(eje, compra.id, { identidad: 'huesped' });
  assert.equal(eje.orden.length, n, 'no escribe');
  // Posiciones sin ocupantes: la compra desarrolla de 0 a 4 (en 4 está además la fábrica).
  assert.deepEqual(d.pasos.filter((p) => p.tipo === 'desarrollar').map((p) => p.posicion), [5, 6, 7, 8, 9]);
  assert.deepEqual(d.pasos.map((p) => p.n), d.pasos.map((_, i) => i + 1));
  const tipos = d.pasos.map((p) => p.tipo);
  assert.deepEqual(tipos, [...tipos].sort((a, b) => TIPOS.indexOf(a) - TIPOS.indexOf(b)), 'en el orden de TIPOS');
  // La propuesta es la de motor.proponer.
  const prop = paso(d, 'propuesta');
  assert.equal(prop.elecciones, Object.keys(proponer(eje, compra.id).elecciones).length);
  assert.equal(prop.titulo, tituloPropuesta(eje, compra.id));
  // Consolidaciones: la pendiente pide autorizar; la autorizada, ejecutar; la ejecutada está junto a la acción.
  assert.equal(paso(d, 'autorizar').evento, pendiente.id);
  assert.equal(paso(d, 'ejecutar').evento, autorizada.id);
  assert.equal(paso(d, 'ejecutar').autorizacion.id, aut2.id);
  assert.deepEqual(d.dados.map((x) => [x.evento, x.ejecucion]), [[hecha.id, ejec.id]]);
  assert.equal(d.totalDados, 1);
  assert.ok(!d.pasos.some((p) => p.evento === hecha.id));
});

test('quién puede: ejecuta el autor de una consolidación autorizada; autoriza quien tiene P y no es el autor', async () => {
  const { eje, compra } = await ciclo();
  const huesped = datosCamino(eje, compra.id, { identidad: 'huesped' });
  assert.equal(paso(huesped, 'ejecutar').puede.ejecutar, true);
  assert.equal(paso(huesped, 'autorizar').puede.autorizar, false, 'el autor no se autoriza');
  assert.equal(paso(huesped, 'autorizar').puede.ejecutar, false);
  assert.match(paso(huesped, 'autorizar').puede.motivo, /falta autorizar/);
  const casa = datosCamino(eje, compra.id, { identidad: 'casa' });
  assert.equal(paso(casa, 'ejecutar').puede.ejecutar, false);
  assert.match(paso(casa, 'ejecutar').puede.motivo, /ejecuta su autor: huesped/);
  assert.equal(paso(casa, 'autorizar').puede.autorizar, true);
  assert.equal(datosCamino(eje, compra.id, { identidad: 'cocina' }).pasos.find((p) => p.tipo === 'autorizar').puede.autorizar, false, 'cocina no tiene P');
  // Los botones dicen lo mismo.
  const html = htmlCamino(huesped);
  assert.match(html, new RegExp(`data-ejecutar="${paso(huesped, 'ejecutar').evento}">ejecutar como huesped`));
  assert.ok(!html.includes(`data-ejecutar="${paso(huesped, 'autorizar').evento}"`), 'una pendiente no se ejecuta');
  assert.match(html, /<button class="accion" disabled title="falta autorizar/);
  const htmlCasa = htmlCamino(casa);
  assert.ok(!/data-ejecutar=/.test(htmlCasa), 'casa no es el autor');
  assert.match(htmlCasa, new RegExp(`data-autorizar="${paso(casa, 'autorizar').evento}">autorizar como casa`));
});

test('efectos: cada paso con el nombre del catálogo, en su mundo y visto desde el camino', async () => {
  const { eje, compra, ejec } = await ciclo();
  const d = datosCamino(eje, compra.id, { identidad: 'huesped' });
  const prop = paso(d, 'propuesta').efecto;
  assert.deepEqual([prop.tipo, prop.fase, prop.mundo, prop.nombre, prop.enCamino], ['fase', 'consolidado', 4, 'consolidar', 'previsualizar']);
  assert.equal(prop.enCamino, verEn({ tipo: 'fase', fase: 'consolidado' }, 9).nombre);
  const aut = paso(d, 'autorizar').efecto;
  assert.deepEqual([aut.fase, aut.mundo, aut.nombre, aut.enCamino], ['autorizado', 4, 'autorizar', null], 'el camino no nombra autorizar');
  const ej = paso(d, 'ejecutar').efecto;
  assert.deepEqual([ej.fase, ej.nombre, ej.enCamino], ['ejecutado', 'ejecutar', 'ejecutar']);
  // Lo ejecutado lleva el efecto de su evento real.
  assert.equal(d.dados[0].efecto.nombre, efectosDe(eje, ejec.id).find((e) => e.tipo === 'fase').nombre);
  // Una posición sin desarrollar se ancla en su mundo: los hilos del pasado la ven entrar por la izquierda.
  const seis = d.pasos.find((p) => p.clave === 'desarrollar:6').efecto;
  assert.deepEqual([seis.tipo, seis.mundo, seis.nombre], ['anclado', 6, 'entra por la izquierda']);
  assert.ok(seis.decisiones.length && seis.decisiones.every((d) => d.startsWith('[X] decidir VG')));
  // Todo lo que el catálogo marca llega marcado: la fase lleva además la marca de su clase.
  assert.ok(prop.decisiones.includes(MARCAS_EFECTO.claseFase));
  assert.deepEqual(prop.decisionesCamino, verEn({ tipo: 'fase', fase: 'consolidado' }, 9).decisiones);
  // En el SVG, cada piedra lleva su efecto (el del camino si lo nombra) y lo que el corpus no nombra va marcado.
  const svg = svgCamino(d);
  assert.match(svg, /data-paso="propuesta" data-efecto="previsualizar" data-mundo="4"/);
  assert.match(svg, /data-paso="desarrollar:6" data-efecto="entra por la izquierda" data-mundo="6" data-decision="\[X\] decidir VG/);
  assert.ok([...svg.matchAll(/data-decision="([^"]*)"/g)].every((x) => x[1].startsWith('[X] decidir VG')));
});

test('fórmulas pendientes: un paso por fórmula que no resuelve; las resueltas no', async () => {
  const { eje, menu } = await ejemploCompra();
  const { vecinas } = await ejemploComprasVecinas(eje, { menu });
  const pendiente = datosCamino(eje, vecinas[0].id);
  const f = pendiente.pasos.filter((p) => p.tipo === 'formula');
  assert.equal(f.length, 1);
  assert.deepEqual([f[0].formula, f[0].estado, f[0].celda], ['=LOCAL(5)', 'PENDIENTE', '1000000000']);
  assert.ok(f[0].motivo.length > 0);
  assert.deepEqual([f[0].efecto.tipo, f[0].efecto.mundo, f[0].efecto.enCamino], ['sustituir', 1, 'paso adelante']);
  // Lo que espera (la posición 5) es otro paso: desarrollarla.
  assert.ok(pendiente.pasos.some((p) => p.clave === 'desarrollar:5'));
  const resuelta = datosCamino(eje, vecinas[1].id);
  assert.equal(resuelta.pasos.filter((p) => p.tipo === 'formula').length, 0);
  const html = htmlCamino(pendiente);
  assert.match(html, /<code>=LOCAL\(5\)<\/code>/);
});

test('previsualizar no escribe: corre la operación real en una copia y enseña lo mismo que se escribiría', async () => {
  const { eje, compra, autorizada, pendiente } = await ciclo();
  const antes = JSON.stringify(serializar(eje));
  const d = datosCamino(eje, compra.id, { identidad: 'huesped' });

  const pe = await previsualizar(eje, d, paso(d, 'ejecutar').clave, { t: T });
  assert.equal(pe.escribe, false);
  assert.equal(pe.como, 'huesped');
  assert.equal(pe.operacion, 'ejecutar');
  assert.ok(pe.efectos.some((e) => e.tipo === 'fase' && e.fase === 'ejecutado'));
  assert.ok(pe.lineas.includes('fábrica · ejecutar · ' + FABRICA));

  const pp = await previsualizar(eje, d, 'propuesta', { t: T });
  const pa = await previsualizar(eje, d, paso(d, 'autorizar').clave, { t: T });
  assert.equal(pa.como, 'casa', 'autoriza quien puede, aunque mire huesped');
  assert.equal(JSON.stringify(serializar(eje)), antes, 'el eje no ha cambiado');

  // Lo que se previsualizó es exactamente lo que el motor escribe con la misma hora.
  const x = await ejecutar(eje, { autor: 'huesped', consolidacion: autorizada.id, t: T });
  assert.deepEqual(pe.evento, { id: x.id, autor: x.autor, sobre: x.sobre, en: x.en, t: x.t, movimientos: x.movimientos, payload: x.payload, contexto: x.contexto });
  const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, elecciones: proponer(eje, compra.id).elecciones, titulo: tituloPropuesta(eje, compra.id), t: T });
  assert.equal(pp.evento.id, c.id);
  const a = await autorizar(eje, { autorizante: 'casa', consolidacion: pendiente.id, t: T });
  assert.equal(pa.evento.id, a.id);
  assert.deepEqual(pa.efectos, efectosDe(eje, a));
});

test('previsualizar: si el motor lo rechazaría, dice por qué; una posición sin desarrollar enseña dónde y con qué efecto', async () => {
  const { eje, compra } = await ciclo();
  const d = datosCamino(eje, compra.id, { identidad: 'nadie' });
  const p = await previsualizar(eje, d, 'propuesta', { t: T });
  assert.match(p.error, /autor desconocido: nadie/);
  assert.equal(p.evento, undefined);
  assert.match(htmlPrevia(p), /el motor lo rechazaría: autor desconocido/);
  const siete = await previsualizar(eje, d, 'desarrollar:7');
  assert.equal(siete.escribe, false);
  assert.deepEqual(siete.efectos.map((e) => [e.tipo, e.mundo, e.celda]), [['anclado', 7, '7000000000']]);
  assert.match(siete.nota, /lo pone quien escribe/);
  await assert.rejects(previsualizar(eje, d, 'no-existe'), /paso desconocido/);
  // La copia es un eje entero y válido, independiente del original.
  const copia = await copiar(eje);
  assert.deepEqual(copia.orden, eje.orden);
  await copia.escribir({ autor: 'huesped', sobre: compra.id, t: T, movimientos: [gastaT('huesped')], payload: 'solo en la copia' });
  assert.equal(copia.orden.length, eje.orden.length + 1);
});

test('quién da cada paso: ejecuta el autor; autoriza quien mira si puede, si no la primera identidad con poder', async () => {
  const { eje, compra } = await ciclo();
  const d = datosCamino(eje, compra.id, { identidad: 'cocina' });
  assert.equal(actorDe(eje, paso(d, 'ejecutar'), 'cocina'), 'huesped');
  assert.equal(actorDe(eje, paso(d, 'autorizar'), 'cocina'), 'casa');
  assert.equal(actorDe(eje, paso(d, 'autorizar'), 'casa'), 'casa');
  assert.equal(actorDe(eje, paso(d, 'propuesta'), 'cocina'), 'cocina');
});

test('svg: función pura; la senda va del foco a la acción y lo nuevo se anima', async () => {
  const { eje, compra, ejec, autorizada, aut2, pendiente } = await ciclo();
  const d = datosCamino(eje, compra.id, { identidad: 'huesped' });
  const svg = svgCamino(d);
  assert.equal(svgCamino(d), svg, 'determinista');
  assert.ok(svg.startsWith('<svg class="camino" viewBox="0 0 400 '));
  assert.ok(!/NaN|undefined|Infinity/.test(svg));
  const orden = [...svg.matchAll(/class="paso tipo-([a-z]+)/g)].map((m) => m[1]);
  assert.equal(orden[0], 'foco');
  assert.equal(orden.at(-1), 'meta');
  assert.deepEqual(orden.slice(1, -1), [...d.pasos.map((p) => p.tipo), 'dado']);
  for (const p of d.pasos) assert.ok(svg.includes(`data-previsualizar="${p.clave}"`), p.clave);
  assert.ok(svg.includes(`data-ir="${ejec.id}"`), 'lo ejecutado lleva a su registro');
  assert.ok(!svg.includes(' nuevo'), 'sin nuevos, nada se anima');
  assert.ok(svg.includes('Postre &amp; café') && !svg.includes('<y>'));
  // Una ejecución nueva consolida su paso; una consolidación nueva aparece; una autorización nueva anuda.
  const animado = svgCamino(d, { nuevos: new Set([ejec.id, pendiente.id, aut2.id]), previsto: 'propuesta' });
  assert.match(animado, new RegExp(`class="paso tipo-dado nuevo consolida" [^>]*data-evento="[0-9a-f]+"[^>]*data-ir="${ejec.id}"`));
  assert.match(animado, /<circle class="onda"/);
  assert.match(animado, new RegExp(`class="paso tipo-autorizar nuevo aparece" [^>]*data-evento="${pendiente.id}"`));
  assert.match(animado, new RegExp(`class="paso tipo-ejecutar anuda" [^>]*data-evento="${autorizada.id}"`));
  assert.match(animado, /class="paso tipo-propuesta previsto"/);
});

test('celda 9 de Mapped: la senda sin rótulos; lo que no cabe va a un contador', async () => {
  const { eje, compra } = await ciclo();
  const d = datosCamino(eje, compra.id);
  const svg = svgCamino(d, { compacto: true });
  assert.ok(svg.startsWith('<svg class="camino compacto" viewBox="0 0 200 124"'));
  assert.ok(!svg.includes('class="rotulo"'));
  // Muchas consolidaciones pendientes: no caben doce piedras.
  for (let k = 0; k < 6; k++) await consolidar(eje, { autor: 'cocina', foco: compra.id, t: '2026-11-07T15:0' + k + ':00Z', elecciones: { 1: 'otra ' + k }, titulo: 'Otra ' + k });
  const largo = datosCamino(eje, compra.id);
  const c = svgCamino(largo, { compacto: true });
  assert.equal((c.match(/class="paso /g) ?? []).length, 12, 'foco, nueve pasos, el contador y la acción');
  assert.match(c, /class="rotulo-contador" y="3">\+\d+</);
  const completo = svgCamino(largo);
  assert.equal((completo.match(/class="paso /g) ?? []).length, largo.pasos.length + largo.dados.length + 2, 'la vista completa no agrega');
});

test('vista: los dos renders tienen la misma lista; el animado añade la senda y la previsualización abierta', async () => {
  const { eje, compra } = await ciclo();
  const d = datosCamino(eje, compra.id, { identidad: 'huesped' });
  const sobrio = htmlCamino(d, { animado: false, identidades: eje.identidades() });
  const animado = htmlCamino(d, { animado: true, identidades: eje.identidades() });
  assert.ok(!sobrio.includes('<svg') && animado.includes('<svg class="camino"'));
  const lista = (h) => h.slice(h.indexOf('<ol'));
  assert.equal(lista(sobrio), lista(animado));
  assert.equal((sobrio.match(/<li class="paso-c/g) ?? []).length, d.pasos.length + d.dados.length);
  assert.match(sobrio, /<select name="identidad"><option>casa<\/option><option>cocina<\/option><option selected>huesped<\/option>/);
  assert.match(sobrio, /data-consolidar-propuesta>consolidar como huesped/);
  assert.match(sobrio, /data-posicion="5" data-escribir-en>escribir aquí/);
  const previa = await previsualizar(eje, d, 'propuesta', { t: T });
  const conPrevia = htmlCamino(d, { previa });
  assert.match(conPrevia, /<li class="paso-c tipo-propuesta" data-clave="propuesta">.*<div class="previa" role="status">.*no se ha escrito nada/s);
  assert.equal((conPrevia.match(/class="previa"/g) ?? []).length, 1);
});

test('la propuesta ya consolidada no vuelve a salir: la senda llega a la acción', async () => {
  const { eje, compra } = await ejemploCompra();
  const prop = proponer(eje, compra.id);
  // Lo que se compara es exactamente lo que escribe el motor (sin el título).
  const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, elecciones: prop.elecciones, titulo: tituloPropuesta(eje, compra.id), t: T });
  assert.deepEqual(eje.obtener(c.id).payload.slice(1), contenidoPropuesto(compra.id, [], prop.elecciones));
  let d = datosCamino(eje, compra.id, { identidad: 'huesped' });
  assert.ok(!d.pasos.some((p) => p.tipo === 'propuesta'), 'consolidada: sin paso de propuesta');
  assert.deepEqual([d.propuestaConsolidada.evento, d.propuestaConsolidada.estado], [c.id, 'PENDIENTE DE AUTORIZACIÓN']);
  assert.match(htmlCamino(d), /la propuesta del foco ya está consolidada: <button class="enlace" data-ir="[0-9a-f]{64}">[0-9a-f]{8}<\/button> Propuesta sobre .* · pendiente de autorización; consolidarla otra vez, desde la fábrica/);
  assert.ok(!htmlCamino(d).includes('data-consolidar-propuesta'));
  // Autorizada y ejecutada, la senda llega a la acción: no queda propuesta, ni autorizar, ni ejecutar.
  await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: '2026-11-07T16:05:00Z' });
  const x = await ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: '2026-11-07T16:10:00Z' });
  d = datosCamino(eje, compra.id, { identidad: 'huesped' });
  assert.ok(!d.pasos.some((p) => ['propuesta', 'autorizar', 'ejecutar'].includes(p.tipo)));
  assert.deepEqual(d.dados.map((p) => p.ejecucion), [x.id]);
  assert.equal(d.propuestaConsolidada.estado, 'EJECUTADO');
  // Otra consolidación con otro contenido no tapa la propuesta.
  const { eje: otro, compra: compra2 } = await ejemploCompra();
  await consolidar(otro, { autor: 'huesped', foco: compra2.id, elecciones: { 1: 'agua' }, titulo: 'Agua', t: T });
  assert.ok(datosCamino(otro, compra2.id).pasos.some((p) => p.tipo === 'propuesta'));
});

test('previsualizar: la marca es quieta y no enseña un id que no se va a escribir', async () => {
  const { eje, compra } = await ciclo();
  const d = datosCamino(eje, compra.id, { identidad: 'huesped' });
  const p = await previsualizar(eje, d, 'propuesta', { t: T });
  const html = htmlPrevia(p);
  assert.ok(!html.includes(p.evento.id.slice(0, 8)), 'sin el id: sale de la hora en que se escriba');
  assert.match(html, /se escribiría un registro de <b>huesped<\/b> sobre [0-9a-f]{8} en 4000000000 \(su id sale de la hora en que se escriba\)/);
  const svg = svgCamino(d, { previsto: 'propuesta' });
  assert.match(svg, /class="paso tipo-propuesta previsto"[^>]*>.*?<circle class="marca-previa" r="14"\/>/);
  assert.equal((svg.match(/marca-previa/g) ?? []).length, 1);
});
