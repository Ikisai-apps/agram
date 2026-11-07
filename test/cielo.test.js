import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generarClaves } from '../src/autoridad.js';
import { ejemploComprasHermanas, escribirBasesDelEjemplo } from '../ejemplos/ikisai/compras-hermanas.mjs';
import { baseDe, leerBase, situar, MEDIDAS_REGISTRO, COHORTES, ETIQUETAS } from '../src/bases.js';
import { verEn } from '../src/efectos.js';
import {
  EFECTOS, registroDeCohorte, baseAlVuelo, situarEnBase, rangoDeCaja, datosCielo, svgCielo, htmlCielo, htmlCieloSobrio,
  selectorCohorte, brillo, ordenMedidas,
} from '../mundos/cielo.js';
import { medir } from '../src/bases.js';

/** Lo estadístico de una base: n y, por medida, cajas, suma, mínimo y máximo. */
const estadistica = (b) => ({ n: b.n, medidas: b.medidas });
/** Etiquetas de apertura de las constelaciones del SVG. */
const constelaciones = (svg) => [...svg.matchAll(/<g class="constelacion" data-medida="([^"]+)"/g)].map((m) => m[1]);

let compartido;
async function ejemplo() {
  compartido ??= (async () => {
    const casa = await generarClaves();
    const ej = await ejemploComprasHermanas({ claves: { casa } });
    return { ej, casa };
  })();
  return compartido;
}

/** Un eje nuevo con las bases del ejemplo escritas en el 8. */
async function conBases() {
  const casa = await generarClaves();
  const ej = await ejemploComprasHermanas({ claves: { casa } });
  await escribirBasesDelEjemplo(ej, casa.privada);
  return ej;
}

test('cohortes: el mismo registro y la misma profundidad que bases.situar; sin cohorte en el génesis y en el propio proyecto', async () => {
  const { ej } = await ejemplo();
  const { eje } = ej;
  for (const foco of [ej.guisos.id, ej.compra.id, ej.manzanas.id, ej.menu.id, ej.cuenta.id]) {
    for (const cohorte of COHORTES) {
      const c = registroDeCohorte(eje, foco, cohorte);
      const s = situar(eje, foco, { cohorte });
      if (c) assert.deepEqual([c.registro, c.profundidad], [s.registro, s.profundidad], cohorte);
      else assert.equal(s.estado, 'PENDIENTE');
    }
  }
  assert.equal(registroDeCohorte(eje, eje.genesisId, 'hermanos'), null);
  assert.equal(registroDeCohorte(eje, ej.alta.id, 'proyecto'), null, 'un proyecto no tiene proyecto encima');
  assert.deepEqual(registroDeCohorte(eje, ej.guisos.id, 'general'), { registro: eje.genesisId, profundidad: 3 });
  assert.throws(() => registroDeCohorte(eje, ej.guisos.id, 'mejores'), /cohorte desconocida/);
});

test('base al vuelo: la de hermanos es baseDe; la general, la misma que funden las bases escritas', async () => {
  const ej = await conBases();
  const { eje } = ej;
  const n = eje.orden.length;
  const v = baseAlVuelo(eje, ej.menu.id, 1);
  assert.deepEqual(estadistica(v), estadistica(baseDe(eje, ej.menu.id)));
  assert.equal(v.escrita, false);
  assert.equal(v.desde, 'al vuelo');
  assert.deepEqual(v.refs, baseDe(eje, ej.menu.id).refs);
  // Las bases fundidas del 8 del génesis (profundidad 3) resumen lo mismo que medir las compras una a una.
  const g = leerBase(eje, eje.genesisId);
  const alVuelo = baseAlVuelo(eje, eje.genesisId, 3);
  assert.equal(alVuelo.n, g.n);
  for (const m of Object.keys(g.medidas)) assert.deepEqual(alVuelo.medidas[m], g.medidas[m], m);
  assert.equal(eje.orden.length, n, 'no escribe');
  assert.throws(() => baseAlVuelo(eje, ej.menu.id, 0), /profundidad/);
});

test('datos: con base escrita leen el 8 (lo mismo que situar, sin la etiqueta de hitos); sin base, al vuelo y marcada', async () => {
  const { ej } = await ejemplo();
  const sin = datosCielo(ej.eje, ej.guisos.id, { cohorte: 'hermanos' });
  assert.equal(sin.estado, 'RESUELTO');
  assert.equal(sin.escrita, false);
  assert.equal(sin.base.id, null);
  assert.equal(sin.incluido, true);
  assert.equal(sin.base.n, baseDe(ej.eje, ej.menu.id).n);
  const enMemoria = situarEnBase(baseAlVuelo(ej.eje, ej.menu.id, 1), medir(ej.eje, ej.guisos.id));
  for (const m of sin.medidas) {
    const { medida, cajas, ...resto } = m;
    assert.deepEqual(resto, enMemoria[medida], medida);
    assert.equal(cajas.reduce((s, c) => s + c, 0), sin.base.n, 'las diez cajas suman n');
  }

  const con = await conBases();
  for (const cohorte of COHORTES) {
    const d = datosCielo(con.eje, con.guisos.id, { cohorte });
    const s = situar(con.eje, con.guisos.id, { cohorte });
    assert.equal(d.escrita, true, cohorte);
    assert.equal(d.base.id, s.base);
    assert.equal(d.base.n, s.n);
    assert.deepEqual(d.base.frescura, s.frescura);
    for (const m of d.medidas) {
      const { etiqueta, ...esperado } = s.medidas[m.medida];
      const { medida, cajas, ...resto } = m;
      assert.deepEqual(resto, esperado, cohorte + ' ' + medida);
      assert.ok(!('etiqueta' in m), 'sin hitos: el cielo no asigna nivel');
    }
    // Situar en memoria con la base leída da lo mismo que situar con la escrita.
    const leida = leerBase(con.eje, d.registro, { profundidad: d.profundidad });
    const mem = situarEnBase(leida, medir(con.eje, con.guisos.id));
    for (const m of d.medidas) assert.equal(mem[m.medida].caja, m.caja);
  }
});

