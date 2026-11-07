import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploComprasHermanas, escribirBasesDelEjemplo } from '../ejemplos/ikisai/compras-hermanas.mjs';
import { calcularBase, situar, medir, clavesDeMedidas, ETIQUETAS } from '../src/bases.js';
import { verEn } from '../src/efectos.js';
import {
  COHORTES, DECUPLA, EFECTOS, registroDeCohorte, baseAlVuelo, situarEnEstadistica, rangoDeCaja, datosCielo, svgCielo, htmlCielo,
  htmlCieloSobrio, selectorCohorte, brillo,
} from '../mundos/cielo.js';

/** Las constelaciones del SVG, en orden. */
const constelaciones = (svg) => [...svg.matchAll(/<g class="constelacion[^"]*" data-medida="([^"]+)"/g)].map((m) => m[1]);
/** El trozo del SVG de una constelación. */
const bloqueDe = (svg, medida) => svg.slice(svg.indexOf(`data-medida="${medida}"`)).split('<g class="constelacion')[0];
/** Lo estadístico de una estadística de base. */
const est = (e) => ({ n: e.n, medidas: e.medidas, tokens: e.tokens, posiciones: e.posiciones, raiz: e.raiz });

let compartido;
/** El ejemplo de las compras hermanas, sin bases escritas (compartido: no se escribe en él). */
const sinBases = () => (compartido ??= ejemploComprasHermanas());

test('cohortes: el mismo registro y la misma estadística que bases.situar; los hermanos del génesis no existen', async () => {
  const ej = await sinBases();
  const { eje } = ej;
  for (const foco of [ej.guisos.id, ej.compra.id, ej.manzanas.id, ej.menu.id, ej.comedor.id]) {
    for (const cohorte of COHORTES) {
      const c = registroDeCohorte(eje, foco, cohorte);
      const s = situar(eje, foco, { alcance: cohorte });
      assert.deepEqual([c.registro, c.seccion], [s.registro, s.seccion], cohorte);
    }
  }
  assert.equal(registroDeCohorte(eje, eje.genesisId, 'hermanos'), null);
  assert.deepEqual(registroDeCohorte(eje, eje.genesisId, 'proyecto'), { registro: eje.genesisId, seccion: 'subarbol' });
  assert.deepEqual(registroDeCohorte(eje, ej.guisos.id, 'proyecto'), { registro: ej.comedor.id, seccion: 'subarbol' });
  assert.throws(() => registroDeCohorte(eje, ej.guisos.id, 'mejores'), /cohorte desconocida/);
});

test('al vuelo: los hermanos son los hijos que escribiría calcularBase; no escribe nada', async () => {
  const ej = await sinBases();
  const { eje } = ej;
  const n = eje.orden.length;
  const v = baseAlVuelo(eje, ej.guisos.id, 'hermanos');
  assert.deepEqual(est(v), est(calcularBase(eje, ej.menu.id).hijos));
  assert.deepEqual(v.refs, calcularBase(eje, ej.menu.id).refsHijos);
  assert.equal(v.escrita, false);
  assert.equal(baseAlVuelo(eje, ej.guisos.id, 'general').n, eje.orden.length, 'general: todo el eje (sin bases)');
  assert.equal(eje.orden.length, n, 'no escribe');
});

test('escrita o al vuelo, el cielo dice lo mismo: con las bases del ejemplo escritas, situar da los números que se calcularon al vuelo', async () => {
  const ej = await ejemploComprasHermanas();
  const focos = [ej.guisos.id, ej.cafe.id, ej.manzanas.id, ej.cena.id];
  const antes = Object.fromEntries(focos.flatMap((f) => COHORTES.map((c) => [f + c, datosCielo(ej.eje, f, { cohorte: c })])));
  for (const d of Object.values(antes)) {
    assert.equal(d.escrita, false);
    assert.equal(d.base.id, null);
    assert.equal(d.incluido, true);
  }
  await escribirBasesDelEjemplo(ej);
  for (const f of focos) {
    for (const c of COHORTES) {
      const d = datosCielo(ej.eje, f, { cohorte: c });
      const s = situar(ej.eje, f, { alcance: c });
      assert.equal(d.escrita, true, c);
      assert.equal(d.base.id, s.base);
      assert.equal(d.base.n, s.n);
      assert.deepEqual(d.base.frescura, s.frescura);
      assert.equal(d.incluido, s.incluido);
      assert.deepEqual(d.cambiadas, s.cambiadas);
      assert.deepEqual(d.medidas, antes[f + c].medidas, 'misma lectura: ' + c);
      assert.ok(d.medidas.every((m) => !('hito' in m) && !('etiqueta' in m)), 'sin hitos: el cielo no asigna nivel');
    }
  }
  // Situar en memoria con una estadística leída del 8 da lo mismo que bases.situar.
  const s = situar(ej.eje, ej.guisos.id, { alcance: 'proyecto' });
  const leida = calcularBase(ej.eje, ej.comedor.id).subarbol;
  const mem = situarEnEstadistica(leida, medir(ej.eje, ej.guisos.id));
  for (const k of clavesDeMedidas()) {
    const { hito, ...esperado } = s.medidas[k];
    assert.deepEqual(mem.medidas[k], esperado, k);
  }
  assert.deepEqual(mem.posiciones.map((p) => [p.comparables, p.foco]), s.posiciones.map((p) => [p.comparables, p.foco]));
});

test('sin cohorte: el génesis no tiene hermanos; el cielo lo dice sin inventar nada', async () => {
  const ej = await sinBases();
  const d = datosCielo(ej.eje, ej.eje.genesisId);
  assert.equal(d.estado, 'SIN COHORTE');
  assert.match(d.motivo, /génesis no tiene padre/);
  assert.deepEqual(d.medidas, []);
  const svg = svgCielo(d);
  assert.ok(svg.includes('sin cohorte') && !svg.includes('class="constelacion'));
  assert.match(htmlCielo(d), /sin cohorte: el génesis no tiene padre/);
  assert.equal(datosCielo(ej.eje, ej.eje.genesisId, { cohorte: 'general' }).estado, 'RESUELTO');
});

test('svg: función pura, una constelación por medida con diez estrellas y el foco en su caja', async () => {
  const ej = await sinBases();
  const d = datosCielo(ej.eje, ej.guisos.id, { cohorte: 'general' });
  const svg = svgCielo(d);
  assert.equal(svgCielo(d), svg, 'determinista');
  assert.ok(svg.startsWith('<svg class="cielo sin-escribir" viewBox="0 0 400 '));
  assert.ok(svg.endsWith('</svg>'));
  assert.ok(!/NaN|undefined|Infinity|null/.test(svg), 'sin números rotos');
  assert.ok(svg.includes('data-escrita="false"') && !svg.includes('data-evento='), 'sin escribir: no hay evento detrás');
  const tokens = d.medidas.filter((m) => /^[TEPR]:/.test(m.medida)).map((m) => m.medida);
  assert.deepEqual(constelaciones(svg), [...clavesDeMedidas(), DECUPLA, ...tokens]);
  assert.deepEqual(tokens, [...tokens].sort());
  for (const m of d.medidas) {
    const bloque = bloqueDe(svg, m.medida);
    const estrellas = [...bloque.matchAll(/<g class="estrella[^"]*" data-caja="(\d)" data-cuenta="(\d+)"/g)];
    assert.equal(estrellas.length, 10, m.medida);
    assert.deepEqual(estrellas.map((e) => Number(e[2])), m.cajas, 'cada estrella es una caja con su recuento');
    const centros = [...bloque.matchAll(/<circle class="astro" cx="([\d.]+)" cy="([\d.]+)"/g)].map((x) => x[1] + ',' + x[2]);
    const anillos = [...bloque.matchAll(/<circle class="anillo" cx="([\d.]+)" cy="([\d.]+)"/g)].map((x) => x[1] + ',' + x[2]);
    if (m.tipo === 'pv') {
      assert.deepEqual(anillos, centros.filter((_, k) => m.focoEn[k]), 'la décupla: un anillo en cada posición que tiene el foco');
    } else {
      assert.equal(m.cajas.reduce((s, c) => s + c, 0), d.base.n, 'las diez cajas suman n');
      assert.deepEqual(anillos, [centros[m.caja]], 'el anillo del foco, sobre la estrella de su caja');
    }
  }
  assert.ok(svg.includes(`data-efecto="${EFECTOS.constelacion}"`) && svg.includes(`data-efecto="${EFECTOS.caja}"`));
  assert.ok([...svg.matchAll(/data-decision="([^"]*)"/g)].every((x) => x[1].startsWith('[X] decidir VG')));
  // Con base escrita, el SVG apunta a su evento.
  const con = await ejemploComprasHermanas();
  await escribirBasesDelEjemplo(con);
  const dc = datosCielo(con.eje, con.guisos.id);
  const sc = svgCielo(dc);
  assert.ok(sc.includes('class="cielo escrita"') && sc.includes(`data-evento="${dc.base.id}"`));
});

test('brillo: proporcional al recuento (área y opacidad crecen con él); una caja vacía es un hueco', () => {
  const n = 8;
  const b = [0, 1, 2, 4, 8].map((c) => brillo(c, n));
  assert.equal(b[0].encendida, false);
  for (let i = 2; i < b.length; i++) assert.ok(b[i].r > b[i - 1].r && b[i].o > b[i - 1].o, 'crece con el recuento');
  assert.ok(Math.abs((b[4].r / b[3].r) ** 2 - 2) < 1e-9, 'el doble de registros, el doble de área');
  assert.equal(brillo(3, 0).encendida, false);
});

test('sin nivel ni grado: las cajas se rotulan con su tramo de valores; las cohortes van siempre en el mismo orden', async () => {
  const ej = await sinBases();
  for (const cohorte of COHORTES) {
    const d = datosCielo(ej.eje, ej.guisos.id, { cohorte });
    const html = htmlCielo(d) + htmlCieloSobrio(d);
    for (const h of ETIQUETAS) assert.ok(!html.includes(h.nombre), 'sin el hito «' + h.nombre + '»');
    const orden = [...html.matchAll(/data-cohorte="([a-z]+)" aria-pressed="(true|false)"/g)];
    assert.deepEqual(orden.slice(0, 3).map((x) => x[1]), COHORTES, 'orden fijo');
    assert.deepEqual(orden.slice(0, 3).filter((x) => x[2] === 'true').map((x) => x[1]), [cohorte]);
  }
  assert.equal(selectorCohorte('general'), selectorCohorte('general'));
  const recuentos = [1, 2, 3, 4, 6, 10, 16, 26, 42];
  assert.deepEqual([0, 3, 4, 5, 9].map((k) => rangoDeCaja(recuentos, k)), ['0', '3', '4–5', '6–9', '≥ 42']);
  assert.deepEqual([0, 1, 9].map((k) => rangoDeCaja([0.5, 1.5, 2, 3, 4, 5, 6, 7, 8], k)), ['< 0.5', '[0.5, 1.5)', '≥ 8']);
  assert.equal(rangoDeCaja([], 0), 'todos');
});

test('transición: al cambiar de cohorte cada estrella y el foco se recomponen desde la cohorte anterior', async () => {
  const ej = await sinBases();
  const hermanos = datosCielo(ej.eje, ej.guisos.id, { cohorte: 'hermanos' });
  const general = datosCielo(ej.eje, ej.guisos.id, { cohorte: 'general' });
  assert.notEqual(hermanos.base.n, general.base.n);
  const svg = svgCielo(general, { anterior: hermanos });
  assert.ok(svg.includes('class="cielo sin-escribir recompone"') && svg.includes('data-transicion="cohorte"'));
  const estrellas = [...svg.matchAll(/<g class="estrella[^"]*" data-caja="\d" data-cuenta="\d+" style="--s0:([\d.]+);--o0:([\d.]+)"/g)];
  assert.equal(estrellas.length, general.medidas.length * 10, 'cada estrella sabe de dónde viene');
  assert.ok(estrellas.some((e) => Number(e[1]) !== 1), 'alguna cambia de brillo');
  assert.ok(estrellas.every((e) => Number(e[2]) <= 1));
  // El foco se desplaza desde su caja anterior en las constelaciones que también estaban en la otra cohorte.
  const antes = new Set(hermanos.medidas.map((m) => m.medida));
  const comunes = general.medidas.filter((m) => m.tipo === 'caja' && antes.has(m.medida)).length;
  assert.ok(comunes < general.medidas.length - 1, 'general mueve series que los hermanos no mueven');
  assert.equal((svg.match(/class="foco-cielo"[^>]*style="--dx0:/g) ?? []).length, comunes);
  // Sin anterior, con la misma cohorte o con otro foco, nada se recompone.
  assert.ok(!svgCielo(general).includes('recompone'));
  assert.ok(!svgCielo(general, { anterior: general }).includes('recompone'));
  assert.ok(!svgCielo(general, { anterior: datosCielo(ej.eje, ej.fruta.id, { cohorte: 'hermanos' }) }).includes('recompone'));
  assert.ok(!svgCielo(general, { anterior: datosCielo(ej.eje, ej.eje.genesisId) }).includes('recompone'));
});

test('celda 8 de Mapped: las medidas de la confluencia, sin rótulos, en la caja de las celdas de los hilos', async () => {
  const ej = await sinBases();
  const svg = svgCielo(datosCielo(ej.eje, ej.guisos.id), { compacto: true });
  assert.ok(svg.startsWith('<svg class="cielo compacto sin-escribir" viewBox="0 0 200 124"'));
  assert.deepEqual(constelaciones(svg), clavesDeMedidas());
  assert.ok(!svg.includes('<text'));
});

test('sobrio y animado leen lo mismo: la tabla dice el valor del foco, su caja y cuántos quedan debajo, en ella y encima', async () => {
  const ej = await sinBases();
  const d = datosCielo(ej.eje, ej.guisos.id, { cohorte: 'proyecto' });
  const html = htmlCieloSobrio(d);
  assert.equal((html.match(/<div class="medida-fila">/g) ?? []).length, d.medidas.length);
  for (const m of d.medidas.filter((x) => x.tipo === 'caja')) {
    assert.ok(html.includes(`foco <b>${m.valor}</b> · caja ${m.caja} (${rangoDeCaja(m.cortes, m.caja)})</span><span class="medida-cohorte">${m.debajo} debajo · ${m.enCaja} en su caja · ${m.encima} encima`), m.medida);
  }
  const pv = d.medidas.find((m) => m.tipo === 'pv');
  assert.ok(html.includes(`el foco tiene <b>${pv.valor}</b> de 10`));
  assert.match(html, /sin escribir/);
  assert.match(htmlCielo(d), /<figure class="cielo-vista">.*<svg class="cielo/s);
});

test('los nombres de efecto son los del catálogo, vistos desde el cielo', () => {
  assert.equal(EFECTOS.constelacion, verEn({ tipo: 'escrito' }, 8).nombre);
  assert.equal(EFECTOS.caja, verEn({ tipo: 'sustituir' }, 8).nombre);
});
