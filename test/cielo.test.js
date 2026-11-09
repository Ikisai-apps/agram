import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploComprasHermanas, escribirBasesDelEjemplo } from '../ejemplos/ikisai/compras-hermanas.mjs';
import { calcularBase, situar, confluir, medir, clavesDeMedidas, ETIQUETAS, SIN_BASE_ESCRITA, escribirBase } from '../src/bases.js';
import { verEn } from '../src/efectos.js';
import {
  COHORTES, DECUPLA, EFECTOS, registroDeCohorte, rangoDeCaja, datosCielo, svgCielo, htmlCielo,
  htmlCieloSobrio, selectorCohorte, brillo, estadoBase, efectosEnCielo, posicionesDelFoco,
} from '../antigua/mundos/cielo.js';

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

test('sin base escrita: el respaldo declarado (bases.confluir) mide lo que escribiría calcularBase en los hermanos; no escribe nada', async () => {
  const ej = await sinBases();
  const { eje } = ej;
  const n = eje.orden.length;
  const d = datosCielo(eje, ej.guisos.id, { cohorte: 'hermanos' });
  const c = confluir(eje, ej.guisos.id);
  assert.deepEqual([d.escrita, d.base.id, d.base.frescura, d.base.n], [false, null, SIN_BASE_ESCRITA, calcularBase(eje, ej.menu.id).hijos.n]);
  assert.deepEqual(c.comparables.map((x) => x.id), calcularBase(eje, ej.menu.id).refsHijos);
  // Las constelaciones son las cantidades (R7); los recuentos van aparte, como información y sin cajas.
  for (const [k, x] of Object.entries(c.tokens)) assert.deepEqual(d.medidas.find((m) => m.medida === k).cajas, x.cajas, k);
  for (const k of clavesDeMedidas()) assert.deepEqual([d.recuentos.find((r) => r.medida === k).valor, 'cajas' in d.recuentos.find((r) => r.medida === k)], [c.medidas[k].foco, false], k);
  assert.equal(datosCielo(eje, ej.guisos.id, { cohorte: 'general' }).base.n, eje.orden.length, 'general: todo el eje (sin bases)');
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
  // Encargo 3b: las altas de huesped y vecina cuelgan de las invitaciones de la casa (mapa §16 [D]); para que la base
  // del génesis vea todo el eje, la casa escribe antes la base de cada invitación (por poder: las escribió ella). Sin
  // ellas, lo que cuelga de las invitaciones no cuenta en la base escrita (sinBase) y no sería lo calculado al vuelo.
  for (const id of ['huesped', 'vecina']) await escribirBase(ej.eje, { registro: ej.eje.obtener(ej.eje.alta(id).id).sobre, autor: 'casa', privada: ej.claves.casa.privada, t: '2026-11-07T18:00:00Z' });
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
  // Con base escrita, el cielo lee la escrita, no el respaldo: su frescura es la de la base.
  const s = situar(ej.eje, ej.guisos.id, { alcance: 'proyecto' });
  const d = datosCielo(ej.eje, ej.guisos.id, { cohorte: 'proyecto' });
  assert.deepEqual([d.escrita, d.base.id, d.base.autor], [true, s.base, 'comedor']);
  assert.equal(typeof d.base.frescura, 'object');
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
  // R7: una constelación por cantidad (las series y el T consumido sobre el registro); los recuentos no tienen cielo.
  const tokens = d.medidas.filter((m) => m.tipo === 'caja').map((m) => m.medida);
  assert.ok(tokens.some((k) => k.startsWith('tiempo:')), 'el T consumido sobre el registro es una cantidad del 8');
  assert.deepEqual(constelaciones(svg), [DECUPLA, ...tokens]);
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
  // Sin escribir no hay evento detrás: el cielo es lectura al vuelo y no nombra efecto.
  assert.ok(!svg.includes('data-efecto='), 'sin escribir, ningún efecto');
  assert.ok([...svg.matchAll(/data-decision="([^"]*)"/g)].every((x) => x[1].startsWith('[X] decidir VG')));
  // La décupla: las posiciones van en línea recta y sin trazo (son puntos de vista, no un orden).
  const decupla = bloqueDe(svg, DECUPLA);
  assert.equal(new Set([...decupla.matchAll(/<circle class="astro" cx="[\d.]+" cy="([\d.]+)"/g)].map((x) => x[1])).size, 1, 'plana');
  assert.ok(!decupla.includes('class="trazo"'));
  const tminuto = d.medidas.find((m) => m.medida === 'T:minuto');
  assert.ok(bloqueDe(svg, 'T:minuto').includes('class="trazo"') || tminuto.cajas.filter(Boolean).length < 2);
  // Con base escrita, el SVG apunta a su evento y cada constelación lleva el nombre que el catálogo da a ese evento visto desde el 8.
  const con = await ejemploComprasHermanas();
  await escribirBasesDelEjemplo(con);
  const dc = datosCielo(con.eje, con.guisos.id);
  const sc = svgCielo(dc);
  assert.ok(sc.includes('class="cielo escrita"') && sc.includes(`data-evento="${dc.base.id}"`));
  assert.deepEqual(dc.base.efectos, efectosEnCielo(con.eje, dc.base.id));
  assert.ok(dc.base.efectos.includes(EFECTOS.constelacion), 'escribir una base es «constelación» en el 8');
  assert.equal((sc.match(new RegExp(`class="constelacion[^"]*" data-medida="[^"]+" data-efecto="${EFECTOS.constelacion}" data-mundo="8"`, 'g')) ?? []).length, dc.medidas.length);
  assert.equal(sc.includes(`data-efecto="${EFECTOS.caja}"`), dc.base.efectos.includes(EFECTOS.caja), 'el anillo solo nombra «caja» si el evento lo es');
});

test('una base nueva para quien mira: sus constelaciones nacen; sin evento detrás, nada nace', async () => {
  const con = await ejemploComprasHermanas();
  const sin = datosCielo(con.eje, con.guisos.id);
  assert.ok(!svgCielo(sin, { nuevos: new Set(con.eje.orden) }).includes('nace'), 'sin escribir no hay evento que animar');
  await escribirBasesDelEjemplo(con);
  const d = datosCielo(con.eje, con.guisos.id);
  const quieto = svgCielo(d, { nuevos: new Set() });
  assert.ok(!quieto.includes('nace') && !quieto.includes(' nueva'));
  const nueva = svgCielo(d, { nuevos: new Set([d.base.id]) });
  assert.ok(nueva.startsWith('<svg class="cielo escrita nueva"') && nueva.includes(`data-nueva="${d.base.id}"`));
  const nacen = [...nueva.matchAll(/<g class="estrella encendida nace" data-caja="(\d)" data-cuenta="\d+" style="--retardo:([\d.]+)s"/g)];
  const encendidas = d.medidas.reduce((s, m) => s + m.cajas.filter((c) => c > 0).length, 0);
  assert.equal(nacen.length, encendidas, 'cada estrella encendida nace, caja a caja');
  assert.ok(nacen.every((x) => Math.abs(Number(x[2]) - Number(x[1]) * 0.06) < 1e-9));
  assert.ok(!nueva.includes('class="estrella hueco nace'), 'los huecos no nacen');
  // Una base nueva que no es la que se lee no anima este cielo; cambiar de cohorte (lectura) manda sobre el nacimiento.
  assert.ok(!svgCielo(d, { nuevos: new Set([con.eje.orden[0]]) }).includes('nace'));
  const otra = datosCielo(con.eje, con.guisos.id, { cohorte: 'general' });
  assert.ok(!svgCielo(d, { anterior: otra, nuevos: new Set([d.base.id]) }).includes(' nace'));
  assert.match(htmlCielo(d, { nuevos: new Set([d.base.id]) }), /<svg class="cielo escrita nueva"/);
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
  // Cada estrella con brillo sabe de dónde viene: tamaño relativo (--s0) y opacidad anterior en valor absoluto (--o0), sin recortar.
  const recuento = (desde, hacia) => {
    const dibujo = svgCielo(hacia, { anterior: desde });
    const previas = new Map(desde.medidas.map((m) => [m.medida, m]));
    const r = { mengua: 0, apagadas: 0 };
    for (const m of hacia.medidas) {
      const antes = previas.get(m.medida);
      const estrellas = [...bloqueDe(dibujo, m.medida).matchAll(/<g class="(estrella [^"]*)" data-caja="(\d)"[^>]*>(.*?)<\/g>/g)];
      assert.equal(estrellas.length, 10, m.medida);
      for (const [, clases, k, cuerpo] of estrellas) {
        const a = brillo(antes?.cajas[Number(k)] ?? 0, desde.base.n);
        const b = brillo(m.cajas[Number(k)], hacia.base.n);
        if (b.encendida) {
          assert.equal(clases, 'estrella encendida cambia');
          assert.match(cuerpo, new RegExp(`<circle class="astro" [^>]*opacity="${Math.round(b.o * 100) / 100}" style="--o0:${Math.round(a.o * 100) / 100}"/>`));
          if (a.o > b.o) r.mengua += 1;
        } else if (a.encendida) {
          assert.equal(clases, 'estrella hueco se-apaga', 'la que se apaga se desvanece donde estaba');
          assert.match(cuerpo, new RegExp(`<circle class="apagada" [^>]*r="${Math.round(a.r * 10) / 10}" style="--o0:${Math.round(a.o * 100) / 100}"/>`));
          r.apagadas += 1;
        } else {
          assert.equal(clases, 'estrella hueco', 'un hueco que sigue hueco no se mueve');
        }
      }
    }
    return r;
  };
  const ida = recuento(hermanos, general);
  const vuelta = recuento(general, hermanos);
  assert.ok(ida.mengua + vuelta.mengua > 0, 'alguna estrella pierde brillo y se anima desde el que tenía');
  assert.ok(vuelta.apagadas > 0, 'al volver a los hermanos, alguna se apaga');
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

test('celda 8 de Mapped: la décupla y el T consumido sobre el registro (cantidades, R7), sin rótulos, en la caja de las celdas de los hilos', async () => {
  const ej = await sinBases();
  const d = datosCielo(ej.eje, ej.guisos.id);
  const svg = svgCielo(d, { compacto: true });
  assert.ok(svg.startsWith('<svg class="cielo compacto sin-escribir" viewBox="0 0 200 124"'));
  assert.deepEqual(constelaciones(svg), [DECUPLA, ...d.medidas.filter((m) => m.medida.startsWith('tiempo:')).map((m) => m.medida)]);
  assert.ok(!svg.includes('<text'));
});

test('sobrio y animado leen lo mismo: la tabla dice el valor del foco, su caja y cuántos quedan debajo, en ella y encima', async () => {
  const ej = await sinBases();
  const d = datosCielo(ej.eje, ej.guisos.id, { cohorte: 'proyecto' });
  const html = htmlCieloSobrio(d);
  assert.equal((html.match(/<div class="medida-fila">/g) ?? []).length, d.medidas.length);
  for (const m of d.medidas.filter((x) => x.tipo === 'caja')) {
    const cuota = m.cuota === null ? '—' : String(Math.round(m.cuota * 100) / 100);
    assert.ok(html.includes(`foco <b>${m.valor}</b> · caja ${m.caja} (${rangoDeCaja(m.cortes, m.caja)}) · cuota ${cuota}</span><span class="medida-cohorte">${m.debajo} debajo · ${m.enCaja} en su caja · ${m.encima} encima`), m.medida);
  }
  // Los recuentos, aparte: informativos, sin caja (R7).
  assert.equal((html.match(/<div class="medida-fila recuento">/g) ?? []).length, d.recuentos.length);
  for (const r of d.recuentos) assert.ok(html.includes(`foco <b>${r.valor}</b> · recuento informativo`), r.medida);
  const pv = d.medidas.find((m) => m.tipo === 'pv');
  assert.ok(html.includes(`en el foco (●): <b>${posicionesDelFoco(pv)}</b>`));
  assert.equal(posicionesDelFoco(pv), pv.focoEn.map((t, k) => (t ? k : null)).filter((k) => k !== null).join(' '));
  assert.equal(posicionesDelFoco({ focoEn: Array(10).fill(false) }), 'ninguna');
  // Sin nota: ni «de 10» en la tabla ni en el cielo.
  assert.ok(!/de 10/.test(html) && !/de 10/.test(svgCielo(d)));
  assert.ok(svgCielo(d).includes(`>en el foco: ${posicionesDelFoco(pv)}</text>`));
  assert.match(html, /sin base escrita/);
  assert.match(estadoBase(d), /sin base escrita<\/span> respaldo calculado al vuelo sobre \d+ registros? \(el subárbol de <button[^>]+>[0-9a-f]{8}<\/button>\): su 8 no tiene base escrita$/);
  assert.match(htmlCielo(d), /<figure class="cielo-vista">.*<svg class="cielo/s);
});

test('concordancia: «1 registro», «1 constelación»', () => {
  const uno = { cohorte: 'hermanos', foco: 'f'.repeat(64), estado: 'RESUELTO', escrita: false, base: { id: null, n: 1, efectos: [] }, medidas: [] };
  assert.match(svgCielo(uno), /aria-label="Cielo de ffffffff entre hermanos: 1 registro, 0 constelaciones, sin base escrita"/);
});

test('los nombres de efecto son los del catálogo, vistos desde el cielo', () => {
  assert.equal(EFECTOS.constelacion, verEn({ tipo: 'escrito' }, 8).nombre);
  assert.equal(EFECTOS.caja, verEn({ tipo: 'sustituir' }, 8).nombre);
});
