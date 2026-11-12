// El animado como capas sobre el sobrio en la pantalla completa de Mapped (VG, 11-11, cerrado): «el animado es el
// sobrio añadiéndole las imágenes animadas y los fondos». Un solo DOM: la rejilla de cada mundo es la del sobrio y el
// animado solo AÑADE nodos con la clase `capa` (el fondo del mundo, la etapa del pulsado, el dibujo del mundo en cada
// hijo, el personaje en el hueco, los efectos de lo nuevo y el marco). Quitar del HTML animado todo nodo .capa da
// exactamente el HTML sobrio. Qué dibujo va en qué celda es un dato: la correspondencia del tipo elemento en la
// cabecera de los modelos (epoch.9.7.0.4), leída con modelos.corresponde; dónde va cada capa, CSS por data-forma.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { arbol, preferencias, ampliarTodos, medidasDePantalla, NIVEL } from '../carta/carta.js';
import { html, trasPintar } from '../carta/dom.js';
import * as C from '../src/contrato.js';
import * as modelos from '../src/modelos.js';
import { EPOCA_0_BTML } from '../src/epocas.js';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';

const GRANDE = { ancho: 1920, alto: 1080 };
const MUNDOS = [1, 2, 3, 4, 6, 7, 8, 9];
const T1 = '2026-11-08T10:00:00Z';
const minuto = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const CSS = readFileSync(new URL('../carta/estilo.css', import.meta.url), 'utf8');

/** Las filas que VG fijó (11-11): por dado, el nombre del elemento en cada mundo. */
const FILAS = {
  hijo: { 1: 'tienda', 2: 'parterre', 3: 'estanque', 4: 'estacion', 8: 'constelacion', 9: 'hito' },
  ocupante: { 1: 'mercancia', 2: 'flor', 3: 'paquete', 4: 'pieza', 6: 'cuenta-pasado', 7: 'cuenta-futuro', 8: 'estrella', 9: 'paso' },
  vacio: { 8: 'polvo' },
  actual: { 9: 'puerta' },
  hecho: { 4: 'sello' },
  repetido: { 6: 'cuenta-ciclo' },
  persona: { 3: 'bano' },
  cerrado: { 3: 'verja' },
};

/** La huésped en animado con el modelo de la fase 2 (general): la cadena lo trae delante del genérico y del sobrio. */
async function animado(eje, quien = 'huesped') {
  const p = preferencias(eje, quien, { render: 'animated', model: 'general' });
  await eje.escribir({ autor: quien, sobre: p.sobre, en: p.en, t: T1, movimientos: [minuto(quien)], payload: p.payload });
}

/** Una compra con una «Carpeta» colgada (1 → «Nota» → «Hoja»), para bajar al nivel 2. */
async function conCarpeta() {
  const { eje, compra } = await ejemploCompra();
  const hoja = await eje.escribir({ autor: 'casa', sobre: compra.id, t: '2026-11-08T09:00:00Z', movimientos: [minuto('casa')], payload: [['Hoja']] });
  const nota = await eje.escribir({ autor: 'casa', sobre: compra.id, t: '2026-11-08T09:01:00Z', movimientos: [minuto('casa')], payload: [['Nota'], [{ ref: hoja.id }]] });
  const carpeta = await eje.escribir({ autor: 'casa', sobre: compra.id, t: '2026-11-08T09:02:00Z', movimientos: [minuto('casa')], payload: [['Carpeta'], [{ ref: nota.id }]] });
  return { eje, compra, hoja, nota, carpeta };
}

/** El centro abierto a pantalla completa, sin su etiqueta de apertura: de la cabecera del mundo al final del mapa. */
const centroDe = (h) => {
  const desde = h.indexOf('<header class="nucleo-cabeza"');
  const hasta = h.indexOf('<nav class="vecinos"', desde);
  assert.ok(desde > 0 && hasta > desde, 'pantalla completa');
  return h.slice(desde, hasta);
};

const VACIOS = new Set(['img', 'br', 'input', 'meta', 'link', 'hr', 'source', 'wbr']);
/** El HTML sin ningún nodo de clase `capa` (o la que se diga), con todo lo que lleva dentro. */
function sinCapas(h, quitar = 'capa') {
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let fuera = '';
  let desde = 0;
  let saltando = null;
  let m;
  while ((m = re.exec(h))) {
    const [todo, cierre, nombre, attrs] = m;
    const tag = nombre.toLowerCase();
    if (saltando) {
      if (tag === saltando.tag && !VACIOS.has(tag)) saltando.n += cierre ? -1 : 1;
      if (saltando.n === 0) { saltando = null; desde = m.index + todo.length; }
      continue;
    }
    const clase = /\bclass="([^"]*)"/.exec(attrs)?.[1] ?? '';
    if (!cierre && clase.split(/\s+/).includes(quitar)) {
      fuera += h.slice(desde, m.index);
      if (VACIOS.has(tag)) desde = m.index + todo.length;
      else saltando = { tag, n: 1 };
    }
  }
  return fuera + (saltando ? '' : h.slice(desde));
}

test('sinCapas quita cada nodo .capa entero y nada más', () => {
  const h = '<div class="a"><img class="pieza capa x" src="./a.svg"><p>hola</p><div class="capa capa-dibujo"><div><img src="b"></div></div><span class="capaz">sí</span></div>';
  assert.equal(sinCapas(h), '<div class="a"><p>hola</p><span class="capaz">sí</span></div>');
});

test('la correspondencia del elemento es un dato de la cabecera (epoch.9.7.0.4): una fila por dado, sus claves emparejadas con sus mundos, y se lee con modelos.corresponde', () => {
  const tipo = EPOCA_0_BTML.registro[9][7][0][4].find((t) => t[0][0] === 'elemento');
  const filas = tipo[2];
  assert.ok(filas.length <= 10, 'una décupla');
  assert.deepEqual(filas.map((f) => f[0][0]), Object.keys(FILAS));
  for (const f of filas) assert.equal(f[1].length, f[2].length, 'cada clave con su mundo: ' + f[0][0]);
  const c = modelos.cabecera();
  for (const [dado, porMundo] of Object.entries(FILAS)) {
    for (const pv of MUNDOS) {
      const esperado = porMundo[pv] ?? dado; // sin fila, lo dado tal cual: la carta no dibuja nada
      assert.equal(modelos.corresponde(c, 'elemento', dado, pv), esperado, dado + ' en el ' + pv);
    }
  }
  // Las demás correspondencias no cambian: el rol por defecto del muñequito, la primitiva → el efecto.
  assert.equal(modelos.rolPorDefecto(c, 'munequito', 1), 'vendedor');
  assert.equal(modelos.corresponde(c, 'movimiento', 'acunar', 6), 'crear-pasado');
  assert.equal(modelos.corresponde(c, 'movimiento', 'acunar', 2), 'crear-abajo');
  // Y cada nombre de una fila es un elemento que el modelo general tiene en ese mundo (el arte de la fase 2).
  const general = modelos.modelosDeLaEpoca().find((m) => m.nombre === 'general');
  for (const porMundo of Object.values(FILAS)) {
    for (const [pv, nombre] of Object.entries(porMundo)) assert.ok(general.piezas.some((p) => p.tipo === 'elemento' && p.pv === Number(pv) && p.subclave === nombre), nombre + ' en el ' + pv);
  }
});