test('sin cohorte: el génesis no tiene hermanos; el cielo lo dice sin inventar nada', async () => {
  const { ej } = await ejemplo();
  const d = datosCielo(ej.eje, ej.eje.genesisId);
  assert.equal(d.estado, 'SIN COHORTE');
  assert.match(d.motivo, /génesis no tiene padre/);
  assert.deepEqual(d.medidas, []);
  const svg = svgCielo(d);
  assert.ok(svg.includes('sin cohorte') && !svg.includes('class="constelacion"'));
  assert.equal(datosCielo(ej.eje, ej.alta.id, { cohorte: 'proyecto' }).estado, 'SIN COHORTE');
  assert.match(htmlCielo(d), /sin cohorte: el génesis no tiene padre/);
});

test('svg: función pura, una constelación por medida con diez estrellas y el foco en su caja', async () => {
  const { ej } = await ejemplo();
  const d = datosCielo(ej.eje, ej.guisos.id, { cohorte: 'general' });
  const svg = svgCielo(d);
  assert.equal(svgCielo(d), svg, 'determinista');
  assert.ok(svg.startsWith('<svg class="cielo sin-escribir" viewBox="0 0 400 '));
  assert.ok(svg.endsWith('</svg>'));
  assert.ok(!/NaN|undefined|Infinity/.test(svg), 'sin números rotos');
  assert.ok(svg.includes('data-escrita="false"') && !svg.includes('data-evento='), 'sin escribir: no hay evento detrás');
  assert.deepEqual(constelaciones(svg), d.medidas.map((m) => m.medida));
  assert.deepEqual(d.medidas.map((m) => m.medida), ordenMedidas(d.medidas.map((m) => m.medida)), 'orden fijo de medidas');
  assert.deepEqual(d.medidas.slice(0, 6).map((m) => m.medida), MEDIDAS_REGISTRO);
  for (const m of d.medidas) {
    const bloque = svg.slice(svg.indexOf(`data-medida="${m.medida}"`)).split('</g><g class="constelacion"')[0];
    const estrellas = [...bloque.matchAll(/<g class="estrella[^"]*" data-caja="(\d)" data-cuenta="(\d+)"/g)];
    assert.equal(estrellas.length, 10, m.medida);
    assert.deepEqual(estrellas.map((e) => Number(e[2])), m.cajas, 'cada estrella es una caja con su recuento');
    // El anillo del foco está sobre la estrella de su caja.
    const cxCaja = new RegExp(`data-caja="${m.caja}"[^]*?<circle class="astro" cx="([\\d.]+)" cy="([\\d.]+)"`).exec(bloque);
    const anillo = /<circle class="anillo" cx="([\d.]+)" cy="([\d.]+)"/.exec(bloque);
    assert.deepEqual([anillo[1], anillo[2]], [cxCaja[1], cxCaja[2]], m.medida);
  }
  assert.equal((svg.match(/class="anillo"/g) ?? []).length, d.medidas.length, 'un foco por constelación');
  assert.ok(svg.includes(`data-efecto="${EFECTOS.constelacion}"`) && svg.includes(`data-efecto="${EFECTOS.caja}"`));
  assert.ok([...svg.matchAll(/data-decision="([^"]*)"/g)].every((x) => x[1].startsWith('[X] decidir VG')));
  // Con base escrita, el SVG apunta a su evento.
  const con = await conBases();
  const dc = datosCielo(con.eje, con.guisos.id);
  const sc = svgCielo(dc);
  assert.ok(sc.includes('class="cielo escrita"') && sc.includes(`data-evento="${dc.base.id}"`));
});

test('brillo: proporcional al recuento (área y opacidad crecen con él); una caja vacía es un hueco', () => {
  const n = 8;
  const b = [0, 1, 2, 4, 8].map((c) => brillo(c, n));
  assert.equal(b[0].encendida, false);
  for (let i = 2; i < b.length; i++) {
    assert.ok(b[i].r > b[i - 1].r && b[i].o > b[i - 1].o, 'crece con el recuento');
  }
  // Área proporcional: el doble de registros, el doble de área.
  assert.ok(Math.abs((b[4].r / b[3].r) ** 2 - 2) < 1e-9);
  assert.equal(brillo(3, 0).encendida, false);
});

test('sin nivel ni grado: las cajas se rotulan con su tramo de valores; las cohortes van siempre en el mismo orden', async () => {
  const { ej } = await ejemplo();
  for (const cohorte of COHORTES) {
    const d = datosCielo(ej.eje, ej.guisos.id, { cohorte });
    const html = htmlCielo(d) + htmlCieloSobrio(d);
    for (const h of ETIQUETAS) assert.ok(!html.includes(h.nombre), 'sin el hito «' + h.nombre + '»');
    const orden = [...html.matchAll(/data-cohorte="([a-z]+)" aria-pressed="(true|false)"/g)];
    assert.deepEqual(orden.slice(0, 3).map((x) => x[1]), COHORTES, 'orden fijo');
    assert.deepEqual(orden.slice(0, 3).filter((x) => x[2] === 'true').map((x) => x[1]), [cohorte]);
  }
  assert.equal(selectorCohorte('general'), selectorCohorte('general'));
  assert.equal(rangoDeCaja('posiciones', 0), '0');
  assert.equal(rangoDeCaja('posiciones', 4), '4–5');
  assert.equal(rangoDeCaja('posiciones', 9), '≥ 42');
  assert.equal(rangoDeCaja('identidades', 3), '3');
  assert.equal(rangoDeCaja('movimientos.T:hora', 9), '≥ 9');
});

test('transición: al cambiar de cohorte cada estrella y el foco se recomponen desde la cohorte anterior', async () => {
  const { ej } = await ejemplo();
  const hermanos = datosCielo(ej.eje, ej.guisos.id, { cohorte: 'hermanos' });
  const general = datosCielo(ej.eje, ej.guisos.id, { cohorte: 'general' });
  assert.notEqual(hermanos.base.n, general.base.n);
  const svg = svgCielo(general, { anterior: hermanos });
  assert.ok(svg.includes('class="cielo sin-escribir recompone"') && svg.includes('data-transicion="cohorte"'));
  const estrellas = [...svg.matchAll(/<g class="estrella[^"]*" data-caja="\d" data-cuenta="\d+" style="--s0:([\d.]+);--o0:([\d.]+)"/g)];
  assert.equal(estrellas.length, general.medidas.length * 10, 'cada estrella sabe de dónde viene');
  assert.ok(estrellas.some((e) => Number(e[1]) !== 1), 'alguna cambia de brillo');
  assert.ok(estrellas.every((e) => Number(e[2]) <= 1));
  assert.equal((svg.match(/class="foco-cielo"[^>]*style="--dx0:/g) ?? []).length, general.medidas.length);
  // Sin anterior, con la misma cohorte o con otro foco, nada se recompone.
  assert.ok(!svgCielo(general).includes('recompone'));
  assert.ok(!svgCielo(general, { anterior: general }).includes('recompone'));
  assert.ok(!svgCielo(general, { anterior: datosCielo(ej.eje, ej.fruta.id, { cohorte: 'hermanos' }) }).includes('recompone'));
  assert.ok(!svgCielo(general, { anterior: datosCielo(ej.eje, ej.eje.genesisId) }).includes('recompone'));
});

test('celda 8 de Mapped: las seis medidas del registro, sin rótulos, en la caja de las celdas de los hilos', async () => {
  const { ej } = await ejemplo();
  const d = datosCielo(ej.eje, ej.guisos.id);
  const svg = svgCielo(d, { compacto: true });
  assert.ok(svg.startsWith('<svg class="cielo compacto sin-escribir" viewBox="0 0 200 124"'));
  assert.deepEqual(constelaciones(svg), MEDIDAS_REGISTRO);
  assert.ok(!svg.includes('<text'));
});

test('sobrio y animado leen lo mismo: la tabla dice el valor del foco, su caja y cuántos quedan debajo, en ella y encima', async () => {
  const { ej } = await ejemplo();
  const d = datosCielo(ej.eje, ej.guisos.id, { cohorte: 'proyecto' });
  const html = htmlCieloSobrio(d);
  const filas = [...html.matchAll(/<div class="medida-fila">/g)];
  assert.equal(filas.length, d.medidas.length);
  for (const m of d.medidas) assert.ok(html.includes(`foco <b>${m.valor}</b> · caja ${m.caja} (${rangoDeCaja(m.medida, m.caja)})</span><span class="medida-cohorte">${m.debajo} debajo · ${m.enCaja} en su caja · ${m.encima} encima`), m.medida);
  assert.match(html, /sin escribir/);
  assert.match(htmlCielo(d), /<figure class="cielo-vista">.*<svg class="cielo/s);
});

test('los nombres de efecto son los del catálogo, vistos desde el cielo', () => {
  assert.equal(EFECTOS.constelacion, verEn({ tipo: 'escrito' }, 8).nombre);
  assert.equal(EFECTOS.caja, verEn({ tipo: 'sustituir' }, 8).nombre);
});
