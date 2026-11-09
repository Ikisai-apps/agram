import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra, ejemploCuenta, ejemploComprasVecinas } from '../ejemplos/ikisai/compra-food.mjs';
import { consolidar, registrar, siguiente, proponer, ANUNCIO } from '../src/motor.js';
import { efectosDe, verEn, MARCAS_EFECTO } from '../src/efectos.js';
import { serializar } from '../src/persistencia.js';
import {
  TIPOS, datosCamino, previsualizar, svgCamino, htmlCamino, htmlPrevia, actorDe, tituloPropuesta, copiar, contenidoPropuesto,
} from '../antigua/mundos/camino.js';

const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
/** Un movimiento anunciado en el 4.1 de una propuesta por su dueño: [[serie], [cuánto], [qué], [[de], [a]]] (motor.ANUNCIO). */
const anuncio = (serie, cantidad, que, de, a) => [[serie], [cantidad], [que], [[de], [a]]];
const T = '2026-11-07T16:00:00Z';

// Encargo 3b (VG, 8-11; mapa §15 [D] «Una sola operación: registrar»): no hay autorizar ni ejecutar ni estados del
// motor; una propuesta está abierta mientras le falta algo de lo que su dueño anunció y cerrada cuando ha pasado (N5),
// y cada uno mueve lo suyo. El camino ya no tiene pasos «autorizar» y «ejecutar»: tiene «siguiente» (motor.siguiente:
// lo que me falta mover, con su transacción, y lo que espera de otros), y lo cerrado va junto a la acción (N6: «las
// fases las nombra el proceso»). Las pruebas de antes se reescriben sobre esa lectura.

/**
 * La compra con su cuenta y tres propuestas de la huésped: una cerrada (anunció un pago y lo hizo), otra que espera a
 * la casa (anunció que la casa le devuelve un euro) y otra que le toca a ella (anunció un pago que aún no ha hecho).
 */
async function ciclo() {
  const { eje, compra, menu, alta } = await ejemploCompra();
  const cuenta = await ejemploCuenta(eje, compra);
  const hecha = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: '2026-11-07T14:20:00Z', elecciones: { 1: 'postre <y> "café"' }, titulo: 'Postre & café' });
  await registrar(eje, { autor: 'huesped', sobre: hecha.id, en: ANUNCIO, t: '2026-11-07T14:25:00Z', movimientos: [gastaT('huesped')], payload: anuncio('E:casa/EUR', 12, 'pagar', 'huesped', 'cocina') });
  const ejec = await registrar(eje, { ...siguiente(eje, hecha.id, 'huesped').faltaDeMi[0].transaccion, t: '2026-11-07T14:40:00Z' });
  const espera = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: '2026-11-07T14:50:00Z', elecciones: { 1: 'agua' }, titulo: 'Agua' });
  const anuncioEspera = await registrar(eje, { autor: 'huesped', sobre: espera.id, en: ANUNCIO, t: '2026-11-07T14:55:00Z', movimientos: [gastaT('huesped')], payload: anuncio('E:casa/EUR', 1, 'devolver', 'casa', 'huesped') });
  const pendiente = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: '2026-11-07T14:58:00Z', elecciones: { 1: 'dos menús' }, titulo: 'Pedir dos' });
  await registrar(eje, { autor: 'huesped', sobre: pendiente.id, en: ANUNCIO, t: '2026-11-07T14:59:00Z', movimientos: [gastaT('huesped')], payload: anuncio('E:casa/EUR', 3, 'pagar', 'huesped', 'cocina') });
  return { eje, compra, menu, alta, cuenta, hecha, ejec, espera, anuncioEspera, pendiente };
}

const paso = (d, tipo) => d.pasos.find((p) => p.tipo === tipo);
/** El paso «siguiente» de la propuesta `evento` (lo que falta en ella). */
const falta = (d, evento) => d.pasos.find((p) => p.tipo === 'siguiente' && p.evento === evento);