test('mismo DOM: en la pantalla completa de los ocho mundos y en el nivel 2 del 1, del 2 y del 3, quitar del animado los nodos .capa da exactamente el sobrio', async () => {
  const { eje, compra, nota } = await conCarpeta();
  const casos = [...MUNDOS.map((pv) => ({ pv, estado: { foco: { X: compra.id, pv } } })), ...[1, 2, 3].map((pv) => ({ pv, nivel: 2, estado: { foco: { X: compra.id, pv }, profundidad: { [pv]: [nota.id] } } }))];
  const sobrio = [];
  for (const k of casos) {
    const a = await arbol(k.estado, eje, 'huesped', GRANDE);
    assert.equal(a.animado, false);
    assert.equal(a.centro.rejilla.nivel, k.nivel ?? 1);
    const h = centroDe(html(a));
    assert.doesNotMatch(h, /class="[^"]*\bcapa\b/, 'el sobrio no lleva capas');
    sobrio.push(h);
  }
  await animado(eje);
  for (const [i, k] of casos.entries()) {
    const a = await arbol(k.estado, eje, 'huesped', GRANDE);
    assert.equal(a.animado, true);
    const h = centroDe(html(a));
    const capas = (h.match(/class="[^"]*\bcapa\b/g) ?? []).length;
    assert.ok(capas >= 4, `el animado añade capas (mundo ${k.pv}${k.nivel ? ', nivel 2' : ''}): ${capas}`);
    assert.equal(sinCapas(h), sobrio[i], `mundo ${k.pv}${k.nivel ? ', nivel 2' : ''}: el animado es el sobrio más capas`);
  }
});

test('las capas de cada mundo: fondo, etapa (en la tarjeta de la cruceta o en la cabecera), el dibujo de la correspondencia en cada hijo, el personaje en el hueco y el marco', async () => {
  const { eje, compra } = await ejemploCompra();
  await animado(eje);
  const c = modelos.cabecera();
  const cadena = modelos.modelo(eje, 'huesped');
  const madurez = C.madurez(eje, compra.id);
  for (const pv of MUNDOS) {
    const a = await arbol({ foco: { X: compra.id, pv } }, eje, 'huesped', GRANDE);
    const r = a.centro.rejilla;
    const h = centroDe(html(a));
    // 1 · el fondo: el del escenario del mundo (por la madurez del foco), debajo de todo
    assert.ok(r.capas.fondo?.recurso.includes('/fondo/'), 'fondo del ' + pv);
    assert.equal(r.capas.fondo.recurso, a.centro.fondo.recurso);
    assert.match(h, new RegExp(`<div class="rejilla rejilla-completa"[^>]*><img class="pieza capa pieza-fondo capa-fondo pieza-imagen" src="\\./${r.capas.fondo.recurso}"`), 'el fondo es lo primero de la rejilla');
    // 2 · la etapa del pulsado: en la cruceta, dentro de la cara 0 de la tarjeta; si no, en la cabecera del mundo
    const etapa = modelos.pieza(cadena, 'etapa', pv, madurez.nivel, c.variantes[[1, 3, 6].includes(pv) ? 1 : [2, 4, 7].includes(pv) ? 2 : 0], { tamano: a.centro.tamano.tamano, de: madurez.de });
    assert.equal(r.capas.etapa.recurso, etapa.recurso, 'etapa del ' + pv);
    if (r.forma === 'cruceta') {
      assert.match(h, /<section class="flotante-cara cara-0">(?:(?!<\/section>)[\s\S])*class="pieza capa pieza-etapa capa-etapa pieza-imagen"/, 'la etapa en la cara 0');
      assert.doesNotMatch(h, /<section class="flotante-cara cara-5"(?:(?!<\/section>)[\s\S])*capa-etapa/, 'en la cara 5 no');
      assert.doesNotMatch(h, /capa-etapa-cabeza/);
    } else {
      assert.match(h, /^<header class="nucleo-cabeza">(?:(?!<\/header>)[\s\S])*<span class="quien">[^<]*<img class="pieza capa pieza-etapa capa-etapa capa-etapa-cabeza pieza-imagen"/, 'la etapa en la cabecera del ' + pv);
    }
    // 3 · el dibujo de la correspondencia dentro de cada hijo
    for (const celda of r.celdas ?? []) {
      const lista = celda.ocupantes ?? [];
      const hijo = r.forma === 'matriz' ? null : celda.vacio || !lista.length ? FILAS.vacio[pv] : FILAS.hijo[pv];
      assert.equal(celda.capa.hijo?.subclave ?? null, hijo ?? null, `el hijo ${celda.pv} del ${pv}`);
      assert.equal(celda.capa.ocupantes.length, lista.length, 'un dibujo por ocupante');
      for (const [k, d] of celda.capa.ocupantes.entries()) {
        const o = lista[k];
        const persona = o.tipo === 'hoja' && eje.esPersona(o.valor) === true && FILAS.persona[pv];
        assert.equal(d.subclave, persona || FILAS.ocupante[pv], `ocupante ${k} del hijo ${celda.pv} del ${pv}`);
      }
    }
    for (const b of r.bandas ?? []) {
      const llena = b.items.length || b.mas;
      assert.equal(b.capa.hijo?.subclave ?? null, (llena ? FILAS.hijo[pv] : b.foco ? null : FILAS.vacio[pv]) ?? null, `la banda ${b.indice} del ${pv}`);
      for (const o of b.items) assert.equal(o.dibujo?.subclave ?? null, FILAS.ocupante[pv] ?? null);
    }
    // 4 · el personaje: el del rol por defecto del mundo, esperando en bucle, en el hueco (hijo directo de la rejilla, por data-forma)
    assert.equal(r.capas.personaje.rol, modelos.rolPorDefecto(c, 'munequito', pv));
    assert.deepEqual([r.capas.personaje.accion, r.capas.personaje.animar], ['esperar', 'bucle']);
    assert.equal((h.match(/class="capa capa-personaje"/g) ?? []).length, 1, 'un personaje por mundo');
    assert.match(h, /<div class="capa capa-personaje" style="--columnas:\d+;--filas:\d+"[^>]*><img class="pieza respaldo pieza-imagen" src="[^"]+-base-[^"]+\.svg"[^>]*><div class="pieza pieza-personaje accion-esperar pieza-lottie" data-lottie="[^"]+" data-fotograma="0" data-animar="1" data-bucle="1" data-prioridad="1"/, 'detrás, su dibujo quieto (si Lottie no carga)');
    assert.ok(CSS.includes(`.rejilla-completa[data-forma="${r.forma}"]>.capa-personaje{`) || CSS.includes(`[data-forma="${r.forma}"],`) || CSS.includes(`[data-forma="${r.forma}"])>.capa-personaje{`), 'su sitio por forma: ' + r.forma);
    // 6 · el marco, alrededor de la rejilla, lo último
    const marco = `<img src="./${r.capas.marco.recurso}" alt="" loading="lazy" decoding="async">`;
    assert.ok(h.includes(`<div class="capa capa-marco" aria-hidden="true">${['arriba-izquierda', 'arriba-derecha', 'abajo-izquierda', 'abajo-derecha'].map((e) => `<span class="marco-esquina ${e}">${marco}</span>`).join('')}</div></div>`), 'el marco, en sus cuatro esquinas, lo último de la rejilla del ' + pv);
  }
  // El 4: la matriz lleva su pieza en cada estación; el 8: el polvo en las cajas vacías; el 3: el baño para quien es persona.
  const tres = (await arbol({ foco: { X: compra.id, pv: 3 } }, eje, 'huesped', GRANDE)).centro.rejilla;
  assert.ok(tres.celdas.some((x) => x.capa.ocupantes.some((d) => d.subclave === 'bano')), 'una persona en el parque');
});

test('lo que el núcleo no da no se dibuja: actual, repetido y cerrado no tienen dato; el hijo vacío fuera del cielo queda como en sobrio', async () => {
  const { eje, compra } = await ejemploCompra();
  await animado(eje);
  for (const pv of MUNDOS) {
    const r = (await arbol({ foco: { X: compra.id, pv } }, eje, 'huesped', GRANDE)).centro.rejilla;
    const nombres = [...(r.celdas ?? []).flatMap((x) => [x.capa.hijo, ...x.capa.ocupantes, x.capa.hecho]), ...(r.bandas ?? []).flatMap((b) => [b.capa.hijo, ...b.items.map((o) => o.dibujo)])].filter(Boolean).map((p) => p.subclave);
    for (const dado of ['actual', 'repetido', 'cerrado']) if (FILAS[dado][pv]) assert.ok(!nombres.includes(FILAS[dado][pv]), `${FILAS[dado][pv]} en el ${pv}: el núcleo no da «${dado}»`);
    for (const x of r.celdas ?? []) if (x.vacio && pv !== 8) assert.equal(x.capa.hijo, null);
  }
});

test('los efectos de lo nuevo van sobre el hijo del que cuelgan (pvDondeCuelga) y, si no hay ese hijo, sobre el centro del mundo; el personaje actúa', async () => {
  const { eje, compra } = await ejemploCompra();
  await animado(eje);
  const pagar = { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 1, de: 'huesped', a: 'casa' };
  const enDos = await eje.escribir({ autor: 'huesped', sobre: compra.id, en: '2000000000', t: T1, movimientos: [minuto('huesped'), pagar], payload: ['un euro más'] });
  const enSiete = await eje.escribir({ autor: 'huesped', sobre: compra.id, en: '7000000000', t: T1, movimientos: [minuto('huesped'), pagar], payload: ['para después'] });
  const a = await arbol({ foco: { X: compra.id, pv: 1 }, nuevos: new Set([enDos.id, enSiete.id]) }, eje, 'huesped', GRANDE);
  const r = a.centro.rejilla;
  const dos = r.celdas.find((x) => x.pv === 2);
  assert.deepEqual(dos.capa.efectos.entradas, [enDos.id]);
  assert.deepEqual(dos.capa.efectos.efectos.map((e) => e.clave), [modelos.corresponde(modelos.cabecera(), 'movimiento', 'transferir', 1)]);
  assert.deepEqual(r.capas.efectos.entradas, [enSiete.id], 'el 7 no es un hijo de la cruceta del 1: al centro');
  assert.equal(r.capas.personaje.accion, 'actuar');
  const h = centroDe(html(a));
  assert.match(h, /data-pv="2"[^>]*>(?:(?!class="rejilla-celda)[\s\S])*<div class="capa capa-efectos" aria-hidden="true"><div class="pieza pieza-efecto efecto-transferir pieza-lottie"[^>]*data-animar="1" data-bucle="0" data-prioridad="0"/);
  assert.match(h, /<div class="capa capa-efectos capa-efectos-centro" aria-hidden="true">/);
});

test('las capas no ocupan sitio ni mueven nada: absolutas, sin recibir el ratón; el centro a pantalla completa no cambia de relleno; nada de geometría en datos', () => {
  const regla = (sel) => new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{[^}]*position:absolute');
  for (const sel of ['.rejilla-completa>.capa-fondo', '.capa-dibujo', '.flotante-cara>.capa-etapa', '.capa-etapa-cabeza', '.rejilla-completa>.capa-personaje', '.capa-efectos', '.rejilla-completa>.capa-marco', '.cuenta-bola>.capa-ocupante', '.estrella-forma>.capa-ocupante']) assert.match(CSS, regla(sel), sel);
  assert.match(CSS, /\.capa\{pointer-events:none\}/);
  assert.doesNotMatch(CSS, /:has\(>\.pieza-marco\)/, 'ningún relleno por el marco: el marco es una capa y no cambia nada de medida');
  assert.doesNotMatch(CSS, /\.pv-pie\{margin-bottom:2%\}/, 'ni margen extra en el pie por el marco');
  assert.match(CSS, /--escala:clamp\(\.6,[^;]*,1\.4\)/, 'el dibujo escala con la cifra entre 0,6 y 1,4');
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)\{\.capa-efectos\{display:none\}\}/);
  // Lo que se cambia del sobrio en animado solo es color, fondo y sombra (nada de bordes, rellenos, tamaños ni huecos).
  const delSobrio = CSS.split('\n').filter((l) => l.startsWith('.animado .rejilla-completa') && !/capa/.test(l));
  assert.ok(delSobrio.length > 5);
  for (const l of delSobrio) {
    const decl = l.slice(l.indexOf('{') + 1, l.lastIndexOf('}')).split(';').filter(Boolean).map((d) => d.split(':')[0].trim());
    for (const p of decl) assert.ok(['background', 'box-shadow', 'color', 'text-shadow', 'border-bottom-color', 'border-radius', 'isolation', 'position'].includes(p), `${p} en ${l.slice(0, 80)}`);
    if (decl.includes('position')) assert.match(l, /position:relative/);
  }
  // La geometría de las capas no viene de datos: cssSeguro no deja pasar position, z-index, transform ni animation.
  assert.equal(C.cssSeguro('position:absolute;z-index:3;transform:translateX(-50%);animation:x 1s'), '');
});

test('el marco rodea la rejilla sin deformarse: cada esquina recorta la del dibujo y una línea del color del mundo las une; el centro no lleva otro marco', async () => {
  const { eje, compra } = await ejemploCompra();
  await animado(eje);
  const a = await arbol({ foco: { X: compra.id, pv: 2 } }, eje, 'huesped', GRANDE);
  const h = html(a);
  assert.equal((h.match(/class="marco-esquina /g) ?? []).length, 4);
  assert.doesNotMatch(h, /pieza-marco/, 'a pantalla completa, ni el centro ni la rejilla estiran el marco en un <img> de toda la caja');
  assert.doesNotMatch(h, /class="escenario/, 'ni el escenario del centro: sus piezas son capas de la rejilla');
  assert.match(CSS, /\.marco-esquina>img\{position:absolute;width:var\(--dibujo\);height:var\(--dibujo\)/, 'el dibujo entero, sin deformar (un cuadrado)');
  assert.match(CSS, /\.capa-marco::before\{[^}]*border:3px solid color-mix\(in oklab,var\(--c/, 'la línea, del color del mundo');
});

test('sin red, el personaje cae a su dibujo quieto sin error: trasPintar marca el Lottie sin-lottie y el CSS enseña el respaldo; con «reducir movimiento», nada se reproduce', async () => {
  const hueco = (animar = '1') => ({ dataset: { lottie: 'arte/x.json', animar, bucle: '1', prioridad: '1' }, classList: { clases: new Set(), add(c) { this.clases.add(c); } }, isConnected: true });
  const h = hueco();
  const raiz = { querySelectorAll: () => [h], querySelector: () => null };
  const parar = trasPintar(raiz, { lottie: undefined });
  assert.equal(typeof parar, 'function');
  assert.ok(h.classList.clases.has('sin-lottie'));
  assert.match(CSS, /\.capa-personaje:has\(\.sin-lottie\) \.respaldo,\.capa-personaje:has\(\.pieza-lottie:empty\) \.respaldo\{display:block\}/);
  assert.match(CSS, /\.capa-personaje \.sin-lottie\{display:none\}/);
  // Con «reducir movimiento», trasPintar carga las piezas en su fotograma y no reproduce ninguna.
  const antes = globalThis.matchMedia;
  const fetchAntes = globalThis.fetch;
  globalThis.matchMedia = (q) => ({ matches: q.includes('reduce') });
  globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });
  try {
    let reproducidas = 0;
    const lottie = { loadAnimation: () => ({ addEventListener: (ev, f) => { if (ev === 'DOMLoaded') setTimeout(f, 0); }, goToAndStop() {}, play() { reproducidas++; }, totalFrames: 10, isPaused: true }) };
    const otro = hueco();
    trasPintar({ querySelectorAll: () => [otro], querySelector: () => null }, { lottie, limite: 5 });
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(reproducidas, 0);
  } finally {
    globalThis.matchMedia = antes;
    globalThis.fetch = fetchAntes;
  }
});

/** Las secciones de los PV laterales del HTML de la carta, por PV: de `<section class="pv pv-N ` a su cierre. */
function seccionesDe(h) {
  const fuera = {};
  const re = /<section class="pv pv-(\d) /g;
  let m;
  while ((m = re.exec(h))) {
    const etiquetas = /<(\/?)section\b[^>]*>/g;
    etiquetas.lastIndex = m.index;
    let n = 0;
    let e;
    while ((e = etiquetas.exec(h))) {
      n += e[1] ? -1 : 1;
      if (n === 0) break;
    }
    fuera[m[1]] = h.slice(m.index, e.index + e[0].length);
  }
  return fuera;
}

test('Mapped en bloque y en tarjeta (#16): el animado es el sobrio más capas; el marco abraza el borde (sus esquinas y una línea), nunca flota encima; el fondo atenuado, la etapa en la cabecera, el dibujo del mundo en cada hijo; sin personaje', async () => {
  const { eje, compra } = await ejemploCompra();
  const pantallas = { 'el ordenador (1366 × 768)': medidasDePantalla(1366, 728), 'el móvil apaisado (844 × 390)': medidasDePantalla(844, 350), 'la pantalla grande': GRANDE };
  const bloques = ampliarTodos(ampliarTodos({}, +1), +1);
  const tarjetas = ampliarTodos({}, +1);
  const casos = Object.entries(pantallas).flatMap(([que, m]) => [[que + ', en bloque', m, bloques], [que + ', en tarjeta', m, tarjetas]]);
  const sobrio = [];
  for (const [que, m, niveles] of casos) {
    const a = await arbol({ foco: { X: compra.id, pv: 0 }, ...niveles }, eje, 'huesped', m);
    assert.equal(a.animado, false);
    assert.equal(a.apilada, false, que + ': Mapped');
    const s = seccionesDe(html(a));
    assert.equal(Object.keys(s).length, MUNDOS.length, que);
    for (const h of Object.values(s)) assert.doesNotMatch(h, /class="[^"]*\bcapa\b/, 'el sobrio no lleva capas');
    sobrio.push(s);
  }
  await animado(eje);
  let dibujos = 0;
  for (const [i, [que, m, niveles]] of casos.entries()) {
    const a = await arbol({ foco: { X: compra.id, pv: 0 }, ...niveles }, eje, 'huesped', m);
    assert.equal(a.animado, true);
    const s = seccionesDe(html(a));
    for (const n of a.laterales) {
      const h = s[n.pv];
      const donde = `${que}, el ${n.pv}`;
      assert.ok(n.nivel >= NIVEL.tarjeta, donde);
      // Mismo DOM: quitar las capas da el sobrio exacto (nada cambia de sitio ni de medida: lo comprueba Playwright).
      assert.equal(sinCapas(h), sobrio[i][n.pv], donde + ': el animado es el sobrio más capas');
      // El marco: sus cuatro esquinas (el dibujo sin deformar) y la línea, lo último del PV; nunca el <img> estirado encima.
      const marco = `<img src="./${n.marco.recurso}" alt="" loading="lazy" decoding="async">`;
      assert.ok(h.endsWith(`<div class="capa capa-marco" aria-hidden="true">${['arriba-izquierda', 'arriba-derecha', 'abajo-izquierda', 'abajo-derecha'].map((e) => `<span class="marco-esquina ${e}">${marco}</span>`).join('')}</div></section>`), donde + ': el marco en sus esquinas');
      assert.doesNotMatch(h, /pieza-marco|class="escenario|pieza-personaje|capa-personaje/, donde + ': ni marco flotante, ni escenario, ni personaje');
      // La etapa del mundo, pequeña en la cabecera (dentro del nombre, a su derecha).
      assert.match(h, new RegExp(`^<section [^>]*>(?:<img class="pieza capa pieza-fondo capa-fondo pieza-imagen"[^>]*>)?<header class="pv-cabeza"><span class="numero">${n.pv}</span><span class="etiqueta">[^<]*<img class="pieza capa pieza-etapa capa-etapa capa-etapa-pv pieza-imagen" src="\./${n.etapa.recurso}"`), donde + ': la etapa en la cabecera');
      if (n.nivel >= NIVEL.bloque) {
        // El fondo del mundo, lo primero del bloque (detrás de todo, atenuado: CSS).
        assert.ok(h.includes(`<img class="pieza capa pieza-fondo capa-fondo pieza-imagen" src="./${n.fondo.recurso}"`), donde + ': el fondo');
        // Con rejilla, el dibujo de la correspondencia en cada hijo (como a pantalla completa) y sin personaje.
        if (n.rejilla) {
          assert.equal(n.rejilla.capas.personaje, null, donde + ': sin personaje');
          const conDibujo = (n.rejilla.celdas ?? []).filter((c) => c.capa.hijo || c.capa.ocupantes.length).length + (n.rejilla.bandas ?? []).filter((b) => b.capa.hijo).length;
          assert.equal((h.match(/<div class="capa capa-dibujo/g) ?? []).length, conDibujo, donde + ': un dibujo por hijo');
          dibujos += conDibujo;
        }
      } else {
        assert.doesNotMatch(h, /capa-fondo/, donde + ': en tarjeta, sin fondo');
      }
      // En una lista, el elemento de cada ocupante es una capa (no empuja el texto).
      assert.doesNotMatch(h, /class="pieza pieza-elemento/, donde);
    }
  }
  assert.ok(dibujos > 10, 'los bloques con rejilla llevan el dibujo de sus hijos: ' + dibujos);
  // CSS: todo absoluto y sin relleno añadido; en una celda muy baja del móvil, solo la línea.
  const regla = (sel) => new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{[^}]*position:absolute');
  for (const sel of ['.pv>.capa-fondo', '.pv-cabeza .capa-etapa-pv', '.ocupante>.capa-elemento', '.pv>.capa-marco,.nucleo>.capa-marco']) assert.match(CSS, regla(sel), sel);
  assert.match(CSS, /@container \(max-height:90px\)\{\.pv>\.capa-marco \.marco-esquina/);
});

/** La columna de Sequenced del HTML de la carta: el pasado, la tarjeta del foco con sus filas y el futuro. */
const secuenciaDe = (h) => {
  const desde = h.indexOf('<div class="secuencia" data-secuencia>');
  const hasta = h.indexOf('<nav class="digitos"', desde);
  assert.ok(desde > 0 && hasta > desde, 'Sequenced');
  return h.slice(desde, hasta);
};

/** Un trozo de un HTML: desde `inicio` hasta `fin` (o el final). */
const trozo = (h, inicio, fin) => { const i = h.indexOf(inicio); return i < 0 ? '' : h.slice(i, fin ? h.indexOf(fin, i) : undefined); };

/** Las filas abiertas de la tarjeta, por PV: de `<li class="fila abierta"` a su cierre. */
function filasAbiertasDe(h) {
  const fuera = {};
  const re = /<li class="fila abierta"[^>]*data-fila-pv="(\d)">/g;
  let m;
  while ((m = re.exec(h))) {
    const etiquetas = /<(\/?)li\b[^>]*>/g;
    etiquetas.lastIndex = m.index;
    let n = 0;
    let e;
    while ((e = etiquetas.exec(h))) {
      n += e[1] ? -1 : 1;
      if (n === 0) break;
    }
    fuera[m[1]] = h.slice(m.index, e.index + e[0].length);
  }
  return fuera;
}

test('Sequenced en animado (#7): la columna es la del sobrio más capas; cada fila abierta, el fondo atenuado, la etapa junto a su nombre y el dibujo del mundo en cada hijo u ocupante; sin muñequitos, sin movimientos y nada flotando', async () => {
  const { eje, compra, nota } = await conCarpeta();
  // Algo en el pasado y en el futuro, para que el hilo tenga ocupantes (su elemento, también como capa).
  await eje.escribir({ autor: 'huesped', sobre: compra.id, en: '6000000000', t: T1, movimientos: [minuto('huesped')], payload: ['antes'] });
  await eje.escribir({ autor: 'huesped', sobre: compra.id, en: '7000000000', t: T1, movimientos: [minuto('huesped')], payload: ['después'] });
  const pantallas = { 'el móvil (390 × 844)': medidasDePantalla(390, 844), 'el móvil pequeño (360 × 800)': medidasDePantalla(360, 800) };
  const abiertas = Object.fromEntries([0, 1, 2, 3, 4, 5, 8, 9].map((pv) => [pv, NIVEL.bloque]));
  const estados = {
    'todas abiertas': { foco: { X: compra.id, pv: 0 }, niveles: abiertas },
    'el 1 en su nivel 2': { foco: { X: compra.id, pv: 0 }, niveles: { 1: NIVEL.bloque, 3: NIVEL.bloque }, profundidad: { 1: [nota.id] } },
  };
  const casos = Object.entries(pantallas).flatMap(([que, m]) => Object.entries(estados).map(([cual, estado]) => [`${que}, ${cual}`, m, estado]));
  const sobrio = [];
  for (const [que, m, estado] of casos) {
    const a = await arbol({ ...estado, nuevos: new Set() }, eje, 'huesped', m);
    assert.equal(a.apilada, true, que + ': Sequenced');
    assert.equal(a.animado, false);
    const h = secuenciaDe(html(a));
    assert.doesNotMatch(h, /class="[^"]*\bcapa\b/, 'el sobrio no lleva capas');
    sobrio.push(h);
  }
  await animado(eje);
  let dibujos = 0;
  for (const [i, [que, m, estado]] of casos.entries()) {
    const a = await arbol({ ...estado, nuevos: new Set() }, eje, 'huesped', m);
    assert.equal(a.animado, true);
    const h = secuenciaDe(html(a));
    assert.ok((h.match(/class="[^"]*\bcapa\b/g) ?? []).length >= 4, que + ': el animado añade capas');
    // Mismo DOM: quitar las capas da el sobrio exacto (nada cambia de sitio ni de medida: lo comprueba Playwright).
    assert.equal(sinCapas(h), sobrio[i], que + ': el animado es el sobrio más capas');
    // Nada de muñequitos, movimientos, escenario ni marco estirado encima.
    assert.doesNotMatch(h, /pieza-personaje|capa-personaje|pieza-efecto|capa-efectos|class="escenario|pieza-marco|class="pieza pieza-elemento/, que);
    // La tarjeta del foco: su marco neutro solo como borde (sus cuatro esquinas y una línea), lo último de la tarjeta.
    assert.match(h, /<section class="nucleo anverso[^]*<div class="capa capa-marco" aria-hidden="true">(?:<span class="marco-esquina [a-z-]+"><img src="\.\/arte\/fase2\/[^"]+\/comun\/marco\/[^"]+"[^>]*><\/span>){4}<\/div>\s*<\/section>/, que + ': el marco neutro de la tarjeta, como borde');
    const filas = filasAbiertasDe(h);
    for (const f of a.secuencia.filas.filter((x) => x.abierta)) {
      const fila = filas[f.pv];
      const n = f.nodo;
      const donde = `${que}, la fila ${f.pv}`;
      assert.ok(fila, donde);
      // La etapa, pequeña junto al nombre de la fila (dentro de su etiqueta, como capa).
      if (n.etapa?.recurso) assert.match(fila, new RegExp(`^<li [^>]*><button type="button" class="fila-cabeza"[^>]*><span class="numero">${f.pv}</span><span class="etiqueta">[^<]*(?:<small>[^<]*</small>)?<img class="pieza capa pieza-etapa capa-etapa capa-etapa-fila pieza-imagen" src="\\./${n.etapa.recurso}"[^>]*></span>`), donde + ': la etapa junto al nombre');
      // El fondo del mundo, lo primero del contenido (detrás de todo; atenuado: CSS).
      if (n.fondo?.recurso) assert.match(fila, new RegExp(`<div class="fila-contenido"[^>]*><section [^>]*><img class="pieza capa pieza-fondo capa-fondo pieza-imagen" src="\\./${n.fondo.recurso}"`), donde + ': el fondo');
      // El dibujo de la correspondencia (epoch.9.7.0.4) en cada hijo, sin personaje ni efectos.
      if (n.rejilla) {
        assert.equal(n.rejilla.capas.personaje, null, donde + ': sin personaje');
        const conDibujo = (n.rejilla.celdas ?? []).filter((c) => c.capa.hijo || c.capa.ocupantes.length || c.capa.hecho).length
          + (n.rejilla.bandas ?? []).filter((b) => b.capa.hijo || (b.items ?? []).some((o) => o.dibujo)).length;
        assert.equal((fila.match(/<div class="capa capa-dibujo/g) ?? []).length, conDibujo, donde + ': un dibujo por hijo');
        for (const c of n.rejilla.celdas ?? []) assert.equal(c.capa.efectos, null, donde + ': sin efectos por hijo');
        dibujos += conDibujo;
      }
    }
  }
  assert.ok(dibujos > 10, 'las filas abiertas llevan el dibujo de sus hijos: ' + dibujos);
  // Algo nuevo bajo la compra (en el 2): el árbol lo sabe, pero en vertical nada se mueve.
  const nuevo = await eje.escribir({ autor: 'huesped', sobre: compra.id, en: '2000000000', t: T1, movimientos: [minuto('huesped'), { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 1, de: 'huesped', a: 'casa' }], payload: ['un euro más'] });
  const a = await arbol({ foco: { X: compra.id, pv: 0 }, niveles: abiertas, nuevos: new Set([nuevo.id]) }, eje, 'huesped', medidasDePantalla(390, 844));
  assert.deepEqual(a.secuencia.filas.find((f) => f.pv === 2).nodo.nuevos.entradas, [nuevo.id]);
  const h = secuenciaDe(html(a));
  assert.doesNotMatch(h, /pieza-efecto|capa-efectos|pieza-personaje/);
  // El hilo: el elemento de cada ocupante, como capa.
  assert.match(trozo(h, 'data-hilo-zona="6"', '</section>'), /<span class="texto">antes<\/span>[^]*?<img class="pieza capa capa-elemento/);
  // CSS: todo absoluto (nada cambia de sitio ni de medida); el fondo de la fila, muy atenuado.
  const regla = (sel) => new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{[^}]*position:absolute');
  for (const sel of ['.pv>.capa-fondo', '.fila-cabeza .capa-etapa-fila', '.capa-dibujo', '.ocupante>.capa-elemento']) assert.match(CSS, regla(sel), sel);
  assert.match(CSS, /\.fila-cabeza \.capa-etapa-fila\{[^}]*width:28px;height:28px/);
  const opacidad = Number(/\.fila-contenido>\.pv>\.capa-fondo\{opacity:([\d.]+)\}/.exec(CSS)?.[1]);
  assert.ok(opacidad > 0 && opacidad <= 0.3, 'el fondo, atenuado: ' + opacidad);
  // El fondo de una caja alta no va detrás del texto: solo una banda arriba (la cabecera y un poco más), con su degradado.
  const banda = /\.fila-contenido>\.pv>\.capa-fondo\{bottom:auto;height:(\d+)px;object-position:50% 0;[^}]*mask-image:linear-gradient\(to bottom,#000 \d+%,transparent\)/.exec(CSS);
  assert.ok(banda && Number(banda[1]) >= 96 && Number(banda[1]) <= 120, 'el fondo de la fila, una banda arriba con degradado');
  assert.match(CSS, /@container \(max-aspect-ratio:1\/1\)\{\.mapa \.pv>\.capa-fondo\{bottom:auto;height:112px/, 'y en cualquier celda más alta que ancha');
  // Lo que se cambia del sobrio en las filas solo es fondo y aislamiento (nada de bordes, rellenos ni tamaños).
  const delSobrio = CSS.split('\n').filter((l) => l.startsWith('.animado .fila-contenido') || l.startsWith('.animado .secuencia'));
  assert.ok(delSobrio.length >= 3);
  for (const l of delSobrio) {
    const decl = l.slice(l.indexOf('{') + 1, l.lastIndexOf('}')).split(';').filter(Boolean).map((d) => d.split(':')[0].trim());
    for (const p of decl) assert.ok(['background', 'isolation', 'position'].includes(p), `${p} en ${l.slice(0, 80)}`);
    if (decl.includes('position')) assert.match(l, /position:relative/);
  }
});

test('Sequenced, un PV abierto como foco en el móvil en vertical (todo): el marco abraza el borde de la tarjeta (sus cuatro esquinas y una línea), nunca el dibujo estirado en medio del texto; sin él (ni el escenario, que ya estaba) es el sobrio', async () => {
  const { eje, compra } = await conCarpeta();
  const pantallas = { 'el móvil (390 × 844)': medidasDePantalla(390, 844), 'el móvil pequeño (360 × 800)': medidasDePantalla(360, 800) };
  const casos = Object.entries(pantallas).flatMap(([que, m]) => [1, 2, 3, 4, 8, 9].map((pv) => [`${que}, el ${pv} como foco`, m, pv]));
  const sobrio = [];
  for (const [que, m, pv] of casos) {
    const a = await arbol({ foco: { X: compra.id, pv }, nuevos: new Set() }, eje, 'huesped', m);
    assert.equal(a.apilada, true, que + ': Sequenced');
    assert.equal(a.animado, false);
    const h = secuenciaDe(html(a));
    assert.match(h, /<section class="nucleo abierto/, que + ': el PV abierto como foco');
    assert.doesNotMatch(h, /class="[^"]*capa|pieza-marco/, 'el sobrio no lleva capas');
    sobrio.push(h);
  }
  await animado(eje);
  for (const [i, [que, m, pv]] of casos.entries()) {
    const a = await arbol({ foco: { X: compra.id, pv }, nuevos: new Set() }, eje, 'huesped', m);
    assert.equal(a.animado, true);
    assert.ok(a.centro.marco?.recurso, que + ': el núcleo da el marco del mundo');
    const h = secuenciaDe(html(a));
    assert.doesNotMatch(h, /pieza-marco/, que + ': ningún marco estirado');
    // Un solo marco, de cuatro esquinas del dibujo del mundo y una línea, lo último de la tarjeta.
    assert.equal((h.match(/class="capa capa-marco"/g) ?? []).length, 1, que);
    const marco = `<img src="./${a.centro.marco.recurso}" alt="" loading="lazy" decoding="async">`;
    assert.ok(h.includes(`<div class="capa capa-marco" aria-hidden="true">${['arriba-izquierda', 'arriba-derecha', 'abajo-izquierda', 'abajo-derecha'].map((e) => `<span class="marco-esquina ${e}">${marco}</span>`).join('')}</div>
  </section>`), que + ': el marco del mundo, lo último del núcleo');
    // Mismo DOM: quitar las capas da el sobrio, salvo lo que el foco abierto llevaba ya antes de las capas y no es del marco:
    // el escenario y el icono inline de cada ocupante (pieza-elemento, que en filas y en el hilo ya es capa).
    assert.equal(sinCapas(sinCapas(sinCapas(h), 'escenario'), 'pieza-elemento'), sobrio[i], que + ': el animado es el sobrio más capas');
  }
});

// ---------- #25: el arte como atributo del elemento y los tres pintados (sobrio · propio · todo) ----------

/** El icono propio del menú: una pieza «elemento» anclada por su autor en su 5, que sirve en todos los mundos («*»). */
const ICONO_PROPIO = 'arte/fase2/bloque-0/biblioteca/jardin/elemento/fruto-intermedio.svg';
async function menuConIcono() {
  const { eje, compra, menu } = await ejemploCompra();
  const autor = eje.obtener(menu.id).autor;
  await eje.escribir({ autor, sobre: menu.id, en: '5000000000', t: '2026-11-08T09:30:00Z', movimientos: [minuto(autor)], payload: [['elemento'], [0, 'svg'], ['*'], ['centro'], ['once', 1], ['*'], [ICONO_PROPIO, 'prueba: el arte propio del menú']] });
  return { eje, compra, menu };
}
/** El pintado de la huésped: un valor de la enumeración de la época (epoch.9.3.2), por su posición. */
async function pintado(eje, k, quien = 'huesped') {
  const valores = C.clavesDeConfiguracion().find((c) => c.valores?.length >= 3).valores;
  const p = preferencias(eje, quien, { render: valores[k] });
  await eje.escribir({ autor: quien, sobre: p.sobre, en: p.en, t: T1, movimientos: [minuto(quien)], payload: p.payload });
  return valores[k];
}

test('#25: el arte propio de un registro va primero: el menú con su icono se ve en su ocupante, en su hijo y en su centro (todo y propio); en sobrio, nada', async () => {
  const { eje, compra, menu } = await menuConIcono();
  assert.deepEqual(modelos.modelo(eje, 'huesped', { elemento: menu.id }).map((m) => m.nombre ?? 'propio'), ['propio', 'general', 'animado-generico', 'sobrio'], 'la cadena: lo propio, luego la de quien mira');
  const comprobar = async (que) => {
    // su ocupante: en el bloque del 2 de la compra (el menú es un ocupante de su 2)
    const a = await arbol({ foco: { X: compra.id, pv: 0 }, niveles: { 2: NIVEL.bloque } }, eje, 'huesped', GRANDE);
    const ocupante = a.laterales.find((n) => n.pv === 2).ocupantes.lista.find((o) => o.X === menu.id);
    assert.equal(ocupante?.elemento?.recurso, ICONO_PROPIO, que + ': su ocupante');
    assert.equal(ocupante.elemento.origen, menu.id);
    // su hijo: la celda del 2 en la cruceta del 1 a pantalla completa
    const b = await arbol({ foco: { X: compra.id, pv: 1 } }, eje, 'huesped', GRANDE);
    const celda = b.centro.rejilla.celdas.find((c) => c.pv === 2);
    assert.ok(celda.capa.ocupantes.some((p) => p.recurso === ICONO_PROPIO && p.origen === menu.id), que + ': su hijo');
    assert.ok(html(b).includes('dibujo-ocupante pieza-imagen" src="./' + ICONO_PROPIO + '"'), que + ': pintado');
    // su centro: entrar en él (el pulsado de la cruceta) lo pone en la tarjeta central
    const c = await arbol({ foco: { X: compra.id, pv: 1 }, profundidad: { 1: [menu.id] } }, eje, 'huesped', GRANDE);
    assert.equal(c.centro.rejilla.X, menu.id);
    assert.equal(c.centro.rejilla.capas.etapa?.recurso, ICONO_PROPIO, que + ': su centro');
    const cara0 = html(c).split('<section class="flotante-cara cara-0">')[1]?.split('</section>')[0] ?? '';
    assert.ok(cara0.includes('capa-etapa') && cara0.includes('src="./' + ICONO_PROPIO + '"'), que + ': en la cara 0 de la tarjeta central');
    return { a, b, c };
  };
  // todo (el último de la enumeración): lo propio y, detrás, el arte general
  await pintado(eje, 2);
  const todo = await comprobar('todo');
  assert.ok(todo.b.centro.rejilla.capas.fondo?.recurso && todo.b.centro.rejilla.capas.personaje, 'en todo, el fondo y el muñequito generales siguen');
  assert.ok(todo.b.centro.rejilla.celdas.some((c) => c.capa.hijo?.modelo === 'general'), 'y los dibujos generales');
  // propio (el de en medio): solo lo propio de cada elemento
  await pintado(eje, 1);
  const propio = await comprobar('propio');
  const r = propio.b.centro.rejilla;
  assert.equal(propio.b.animado, true);
  assert.equal(r.capas.fondo, null, 'sin fondo general');
  assert.equal(r.capas.personaje, null, 'sin muñequito general');
  assert.equal(r.capas.marco, null, 'sin marco general');
  assert.ok(r.celdas.every((c) => !c.capa.hijo && c.capa.ocupantes.every((p) => p.origen === menu.id)), 'sin dibujos generales: solo el retrato del menú');
  assert.ok(!/class="capa capa-(fondo|personaje|marco)/.test(html(propio.b)), 'en el HTML tampoco');
  // sobrio (el primero, el defecto): nada de arte, ni el propio
  await pintado(eje, 0);
  const s = await arbol({ foco: { X: compra.id, pv: 1 } }, eje, 'huesped', GRANDE);
  assert.equal(s.animado, false);
  assert.ok(!html(s).includes(ICONO_PROPIO), 'en sobrio no se pinta ni lo propio');
});

test('#25: lo que otro ancla en un registro no es su arte propio; un adjunto «archivo:<sha256>» se lee y la carta lo resuelve con lo que instala la app', async () => {
  const { eje, compra, menu } = await ejemploCompra();
  const autor = eje.obtener(menu.id).autor;
  const ajeno = autor === 'huesped' ? 'casa' : 'huesped';
  await eje.escribir({ autor: ajeno, sobre: menu.id, en: '5000000000', t: '2026-11-08T09:30:00Z', movimientos: [minuto(ajeno)], payload: [['elemento'], [0, 'svg'], ['*'], ['centro'], ['once', 1], ['*'], [ICONO_PROPIO]] });
  assert.equal(modelos.propio(eje, menu.id), null, 'la pieza anclada por otro no cuenta');
  const sha = 'ab'.repeat(32);
  await eje.escribir({ autor, sobre: menu.id, en: '5000000000', t: '2026-11-08T09:31:00Z', movimientos: [minuto(autor)], payload: [['elemento'], [0, 'image'], ['*'], ['centro'], ['once', 1], ['*'], ['archivo:' + sha]] });
  assert.equal(modelos.propio(eje, menu.id).piezas[0].recurso, 'archivo:' + sha);
  await pintado(eje, 2);
  const a = await arbol({ foco: { X: compra.id, pv: 1 } }, eje, 'huesped', GRANDE);
  const { srcDeRecurso, resolverArchivos } = await import('../carta/dom.js');
  assert.ok(a.centro.rejilla.celdas.find((c) => c.pv === 2).capa.ocupantes.some((p) => p.recurso === 'archivo:' + sha));
  assert.ok(!html(a).includes('archivo:'), 'sin resolutor (la app no lo ha instalado), el adjunto no se pinta');
  resolverArchivos((id) => 'https://ejemplo.invalid/archivos/' + id);
  try {
    assert.equal(srcDeRecurso('archivo:' + sha), 'https://ejemplo.invalid/archivos/' + sha);
    assert.ok(html(a).includes('src="https://ejemplo.invalid/archivos/' + sha + '"'), 'con resolutor, su URL');
    assert.equal(srcDeRecurso('arte/x.svg'), './arte/x.svg');
    resolverArchivos(() => 'javascript:alert(1)');
    assert.equal(srcDeRecurso('archivo:' + sha), null, 'el resolutor solo puede dar http(s) o blob');
  } finally {
    resolverArchivos(null);
  }
});

test('#8: la etapa de la tarjeta central va a su esquina (no detrás del nombre y la cifra); el marco empieza bajo la cabecera; el personaje, fuera de las celdas', () => {
  const regla = (sel) => CSS.split('\n').find((l) => l.startsWith(sel + '{'));
  const etapa = regla('.flotante-cara>.capa-etapa');
  assert.ok(etapa && etapa.includes('right:8px') && etapa.includes('bottom:16px') && !etapa.includes('inset:'), 'la etapa en la esquina de abajo a la derecha');
  assert.ok(regla('.rejilla-completa>.rejilla-cabeza~.capa-marco')?.includes('top:12px'), 'el marco empieza bajo «nivel 1 de 4»');
  const personaje = CSS.split('\n').find((l) => l.includes('[data-forma="conversacion"]') && l.includes('capa-personaje'));
  assert.ok(personaje && personaje.includes('[data-forma="rejilla"]') && personaje.includes('bottom:calc(100% - var(--sobre-cabeza'), 'conversación y rejilla: el personaje sobre el marco, en la cabecera, no en el hueco de 6 px');
  assert.ok(regla('.rejilla-completa[data-forma="matriz"]>.capa-personaje')?.includes('left:10px'), 'matriz: en la columna de los ejes');
});