test('pasos: del foco hacia la acción, en orden, leídos del motor', async () => {
  const { eje, compra, hecha, ejec, espera, pendiente } = await ciclo();
  const n = eje.orden.length;
  const d = datosCamino(eje, compra.id, { identidad: 'huesped' });
  assert.equal(eje.orden.length, n, 'no escribe');
  // Posiciones sin ocupantes: la compra desarrolla de 0 a 5 (en 4 está además la fábrica; en 5, su plantilla, encargo 3c-1).
  assert.deepEqual(d.pasos.filter((p) => p.tipo === 'desarrollar').map((p) => p.posicion), [6, 7, 8, 9]);
  assert.deepEqual(d.pasos.map((p) => p.n), d.pasos.map((_, i) => i + 1));
  const tipos = d.pasos.map((p) => p.tipo);
  assert.deepEqual(tipos, [...tipos].sort((a, b) => TIPOS.indexOf(a) - TIPOS.indexOf(b)), 'en el orden de TIPOS');
  // La propuesta es la de motor.proponer.
  const prop = paso(d, 'propuesta');
  assert.equal(prop.elecciones, Object.keys(proponer(eje, compra.id).elecciones).length);
  assert.equal(prop.titulo, tituloPropuesta(eje, compra.id));
  // Lo que falta, de motor.siguiente: a la pendiente le falta el pago de la huésped (con la transacción que lo
  // cumple); a la otra, lo que espera de la casa. La cerrada está junto a la acción, con el registro que la cerró.
  assert.deepEqual(d.pasos.filter((p) => p.tipo === 'siguiente').map((p) => [p.evento, p.de]), [[espera.id, 'casa'], [pendiente.id, 'huesped']]);
  assert.deepEqual(falta(d, pendiente.id).transaccion, siguiente(eje, pendiente.id, 'huesped').faltaDeMi[0].transaccion);
  assert.equal(falta(d, pendiente.id).titulo, 'mover 3 E:casa/EUR de huesped a cocina');
  assert.equal(falta(d, espera.id).transaccion, null, 'lo de otro no se lanza');
  assert.deepEqual(d.dados.map((x) => [x.evento, x.ejecucion]), [[hecha.id, ejec.id]]);
  assert.equal(d.totalDados, 1);
  assert.ok(!d.pasos.some((p) => p.evento === hecha.id));
});

// Antes: «ejecuta el autor de una consolidación autorizada; autoriza quien tiene P y no es el autor». Encargo 3b (mapa
// §15 [D]: «el consentimiento no necesita paso de autorizar, porque cada uno solo mueve lo suyo»): registra quien tiene
// que mover; lo que espera de otro, no.
test('quién puede: registra quien tiene que mover lo suyo; lo que espera de otro no se lanza', async () => {
  const { eje, compra, espera, pendiente } = await ciclo();
  const huesped = datosCamino(eje, compra.id, { identidad: 'huesped' });
  assert.equal(falta(huesped, pendiente.id).puede.registrar, true);
  assert.equal(falta(huesped, espera.id).puede.registrar, false, 'la huésped no mueve lo de la casa');
  assert.match(falta(huesped, espera.id).puede.motivo, /espera a casa: cada uno mueve lo suyo/);
  const casa = datosCamino(eje, compra.id, { identidad: 'casa' });
  assert.equal(falta(casa, pendiente.id).puede.registrar, false);
  assert.match(falta(casa, pendiente.id).puede.motivo, /espera a huesped/);
  assert.equal(falta(casa, espera.id).puede.registrar, true);
  const cocina = datosCamino(eje, compra.id, { identidad: 'cocina' });
  assert.ok(cocina.pasos.filter((p) => p.tipo === 'siguiente').every((p) => p.puede.registrar === false), 'a la cocina no le toca mover nada');
  // Los botones dicen lo mismo.
  const html = htmlCamino(huesped);
  assert.match(html, new RegExp(`data-registrar="${falta(huesped, pendiente.id).clave}">registrar como huesped`));
  assert.ok(!html.includes(`data-registrar="${falta(huesped, espera.id).clave}"`), 'lo que espera de la casa no se lanza');
  assert.match(html, /<button class="accion" disabled title="espera a casa/);
  const htmlCasa = htmlCamino(casa);
  assert.ok(!htmlCasa.includes(`data-registrar="${falta(casa, pendiente.id).clave}"`), 'la casa no paga por la huésped');
  assert.match(htmlCasa, new RegExp(`data-registrar="${falta(casa, espera.id).clave}">registrar como casa`));
  assert.ok(!/data-(autorizar|ejecutar)=/.test(html + htmlCasa), 'sin botones de autorizar ni de ejecutar');
});

test('efectos: cada paso con el nombre del catálogo, en su mundo y visto desde el camino', async () => {
  const { eje, compra, ejec, pendiente } = await ciclo();
  const d = datosCamino(eje, compra.id, { identidad: 'huesped' });
  const prop = paso(d, 'propuesta').efecto;
  assert.deepEqual([prop.tipo, prop.fase, prop.mundo, prop.nombre, prop.enCamino], ['fase', 'consolidado', 4, 'consolidar', 'previsualizar']);
  assert.equal(prop.enCamino, verEn({ tipo: 'fase', fase: 'consolidado' }, 9).nombre);
  // Lo que falta se registra sobre la propuesta (en su raíz): el catálogo lo nombra como un registro que sustituye, y
  // el camino lo ve como un paso adelante (antes eran las fases «autorizado» y «ejecutado», que ya no existen).
  const sig = falta(d, pendiente.id).efecto;
  assert.deepEqual([sig.tipo, sig.mundo, sig.nombre, sig.enCamino], ['sustituir', 0, 'mostrar', 'paso adelante']);
  // Lo cerrado lleva el efecto del registro real que lo cerró.
  assert.equal(d.dados[0].efecto.nombre, efectosDe(eje, ejec.id).find((e) => e.tipo === 'sustituir').nombre);
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
  const { eje, compra, espera } = await ciclo();
  const antes = JSON.stringify(serializar(eje));
  const d = datosCamino(eje, compra.id, { identidad: 'huesped' });
  const mio = d.pasos.find((p) => p.tipo === 'siguiente' && p.puede.registrar);

  const pe = await previsualizar(eje, d, mio.clave, { t: T });
  assert.equal(pe.escribe, false);
  assert.equal(pe.como, 'huesped');
  assert.equal(pe.operacion, 'registrar');
  assert.ok(pe.efectos.some((e) => e.tipo === 'token'), 'mueve lo anunciado');
  assert.ok(pe.lineas.includes('ciudad · mercancía que fluye · E:casa/EUR · 3 huesped→cocina'));

  const pp = await previsualizar(eje, d, 'propuesta', { t: T });
  // Lo que espera de la casa lo daría la casa, aunque mire la huésped; pero nadie lo lanza por ella.
  const pa = await previsualizar(eje, d, falta(d, espera.id).clave, { t: T });
  assert.equal(pa.como, 'casa');
  assert.match(pa.error, /lo que espera de casa no lo lanza quien mira: cada uno mueve lo suyo/);
  assert.equal(pa.evento, undefined);
  // Mirando la casa, el mismo paso es suyo y se previsualiza.
  const dc = datosCamino(eje, compra.id, { identidad: 'casa' });
  const pc = await previsualizar(eje, dc, falta(dc, espera.id).clave, { t: T });
  assert.equal(pc.como, 'casa');
  assert.equal(JSON.stringify(serializar(eje)), antes, 'el eje no ha cambiado');

  // Lo que se previsualizó es exactamente lo que el motor escribe con la misma hora.
  const x = await registrar(eje, { ...mio.transaccion, t: T });
  assert.deepEqual(pe.evento, { id: x.id, autor: x.autor, sobre: x.sobre, en: x.en, t: x.t, movimientos: x.movimientos, payload: x.payload, contexto: x.contexto });
  const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, elecciones: proponer(eje, compra.id).elecciones, titulo: tituloPropuesta(eje, compra.id), t: T });
  assert.equal(pp.evento.id, c.id);
  const a = await registrar(eje, { ...falta(dc, espera.id).transaccion, t: T });
  assert.equal(pc.evento.id, a.id);
  assert.deepEqual(pc.efectos, efectosDe(eje, a));
});

test('previsualizar: si el motor lo rechazaría, dice por qué; una posición sin desarrollar enseña dónde y con qué efecto', async () => {
  const { eje, compra } = await ciclo();
  // Una cosa sin T (B1: su alta la escribe la casa, que le da un euro y ningún minuto): el motor la rechazaría.
  await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t: T, movimientos: [gastaT('casa'), { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 1, de: 'casa', a: 'maquina' }], payload: 'una máquina sin T' });
  const d = datosCamino(eje, compra.id, { identidad: 'maquina' });
  const p = await previsualizar(eje, d, 'propuesta', { t: T });
  assert.match(p.error, /saldo insuficiente de T:minuto en maquina/);
  assert.equal(p.evento, undefined);
  assert.match(htmlPrevia(p), /el motor lo rechazaría: writing burns today&#39;s T: maquina/);
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

// Antes: «ejecuta el autor; autoriza quien mira si puede, si no la primera identidad con poder». Encargo 3b (mapa §15
// [D]): lo que falta de alguien lo da él (cada uno mueve lo suyo); lo demás, quien mira.
test('quién da cada paso: lo que falta de alguien lo da él; la propuesta, quien mira', async () => {
  const { eje, compra, espera, pendiente } = await ciclo();
  const d = datosCamino(eje, compra.id, { identidad: 'cocina' });
  assert.equal(actorDe(eje, falta(d, pendiente.id), 'cocina'), 'huesped');
  assert.equal(actorDe(eje, falta(d, espera.id), 'cocina'), 'casa');
  assert.equal(actorDe(eje, falta(d, espera.id), 'casa'), 'casa');
  assert.equal(actorDe(eje, paso(d, 'propuesta'), 'cocina'), 'cocina');
});

test('svg: función pura; la senda va del foco a la acción y lo nuevo se anima', async () => {
  const { eje, compra, ejec, espera, anuncioEspera, pendiente } = await ciclo();
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
  assert.ok(svg.includes(`data-ir="${ejec.id}"`), 'lo cerrado lleva al registro que lo cerró');
  assert.ok(!svg.includes(' nuevo'), 'sin nuevos, nada se anima');
  assert.ok(svg.includes('Postre &amp; café') && !svg.includes('<y>'), 'el título de lo cerrado, escapado');
  // El registro nuevo que cierra una propuesta consolida su paso; una propuesta nueva aparece. Encargo 3b: ya no hay
  // autorización que «anude» un paso (mapa §15 [D]); un anuncio nuevo no anima nada por sí solo.
  const animado = svgCamino(d, { nuevos: new Set([ejec.id, pendiente.id, anuncioEspera.id]), previsto: 'propuesta' });
  assert.match(animado, new RegExp(`class="paso tipo-dado nuevo consolida" [^>]*data-evento="[0-9a-f]+"[^>]*data-ir="${ejec.id}"`));
  assert.match(animado, /<circle class="onda"/);
  assert.match(animado, new RegExp(`class="paso tipo-siguiente nuevo aparece" [^>]*data-evento="${pendiente.id}"`));
  assert.match(animado, new RegExp(`class="paso tipo-siguiente" [^>]*data-evento="${espera.id}"`));
  assert.ok(!animado.includes('anuda'));
  assert.match(animado, /class="paso tipo-propuesta previsto"/);
});

test('celda 9 de Mapped: la senda sin rótulos; lo que no cabe va a un contador', async () => {
  const { eje, compra } = await ciclo();
  const d = datosCamino(eje, compra.id);
  const svg = svgCamino(d, { compacto: true });
  assert.ok(svg.startsWith('<svg class="camino compacto" viewBox="0 0 200 124"'));
  assert.ok(!svg.includes('class="rotulo"'));
  // Muchas propuestas abiertas: no caben doce piedras. Encargo 3b: sin nada anunciado una propuesta queda cerrada al
  // escribirse (mapa §15 [D] N5), así que la cocina anuncia en cada una lo que va a pagar.
  for (let k = 0; k < 6; k++) {
    const t = '2026-11-07T15:0' + k + ':00Z';
    const otra = await consolidar(eje, { autor: 'cocina', foco: compra.id, t, elecciones: { 1: 'otra ' + k }, titulo: 'Otra ' + k });
    await registrar(eje, { autor: 'cocina', sobre: otra.id, en: ANUNCIO, t, movimientos: [gastaT('cocina')], payload: anuncio('E:casa/EUR', 1, 'pagar', 'cocina', 'casa') });
  }
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
  assert.match(sobrio, /<select name="identidad"><option>casa<\/option><option selected>huesped<\/option><option>cocina<\/option>/);
  assert.match(sobrio, /data-consolidar-propuesta>consolidar como huesped/);
  assert.match(sobrio, /data-posicion="6" data-escribir-en>escribir aquí/);
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
  // Encargo 3b (mapa §15 [D] N5): sin nada anunciado, la propuesta está cerrada en cuanto se escribe.
  let d = datosCamino(eje, compra.id, { identidad: 'huesped' });
  assert.ok(!d.pasos.some((p) => p.tipo === 'propuesta'), 'consolidada: sin paso de propuesta');
  assert.deepEqual([d.propuestaConsolidada.evento, d.propuestaConsolidada.estado], [c.id, 'cerrada']);
  // La huésped anuncia un pago: abierta (antes, «pendiente de autorización») hasta que pague.
  await registrar(eje, { autor: 'huesped', sobre: c.id, en: ANUNCIO, t: '2026-11-07T16:05:00Z', movimientos: [gastaT('huesped')], payload: anuncio('E:casa/EUR', 12, 'pagar', 'huesped', 'cocina') });
  d = datosCamino(eje, compra.id, { identidad: 'huesped' });
  assert.equal(d.propuestaConsolidada.estado, 'abierta');
  assert.match(htmlCamino(d), /la propuesta del foco ya está consolidada: <button class="enlace" data-ir="[0-9a-f]{64}">[0-9a-f]{8}<\/button> Propuesta sobre .* · abierta; consolidarla otra vez, desde la fábrica/);
  assert.ok(!htmlCamino(d).includes('data-consolidar-propuesta'));
  assert.equal(falta(d, c.id).puede.registrar, true);
  // Pagado lo anunciado, la senda llega a la acción: no queda propuesta ni nada que falte.
  const x = await registrar(eje, { ...falta(d, c.id).transaccion, t: '2026-11-07T16:10:00Z' });
  d = datosCamino(eje, compra.id, { identidad: 'huesped' });
  assert.ok(!d.pasos.some((p) => ['propuesta', 'siguiente'].includes(p.tipo)));
  assert.deepEqual(d.dados.map((p) => p.ejecucion), [x.id]);
  assert.equal(d.propuestaConsolidada.estado, 'cerrada');
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
