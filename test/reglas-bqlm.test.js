// Las reglas de economía de la época 0 escritas en BQL mínimo (epoch.2, mapa §16,
// encargo 2), verificadas contra las condiciones de JavaScript que traducen
// (src/condiciones/*.js, src/ciclo.js, la forma de src/evento.js y src/tokens.js).
// Cada regla se evalúa con evaluarRegla sobre el eje de justo antes; la condición
// JS, sobre el mismo eje. No están conectadas al eje (eso es el encargo 3).
//
// Qué se exige:
// - en los ejemplos de Ikisai, el mismo veredicto en cada evento, también el génesis;
// - en un fuzz corto con semilla fija, el mismo veredicto, salvo que la regla sea
//   más estricta en un evento que el eje ya rechaza por otro lado (otra fila de la
//   misma condición JS da antes su motivo, o la forma lo para): el veredicto del eje
//   no cambia;
// - las divergencias conocidas por una posición que falta o una decisión de VG
//   quedan como test.skip con su id y su motivo (docs/BQLM.md §10). Con
//   AGRAM_DIVERGENCIAS=1 se ejecutan y comprueban que la divergencia sigue ahí.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluarRegla } from '../src/bqlm.js';
import { ContextoEje } from '../src/contexto-eje.js';
import { EPOCA_0_BTML } from '../src/epocas.js';
import { Eje } from '../src/eje.js';
import { validarForma, canonico, cuerpo, hash, RAIZ } from '../src/evento.js';
import { SECCIONES_DEL_CICLO, T_NO_SE_EMITE } from '../src/ciclo.js';
import { erroresGenesis, AJENOS } from '../src/condiciones/identidad.js';
import { ANCLA, AUTOR_CON_ALTA } from '../src/condiciones/evento.js';
import { AMBITO_P } from '../src/condiciones/ciclo.js';
import { SECCIONES_DEL_TOPE, analisisDelTope } from '../src/condiciones/tope.js';
import { SECCIONES_DE_R, analizarR, colateral } from '../src/lente.js';
import { claveToken } from '../src/tokens.js';
import { ejemploCompra, ejemploCuenta, ejemploComprasVecinas } from '../ejemplos/ikisai/compra-food.mjs';
import { ejemploComprasHermanas, escribirBasesDelEjemplo } from '../ejemplos/ikisai/compras-hermanas.mjs';
import { ejemploLente } from '../ejemplos/ikisai/lente-booking.mjs';
import { ejemploReserva } from '../ejemplos/ikisai/reserva-booking.mjs';
import { ejemploTarea } from '../ejemplos/ikisai/tarea-tasks.mjs';

const REGLAS = EPOCA_0_BTML.condiciones;
const nombreDe = (r) => r[0][0];
const DIVERGENCIAS = process.env.AGRAM_DIVERGENCIAS === '1';

// ---------- la condición JS que traduce cada regla ----------

const SECCION = Object.fromEntries(SECCIONES_DEL_CICLO.map((s) => [s.nombre, s]));
const RR3 = SECCIONES_DE_R.find((s) => s.nombre === 'RR-3');
const aTexto = (r) => (r === null || r === undefined ? [] : Array.isArray(r) ? r : [r]).map((x) => (typeof x === 'string' ? x : x.texto));
const esObjeto = (m) => m !== null && typeof m === 'object';

/** Los motivos de erroresGenesis de cada movimiento por separado (el génesis no los indexa). */
const genesisPorMovimiento = (ev) => (Array.isArray(ev.movimientos) ? ev.movimientos : []).map((m) => (esObjeto(m)
  ? erroresGenesis({ ...ev, movimientos: [m], contexto: { genesis: true, demostracion: true } }).filter((x) => !/demostraci|tipo|clave/.test(x))
  : []));

/**
 * Los motivos con que la condición JS que traduce cada regla rechaza el evento,
 * sobre el eje de antes (un eje vacío para el génesis). Lo que la regla no
 * cubre de la misma condición (otras filas) no cuenta.
 */
function motivosJS(eje, ev) {
  const genesis = ev.contexto?.genesis === true && eje.orden.length === 0;
  const v2 = eje.orden.length < eje.eventosV2;
  const forma = validarForma(ev, { tLaxo: v2 });
  const movs = Array.isArray(ev.movimientos) ? ev.movimientos : [];
  const ctx = genesis ? null : eje.contexto(ev);
  const delCiclo = ctx && !v2 && ev.contexto?.genesis !== true;
  const sec = {};
  if (delCiclo) for (const n of ['RL-1', 'ID-9', 'TT-6', 'TT-4', 'ES-1']) sec[n] = SECCION[n].evaluar(ev, ctx.ciclo, ctx.validos);
  const deForma = (re) => forma.filter((x) => re.test(x));
  const deSec = (n, re = /./, en = () => true) => (sec[n] ?? []).filter((x) => re.test(x.texto) && en(movs[x.i])).map((x) => x.texto);
  const eg = genesis ? erroresGenesis(ev) : [];
  const pm = genesis ? genesisPorMovimiento(ev) : [];
  const acunaDe = (token) => (m) => esObjeto(m) && m.token === token && m.de === null;
  const enGenesis = (token, re) => pm.flatMap((errs, i) => (acunaDe(token)(movs[i]) ? errs.filter((x) => re.test(x)) : []));
  const tope = delCiclo ? (n) => SECCIONES_DEL_TOPE[n].evaluar(ev, ctx.tope, analisisDelTope(ev, ctx.tope)).map((x) => x.texto) : () => [];

  return {
    "writing burns today's T": [...deForma(/escribir consume T del autor/), ...deSec('TT-4')],
    'every event moves tokens': forma.filter((x) => x === 'todo evento mueve tokens'),
    'T is whole': deForma(/T va en enteros/),
    'informative T is only burned': deForma(/solo se consume \(a = null\)|exige refiere|nota solo en T|refiere solo en T/),
    'locks keep their holder and name an exit': deForma(/: de y a son el mismo titular|exige salida: la condición de liberación/),
    'E is minted by and to its issuer': [
      ...deForma(/^movimiento \d+: la emisión de E va a su propio emisor/),
      ...(genesis ? enGenesis('E', /^en el génesis emite su autor|^el génesis solo emite a su autor/) : deSec('ID-9', /^nadie emite en nombre de otro/, acunaDe('E'))),
    ],
    'R is minted to its issuer': deForma(/la emisión de R va a su propio emisor/),
    'the genesis only mints to its author': eg.filter((x) => x === 'el génesis solo emite a su autor'),
    'the genesis P is over the whole ledger': eg.filter((x) => /^el P del génesis es sobre todo el eje/.test(x)),
    'the genesis E names no record': eg.filter((x) => /^en el génesis no hay registro que nombrar/.test(x)),
    'every record hangs on a record of the ledger': ctx ? aTexto(ANCLA.evaluar(null, eje.libro, ctx)) : [],
    'the author has an account': ctx ? aTexto(AUTOR_CON_ALTA.evaluar(null, eje.libro, ctx)) : [],
    'not before its focus': deSec('RL-1', /anterior al de su foco/),
    'not before the writer joined': deSec('RL-1', /anterior al alta de/),
    'at most a year ahead': deSec('RL-1', /por delante del mayor t/),
    'R is minted by its issuer': genesis ? enGenesis('R', /^en el génesis emite su autor/) : deSec('ID-9', /nadie emite en nombre de otro/, acunaDe('R')),
    'nobody mints T': genesis
      ? [...eg.filter((x) => x === T_NO_SE_EMITE), ...(movs.some((m) => acunaDe('T')(m) && m.a !== ev.autor) && eg.includes('el génesis solo emite a su autor') ? ['el génesis solo emite a su autor (T)'] : [])]
      : deSec('ID-9', /./, acunaDe('T')),
    'P is minted to its minter': deSec('ID-9', /la emisión de P va a quien la emite/),
    "P is minted on one's own record": deSec('ID-9', /P sobre todo el eje|P fuera del génesis va sobre un registro existente|lo acuña solo quien escribió el registro/),
    'T is not locked': deSec('TT-6'),
    'minting needs real T': deSec('ES-1', /exige consumir T del autor/),
    'minting P or E needs own R at stake': deSec('ES-1', /exige R propia en juego/),
    'minting E needs P on the record': deSec('ES-1', /emitir E exige P del autor/),
    'E is tied to a record that exists': tope(0).filter((x) => /^registro desconocido/.test(x)),
    'locked P backing live E is not released': tope(1),
    'nobody moves tokens of others': genesis
      ? movs.filter((m) => esObjeto(m) && m.de !== null && m.de !== ev.autor).map(() => 'GN-1: el génesis solo emite a su autor')
      : ctx ? aTexto(AJENOS.evaluar(null, eje.libro, ctx)) : [],
    'P moves within a known scope': delCiclo ? aTexto(AMBITO_P.evaluar(null, null, ctx)) : [],
  };
}

/** El veredicto de cada regla de la época sobre la candidata, con el eje de antes. */
function veredictos(eje, ev) {
  const fuera = {};
  for (const r of REGLAS) {
    try {
      fuera[nombreDe(r)] = evaluarRegla(r, new ContextoEje(eje, { ev, epoch: EPOCA_0_BTML }));
    } catch (e) {
      fuera[nombreDe(r)] = { pasa: false, estado: 'LANZA', motivo: e.message };
    }
  }
  return fuera;
}

/** Compara regla y condición en un evento: las diferencias, cada una con su clase. */
function comparar(eje, ev, ejeAcepta) {
  const js = motivosJS(eje, ev);
  const bq = veredictos(eje, ev);
  const forma = validarForma(ev, { tLaxo: eje.orden.length < eje.eventosV2 });
  const fuera = [];
  for (const r of REGLAS) {
    const n = nombreDe(r);
    const pasaJS = js[n].length === 0;
    if (bq[n].pasa === pasaJS) continue;
    // Más estricta solo donde el eje ya rechaza el evento: el veredicto del eje no cambia. Y más laxa solo
    // donde la forma (suelo) rechaza el evento por otro motivo: la condición JS solo mira los movimientos
    // bien formados (validosDe) y la regla los mira todos.
    const sueloAparte = ejeAcepta === false && forma.some((x) => !js[n].includes(x));
    const clase = ejeAcepta === false && (!bq[n].pasa || sueloAparte) ? 'inofensiva' : 'divergencia';
    fuera.push({ regla: n, clase, regla_dice: bq[n].pasa ? 'pasa' : bq[n].estado + ': ' + bq[n].motivo, js: pasaJS ? 'pasa' : js[n].join('; '), ev: ev.autor + ' ' + JSON.stringify(ev.movimientos).slice(0, 300) });
  }
  return { js, bq, fuera };
}

/** Un evento con su id, sin pasar por crearEvento (que ya rechaza la forma). */
async function aMano(datos) {
  const ev = { en: RAIZ, contexto: {}, ...datos };
  return { ...ev, id: await hash(canonico(cuerpo(ev))) };
}

/** Rehace un eje evento a evento y compara cada uno (el génesis, con el libro vacío). */
async function repasar(eje, cuenta) {
  const eventos = eje.orden.map((id) => eje.obtener(id));
  const g = comparar(new Eje(), eventos[0], true);
  assert.deepEqual(g.fuera, [], 'génesis');
  cuenta.eventos++;
  const nuevo = await Eje.desde([eventos[0]]);
  for (const ev of eventos.slice(1)) {
    const errores = await nuevo.validar(ev);
    assert.deepEqual(errores, [], 'el ejemplo es válido');
    const { fuera, js } = comparar(nuevo, ev, true);
    assert.deepEqual(fuera, [], ev.autor + ' ' + ev.id.slice(0, 8));
    for (const [n, m] of Object.entries(js)) if (m.length) cuenta.rechazos[n] = (cuenta.rechazos[n] ?? 0) + 1;
    cuenta.eventos++;
    await nuevo.anadir(ev);
  }
}

// ---------- la época ----------

test('las 27 reglas de economía están en epoch.2 en el orden de su 8, cada una con su condición JS', () => {
  assert.equal(REGLAS.length, 27);
  const js = motivosJS(new Eje(), { autor: 'g', sobre: null, t: '2026-11-07T09:00:00Z', movimientos: [], payload: ['x'], contexto: { genesis: true } });
  assert.deepEqual(REGLAS.map(nombreDe).sort(), Object.keys(js).sort(), 'una condición JS por regla, y ninguna de más');
  for (const r of REGLAS) {
    assert.equal(r.length, 10, nombreDe(r));
    for (let d = 0; d < 10; d++) assert.ok(Array.isArray(r[d]) && r[d].length > 0, nombreDe(r) + ': el ' + d + ' va lleno');
  }
  // «writing burns T» (identidad) es la mitad de forma de la primera y «nobody mints for another» (ciclo) lo cubren
  // «E is minted by and to its issuer» y «R is minted by its issuer»: no entran dos veces.
  for (const n of ['writing burns T', 'nobody mints for another']) assert.ok(!REGLAS.some((r) => nombreDe(r) === n), n);
});

test('las vistas nuevas del contexto: A.6 el alta de una identidad, S.8 lo emitido de una serie del libro', async () => {
  const { eje, compra } = await ejemploCompra();
  const antes = await Eje.desde(eje.orden.slice(0, -1).map((id) => eje.obtener(id)));
  const ctx = new ContextoEje(antes, { ev: compra, epoch: EPOCA_0_BTML });
  const { evaluar } = await import('../src/bqlm.js');
  const leer = (src) => { const r = evaluar(src, ctx); assert.equal(r.estado, 'RESUELTO', src + ': ' + r.motivo); return r.valor; };
  const alta = antes.alta('huesped');
  assert.deepEqual(leer('(first (first ev.3).6).5'), [alta.id]);
  assert.deepEqual(leer('(first (first ev.3).6).6.0'), [alta.t]);
  assert.deepEqual(leer('((ev.1 where E in it.0.0) each 0).8'), [antes.serie('E:casa/EUR').emitido]);
  assert.deepEqual(leer('(("E:casa/EUR")).8'), [], 'una clave escrita en el payload no es una serie del libro: sin 8');
  assert.deepEqual(leer('("nadie-con-alta").6'), []);
});

// ---------- los ejemplos de Ikisai ----------

test('ejemplos de Ikisai: cada regla da el mismo veredicto que su condición JS en cada evento, el génesis incluido', async () => {
  const cuenta = { eventos: 0, rechazos: {} };
  const c = await ejemploCompra();
  await ejemploCuenta(c.eje, c.compra);
  await ejemploComprasVecinas(c.eje, c);
  await repasar(c.eje, cuenta);
  const h = await ejemploComprasHermanas();
  await escribirBasesDelEjemplo(h);
  await repasar(h.eje, cuenta);
  await repasar((await ejemploLente()).eje, cuenta);
  await repasar((await ejemploReserva()).eje, cuenta);
  await repasar((await ejemploReserva({ confirmar: false })).eje, cuenta);
  await repasar((await ejemploTarea()).eje, cuenta);
  assert.ok(cuenta.eventos >= 60, 'eventos juzgados: ' + cuenta.eventos);
  assert.deepEqual(cuenta.rechazos, {}, 'los ejemplos son válidos: ninguna condición los rechaza');
});

// ---------- fuzz corto con semilla fija ----------

const ALTA = '2026-10-08T10:00:00Z';
const T0 = Date.parse('2026-11-08T10:00:00Z');
const ANIO = 31536000 * 1000;
const iso = (ms) => new Date(ms).toISOString().replace('.000Z', 'Z');
const minuto = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
const AUSENTE = 'ab'.repeat(32);

/** Un mundo con recursos, E atada, P sobre un registro y R con colateral (el de la verificación de la familia E). */
async function mundo() {
  const eje = await Eje.genesis({
    demostracion: true, identidad: 'g', tipo: 'persona', t: ALTA, foco: ['raíz'],
    emision: [{ token: 'P', ambito: 'genesis', cantidad: 10 }, { token: 'R', cantidad: 100 }, { token: 'E', denominacion: 'vale', cantidad: 50 }],
  });
  const personas = ['casa', 'socia', 'bea'];
  await eje.escribir({
    autor: 'g', sobre: eje.genesisId, t: ALTA, payload: ['altas'],
    movimientos: [minuto('g'), colateral('g', 10), ...personas.map((x) => ({ token: 'E', emisor: 'g', denominacion: 'vale', cantidad: 5, de: 'g', a: x })), { token: 'T', escala: 'hora', cantidad: 3, de: 'g', a: 'cocina' }],
    contexto: { tipos: { ...Object.fromEntries(personas.map((x) => [x, 'persona'])), cocina: 'cosa' } },
  });
  for (const x of personas) await eje.escribir({ autor: x, sobre: eje.genesisId, t: iso(T0), payload: ['R de ' + x], movimientos: [minuto(x), { token: 'R', emisor: x, cantidad: 100, de: null, a: x }, colateral(x, 10)] });
  const A = (await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t: iso(T0), movimientos: [minuto('casa')], payload: ['Alojamiento', ['plazas'], 6] })).id;
  const B = (await eje.escribir({ autor: 'casa', sobre: A, t: iso(T0), movimientos: [minuto('casa')], payload: ['Habitación', ['camas'], 3] })).id;
  await eje.escribir({ autor: 'casa', sobre: A, t: iso(T0), payload: ['P'], movimientos: [minuto('casa'), { token: 'P', ambito: A, cantidad: 6, de: null, a: 'casa' }] });
  await eje.escribir({ autor: 'casa', sobre: A, t: iso(T0), payload: ['delega'], movimientos: [minuto('casa'), { token: 'P', ambito: A, cantidad: 2, de: 'casa', a: 'socia' }] });
  await eje.escribir({ autor: 'g', sobre: eje.genesisId, t: iso(T0), payload: ['P a bea'], movimientos: [minuto('g'), { token: 'P', ambito: 'genesis', cantidad: 3, de: 'g', a: 'bea' }] });
  return { eje, A, B, personas: ['g', ...personas] };
}

/**
 * Un evento al azar dentro de lo que la verificación dejó en el mismo veredicto:
 * sin referencias a eventos ausentes en el payload, sin movimientos null, sin
 * milisegundos, sin foco nulo fuera del génesis, sin caducidades, sin salidas de
 * familia, sin salidas que no son texto y sin hilos de más de diez (lo de fuera
 * son las divergencias conocidas, abajo).
 */
function evento(w, reloj, azar) {
  const { eje, A, B } = w;
  const uno = (xs) => xs[Math.floor(azar() * xs.length)];
  const p = (x) => azar() < x;
  if (p(0.45)) return sensato(w, reloj, uno, p);
  const autor = uno(['casa', 'casa', 'socia', 'bea', 'g', 'cocina', p(0.2) ? 'zeta' : 'bea']);
  const otro = uno(w.personas.filter((x) => x !== autor));
  const regs = [A, B, eje.genesisId, ...eje.orden.slice(-3)];
  const movimientos = [];
  if (!p(0.08)) movimientos.push({ token: 'T', escala: uno(['minuto', 'minuto', 'hora', 'dia']), cantidad: uno([1, 1, 2, 25, 0.5]), de: autor, a: null });
  const n = 1 + Math.floor(azar() * 3);
  for (let k = 0; k < n; k++) {
    const q = uno([1, 1, 2, 3]);
    const tipo = uno(['mintE', 'mintE', 'mintP', 'mintR', 'lockR', 'lockP', 'release', 'release', 'burnE', 'transfer', 'deleg', 'T', 'raro']);
    if (tipo === 'mintE') {
      const em = p(0.85) ? autor : otro;
      const r = uno([A, B, undefined, eje.genesisId, AUSENTE]);
      movimientos.push({ token: 'E', emisor: em, denominacion: uno(['cama@n1', 'cama@n2', 'sofa', 'vale']), cantidad: q, de: null, a: p(0.9) ? em : otro, ...(r !== undefined ? { registro: r } : {}) });
    } else if (tipo === 'mintP') {
      movimientos.push({ token: 'P', ambito: uno([...regs, 'genesis', AUSENTE]), cantidad: uno([1, 2, 10]), de: null, a: p(0.85) ? autor : otro });
    } else if (tipo === 'mintR') {
      const em = p(0.85) ? autor : otro;
      movimientos.push({ token: 'R', emisor: em, cantidad: uno([1, 5, 50, 200]), de: null, a: p(0.85) ? em : otro });
    } else if (tipo === 'lockR') {
      movimientos.push({ token: 'R', emisor: autor, cantidad: uno([1, 2, 5]), de: autor, a: p(0.9) ? autor : otro, estado: uno(['bloqueo', 'bloqueo', 'liberacion']), salida: p(0.85) ? 'R:' + autor : uno(['x', 'R:' + otro]) });
    } else if (tipo === 'lockP') {
      const em = p(0.8) ? autor : 'casa';
      const salida = p(0.8) ? claveToken({ token: 'E', emisor: em, denominacion: uno(['cama@n1', 'cama@n2', 'sofa']), registro: uno([A, B]) }) : 'decision';
      movimientos.push({ token: 'P', ambito: uno([A, 'genesis']), cantidad: 1, de: autor, a: autor, estado: 'bloqueo', salida });
    } else if (tipo === 'release') {
      const b = eje.bloqueos(autor).filter((x) => x.token === 'P');
      const usar = b.length ? uno(b) : { clave: 'P:' + A, salida: 'E:casa/cama@n1@' + A, cantidad: 1 };
      movimientos.push({ token: 'P', ambito: usar.clave.slice(2), cantidad: p(0.7) ? usar.cantidad : 1, de: autor, a: p(0.95) ? autor : otro, estado: 'liberacion', salida: usar.salida });
    } else if (tipo === 'burnE' || tipo === 'transfer') {
      const tiene = Object.entries(eje.libro.vista(autor)).filter(([c, v]) => c.startsWith('E:') && v.disponible > 0);
      const [clave, v] = tiene.length ? uno(tiene) : ['E:g/vale', { disponible: 1 }];
      const partes = clave.slice(2);
      const i = partes.indexOf('/');
      let resto = partes.slice(i + 1);
      const mm = /@([0-9a-f]{64})$/.exec(resto);
      if (mm) resto = resto.slice(0, mm.index);
      movimientos.push({ token: 'E', emisor: partes.slice(0, i), denominacion: resto, ...(mm ? { registro: mm[1] } : {}), cantidad: p(0.6) ? v.disponible : 1, de: p(0.92) ? autor : otro, a: tipo === 'burnE' ? null : otro });
    } else if (tipo === 'deleg') {
      movimientos.push({ token: 'P', ambito: uno([A, 'genesis', AUSENTE, B]), cantidad: 1, de: p(0.9) ? autor : otro, a: uno([otro, null]) });
    } else if (tipo === 'T') {
      movimientos.push(uno([
        { token: 'T', escala: 'minuto', cantidad: 1, de: autor, a: autor, estado: 'bloqueo', salida: 's' },
        { token: 'T', escala: 'minuto', cantidad: 2, de: null, a: autor },
        { token: 'T', escala: 'hora', cantidad: 1, de: autor, a: uno(['cocina', otro]) },
        { token: 'T', escala: 'pasado', cantidad: 3, de: autor, a: null, refiere: '2025-01-01T00:00:00Z' },
        { token: 'T', escala: 'futuro', cantidad: 3, de: autor, a: null },
        { token: 'T', escala: 'inventado', cantidad: 1, de: autor, a: null, nota: 'un cuento' },
        { token: 'T', escala: 'pasado', cantidad: 1, de: autor, a: otro, refiere: '2025-01-01T00:00:00Z' },
      ]));
    } else {
      movimientos.push(uno([
        { token: 'E', emisor: 'g', denominacion: 'vale', cantidad: 1, de: autor, a: otro, nota: 'propina' },
        { token: 'E', emisor: 'g', denominacion: 'vale', cantidad: 1, de: autor, a: otro, refiere: '2025-01-01T00:00:00Z' },
        { token: 'R', emisor: autor, cantidad: 1, de: autor, a: autor, estado: 'bloqueo' },
        { token: 'E', emisor: 'g', denominacion: 'vale', cantidad: 1, de: autor, a: otro, salida: 's' },
        { token: 'P', ambito: 'genesis', cantidad: 1, de: autor, a: autor, estado: 'liberacion' },
      ]));
    }
  }
  if (p(0.03)) movimientos.length = 0;
  const k = azar();
  const sobre = uno([A, B, eje.genesisId, eje.orden.at(-1), p(0.15) ? AUSENTE : A]);
  const tFoco = eje.obtener(sobre) ? Date.parse(eje.obtener(sobre).t) : reloj;
  const t = k < 0.05 ? iso(tFoco - uno([1000, 3600e3])) : k < 0.1 ? iso(eje.tMaximo() + ANIO + uno([0, 1000, 86400e3])) : k < 0.13 ? iso(Date.parse(ALTA) - 86400e3) : iso(reloj + uno([0, 0, 60e3, 3600e3, 26 * 3600e3]));
  const payload = p(0.12) ? ['x', [[['a', 'b']], ['c']]] : p(0.05) ? ['x', ['mint', 'R:casa', 'casa']] : ['f' + Math.floor(azar() * 1e6)];
  return { autor, sobre, t, movimientos, payload };
}

/** Una acción coherente, casi siempre válida: escribir, dar, respaldar y emitir, liberar, delegar, contar el pasado. */
function sensato(w, reloj, uno, p) {
  const { eje, A, B } = w;
  const autor = uno(['casa', 'casa', 'socia', 'bea', 'g']);
  const movimientos = [minuto(autor)];
  const vista = eje.libro.vista(autor);
  const otro = uno(w.personas.filter((x) => x !== autor));
  const accion = uno(['escribe', 'da', 'emite', 'emite', 'libera', 'delega', 'pasado', 'P']);
  const bloqueos = eje.bloqueos(autor).filter((b) => b.token === 'P');
  if (accion === 'da' && (vista['E:g/vale']?.disponible ?? 0) > 0) movimientos.push({ token: 'E', emisor: 'g', denominacion: 'vale', cantidad: 1, de: autor, a: otro });
  else if (accion === 'emite' && autor === 'casa') {
    const den = uno(['cama@n', 'sofa@n']) + (eje.orden.length % 30);
    const registro = uno([A, B]);
    if ((vista['P:' + A]?.disponible ?? 0) > 0) movimientos.push({ token: 'P', ambito: A, cantidad: 1, de: 'casa', a: 'casa', estado: 'bloqueo', salida: claveToken({ token: 'E', emisor: 'casa', denominacion: den, registro }) });
    movimientos.push({ token: 'E', emisor: 'casa', denominacion: den, registro, cantidad: 1, de: null, a: 'casa' });
  } else if (accion === 'libera' && bloqueos.length) {
    const b = uno(bloqueos);
    const mio = vista[b.salida]?.disponible ?? 0;
    if (mio > 0 && p(0.6)) {
      const partes = b.salida.slice(2).split('/');
      const [denominacion, registro] = partes[1].split(/@(?=[0-9a-f]{64}$)/);
      movimientos.push({ token: 'E', emisor: partes[0], denominacion, ...(registro ? { registro } : {}), cantidad: mio, de: autor, a: null });
    }
    movimientos.push({ token: 'P', ambito: b.clave.slice(2), cantidad: b.cantidad, de: autor, a: autor, estado: 'liberacion', salida: b.salida });
  } else if (accion === 'delega' && (vista['P:' + A]?.disponible ?? 0) > 0) movimientos.push({ token: 'P', ambito: A, cantidad: 1, de: autor, a: otro });
  else if (accion === 'pasado') movimientos.push({ token: 'T', escala: uno(['pasado', 'futuro']), cantidad: 2, de: autor, a: null, refiere: '2025-06-01T00:00:00Z' });
  else if (accion === 'P') {
    const propios = eje.orden.filter((id) => eje.obtener(id).autor === autor).slice(-3);
    if (propios.length) movimientos.push({ token: 'P', ambito: uno(propios), cantidad: 1, de: null, a: autor });
  }
  const sobre = uno([A, B, eje.genesisId, ...eje.orden.slice(-2)]);
  return { autor, sobre, t: iso(reloj + uno([0, 60e3, 3600e3])), movimientos, payload: ['s' + eje.orden.length] };
}

/** Un génesis al azar sobre el libro vacío. */
function genesisAlAzar(azar, i) {
  const uno = (xs) => xs[Math.floor(azar() * xs.length)];
  const p = (x) => azar() < x;
  const autor = 'g' + (i % 3);
  const movimientos = [];
  if (p(0.5)) movimientos.push({ token: 'E', emisor: p(0.85) ? autor : 'otro', denominacion: 'EUR', cantidad: 10, de: null, a: autor, ...(p(0.15) ? { registro: AUSENTE } : {}) });
  if (p(0.5)) movimientos.push({ token: 'P', ambito: uno(['genesis', 'genesis', AUSENTE]), cantidad: 10, de: null, a: p(0.85) ? autor : 'otro' });
  if (p(0.4)) movimientos.push({ token: 'R', emisor: p(0.9) ? autor : 'otro', cantidad: 3, de: null, a: p(0.9) ? autor : 'otro' });
  if (p(0.15)) movimientos.push({ token: 'R', emisor: autor, cantidad: 1, de: autor, a: autor, estado: 'bloqueo', salida: 'R:' + autor });
  if (p(0.15)) movimientos.push(minuto(autor));
  if (p(0.1)) movimientos.push({ token: 'T', escala: 'minuto', cantidad: 1, de: null, a: autor });
  if (p(0.1)) movimientos.push({ token: 'E', emisor: 'zeta', denominacion: 'EUR', cantidad: 1, de: 'zeta', a: autor });
  return { autor, sobre: null, t: '2026-11-07T09:00:00Z', movimientos, payload: p(0.8) ? ['raíz'] : ['x', [[['a', 'b']], ['c']]], contexto: { genesis: true, demostracion: true, tipos: { [autor]: 'persona' } } };
}

test('fuzz corto con semilla fija: el mismo veredicto que la condición JS, o más estricta solo donde el eje ya rechaza', async () => {
  let s = 20261109;
  const azar = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const w = await mundo();
  let reloj = T0 + 7200e3;
  const divergencias = [];
  const rechazosJS = {};
  const pasaJS = {};
  let validos = 0;
  let inofensivas = 0;
  const anota = (js) => { for (const [n, m] of Object.entries(js)) (m.length ? rechazosJS : pasaJS)[n] = ((m.length ? rechazosJS : pasaJS)[n] ?? 0) + 1; };
  for (let i = 0; i < 360; i++) {
    const ev = await aMano(evento(w, reloj, azar));
    const errores = await w.eje.validar(ev);
    const { fuera, js } = comparar(w.eje, ev, errores.length === 0);
    anota(js);
    for (const f of fuera) (f.clase === 'divergencia' ? divergencias : []).push({ ...f, eje: errores.slice(0, 3) });
    inofensivas += fuera.filter((f) => f.clase === 'inofensiva').length;
    if (!errores.length) {
      validos++;
      if (azar() < 0.7) { await w.eje.anadir(ev); reloj = Math.max(reloj, Date.parse(ev.t)); }
    }
  }
  for (let i = 0; i < 90; i++) {
    const g = await aMano(genesisAlAzar(azar, i));
    let acepta = true;
    try { await Eje.desde([g]); } catch { acepta = false; }
    const { fuera, js } = comparar(new Eje(), g, acepta);
    anota(js);
    for (const f of fuera) (f.clase === 'divergencia' ? divergencias : []).push({ ...f, eje: acepta ? 'acepta' : 'rechaza' });
  }
  assert.deepEqual(divergencias, []);
  assert.ok(validos >= 60, 'eventos válidos: ' + validos);
  // Cada regla se ejercita por los dos lados: alguna vez su condición JS rechaza y alguna vez pasa.
  const faltan = [];
  for (const r of REGLAS) {
    const n = nombreDe(r);
    if (!((rechazosJS[n] ?? 0) > 0)) faltan.push(n + ': su condición JS no rechaza ningún evento del fuzz');
    if (!((pasaJS[n] ?? 0) > 0)) faltan.push(n + ': su condición JS no deja pasar ningún evento del fuzz');
  }
  assert.deepEqual(faltan, []);
  assert.ok(inofensivas > 0, 'el fuzz también llega a eventos que el eje ya rechaza por otro lado');
});

// ---------- lo que es suelo: la regla no lo mira y el eje lo rechaza igual ----------

test('suelo: una cantidad de T que no es un entero seguro, una salida que no es texto, un movimiento null; el eje los rechaza por la forma', async () => {
  const { eje, menu } = await ejemploCompra();
  const casos = [
    ['T is whole', { token: 'T', escala: 'segundo', cantidad: 2 ** 53 + 2, de: 'huesped', a: null }],
    ['locks keep their holder and name an exit', { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 1, de: 'huesped', a: 'huesped', estado: 'bloqueo', salida: 5 }],
  ];
  for (const [n, m] of casos) {
    const ev = await aMano({ autor: 'huesped', sobre: menu.id, t: '2026-11-07T16:00:00Z', movimientos: [minuto('huesped'), m], payload: ['suelo'] });
    const { bq, js } = comparar(eje, ev, false);
    assert.equal(bq[n].pasa, true, n + ': la regla no lo ve');
    assert.ok(js[n].length > 0, n + ': la forma sí');
    assert.ok((await eje.validar(ev)).length > 0, 'el eje lo rechaza');
  }
  // Un movimiento null: D-MOV no lo despliega y las reglas que leen ev.1 no pasan (ERROR); la forma lo rechaza.
  const nulo = await aMano({ autor: 'huesped', sobre: menu.id, t: '2026-11-07T16:00:00Z', movimientos: [minuto('huesped'), null], payload: ['suelo'] });
  assert.equal(veredictos(eje, nulo)['T is whole'].pasa, false);
  assert.ok((await eje.validar(nulo)).some((e) => /no es objeto/.test(e)));
});

// ---------- divergencias conocidas: test.skip con id y motivo (docs/BQLM.md §10) ----------

/**
 * Registra una divergencia conocida. Con AGRAM_DIVERGENCIAS=1 se ejecuta y
 * comprueba que la regla y su condición JS siguen sin dar el mismo veredicto.
 */
function divergencia(id, regla, motivo, caso) {
  (DIVERGENCIAS ? test : test.skip)(id + ' · ' + regla + ': ' + motivo, async () => {
    const { eje, ev, aceptaElEje } = await caso();
    const { bq, js } = comparar(eje, ev, aceptaElEje);
    assert.notEqual(bq[regla].pasa, js[regla].length === 0, 'la divergencia sigue: regla ' + (bq[regla].pasa ? 'pasa' : bq[regla].motivo) + ' / JS ' + js[regla].join('; '));
    if (aceptaElEje !== undefined) assert.equal((await eje.validar(ev)).length === 0, aceptaElEje, 'el eje ' + (aceptaElEje ? 'acepta' : 'rechaza'));
  });
}

const enLaCompra = (datos, aceptaElEje) => async () => {
  const { eje, menu } = await ejemploCompra();
  return { eje, ev: await aMano({ autor: 'huesped', sobre: menu.id, t: '2026-11-07T16:00:00Z', payload: ['x'], ...(typeof datos === 'function' ? datos({ eje, menu }) : datos) }), aceptaElEje };
};

divergencia('D-META-1', "writing burns today's T", '[X] VG: ev.1 trae los movimientos y el 1 del payload; una referencia a un evento ausente deja PENDIENTE toda regla que lee ev.1 (falta una posición con solo los movimientos)',
  enLaCompra({ movimientos: [minuto('huesped')], payload: ['x', { ref: AUSENTE }] }, true));
divergencia('D-META-3', 'the author has an account', '[X] VG: lo mismo en ev.3 (el 3 del payload colisiona con el autor y el firmante)',
  enLaCompra({ movimientos: [minuto('huesped')], payload: ['x', '-', '-', { ref: AUSENTE }] }, true));
divergencia('D-MOV-7', 'informative T is only burned', 'falta una posición: D-MOV pone «caduca ?? refiere» en el 7; con las dos, la fecha a la que se refiere no se ve ([X] VG: separarlas en D-MOV)',
  async () => {
    const { eje, menu } = await ejemploCompra();
    return { eje, ev: await aMano({ autor: 'casa', sobre: menu.id, t: '2026-11-07T16:00:00Z', payload: ['vale'], movimientos: [minuto('casa'), { token: 'E', emisor: 'casa', denominacion: 'vale', cantidad: 1, de: null, a: 'casa', caduca: '2026-12-01T00:00:00Z', refiere: '2025-01-01T00:00:00Z' }] }), aceptaElEje: false };
  });
divergencia('R10-T', "writing burns today's T", '[X] VG, la asignación de una cosa (BQLM §8): la regla no lee el tipo y le cuenta a una cosa la asignación de la época; lo para el saldo',
  enLaCompra({ autor: 'cocina', movimientos: [{ token: 'T', escala: 'hora', cantidad: 43, de: 'cocina', a: null }] }, false));
divergencia('RELOJ-MS', 'not before its focus', 'falta una posición: D-FECHA da segundos enteros; dentro del mismo segundo, unos milisegundos antes del foco pasan ([X] VG: un despliegue con el milisegundo o un reloj en segundos)',
  async () => {
    const w = await mundo();
    const foco = await w.eje.escribir({ autor: 'casa', sobre: w.A, t: '2026-11-08T11:00:00.500Z', movimientos: [minuto('casa')], payload: ['foco'] });
    return { eje: w.eje, ev: await aMano({ autor: 'bea', sobre: foco.id, t: '2026-11-08T11:00:00.200Z', payload: ['antes'], movimientos: [minuto('bea')] }), aceptaElEje: false };
  });
divergencia('GENESIS-GUARDA', "P is minted on one's own record", '[X] VG: cómo se aparta el génesis de las reglas de «*»; «or count up ev = 0» deja pasar un evento sin foco que no es el génesis (lo para el ancla)',
  async () => {
    const w = await mundo();
    return { eje: w.eje, ev: await aMano({ autor: 'bea', sobre: null, t: iso(T0 + 3600e3), payload: ['x'], movimientos: [minuto('bea'), { token: 'P', ambito: w.A, cantidad: 1, de: null, a: 'bea' }] }), aceptaElEje: false };
  });
divergencia('PATH-10', 'minting E needs P on the record', '[X] VG: path tiene tope de diez niveles; con el P en un antepasado a más de diez, PENDIENTE (JS sube el hilo entero)',
  async () => {
    const w = await mundo();
    let foco = w.B;
    for (let k = 0; k < 11; k++) foco = (await w.eje.escribir({ autor: 'casa', sobre: foco, t: iso(T0 + 3600e3), movimientos: [minuto('casa')], payload: ['nivel ' + k] })).id;
    return { eje: w.eje, ev: await aMano({ autor: 'casa', sobre: foco, t: iso(T0 + 3600e3), payload: ['hondo'], movimientos: [minuto('casa'), { token: 'E', emisor: 'casa', denominacion: 'hondo', cantidad: 1, de: null, a: 'casa' }] }), aceptaElEje: true };
  });
divergencia('EE-4', 'locked P backing live E is not released', 'falta un despliegue: la clave de familia (franja «*») no es una posición de D-SERIE; la liberación de un bloqueo de familia queda fuera de la regla',
  async () => {
    const w = await mundo();
    const fam = 'E:casa/cama@*@' + w.A;
    await w.eje.escribir({ autor: 'casa', sobre: w.A, t: iso(T0 + 3600e3), payload: ['bloquea la familia'], movimientos: [minuto('casa'), { token: 'P', ambito: w.A, cantidad: 1, de: 'casa', a: 'casa', estado: 'bloqueo', salida: fam }, { token: 'E', emisor: 'casa', denominacion: 'cama@n1', registro: w.A, cantidad: 1, de: null, a: 'casa' }] });
    return { eje: w.eje, ev: await aMano({ autor: 'casa', sobre: w.A, t: iso(T0 + 7200e3), payload: ['libera'], movimientos: [minuto('casa'), { token: 'P', ambito: w.A, cantidad: 1, de: 'casa', a: 'casa', estado: 'liberacion', salida: fam }] }), aceptaElEje: false };
  });
divergencia('RL-4', 'locked P backing live E is not released', 'falta una vista: X.1 caduca con ev.6.0 y la condición JS con el reloj de los demás (tMaximo sin el autor), que no tiene posición',
  async () => {
    const w = await mundo();
    const k = 'E:casa/noche@n9@' + w.A;
    await w.eje.escribir({ autor: 'casa', sobre: w.A, t: iso(T0 + 3600e3), payload: ['noche'], movimientos: [minuto('casa'), { token: 'P', ambito: w.A, cantidad: 1, de: 'casa', a: 'casa', estado: 'bloqueo', salida: k }, { token: 'E', emisor: 'casa', denominacion: 'noche@n9', registro: w.A, caduca: iso(T0 + 2 * 3600e3), cantidad: 1, de: null, a: 'casa' }] });
    return { eje: w.eje, ev: await aMano({ autor: 'casa', sobre: w.A, t: iso(T0 + 6 * 3600e3), payload: ['libera'], movimientos: [minuto('casa'), { token: 'P', ambito: w.A, cantidad: 1, de: 'casa', a: 'casa', estado: 'liberacion', salida: k }] }), aceptaElEje: false };
  });
(DIVERGENCIAS ? test : test.skip)('VA-3 · minting P or E needs own R at stake: [X] VG: ninguna posición dice si un evento es del prefijo de la versión 2; la condición JS no lo evalúa y la regla sí (¿época propia o suelo de la persistencia?)', async () => {
  const g = await aMano({ autor: 'club', sobre: null, t: '2026-11-06T09:00:00Z', payload: ['v2'], movimientos: [{ token: 'T', escala: 'hora', cantidad: 10, de: null, a: 'club' }], contexto: { genesis: true, tipos: { club: 'grupo' } } });
  const ev = await aMano({ autor: 'club', sobre: g.id, t: '2026-11-06T10:00:00Z', payload: ['vale'], movimientos: [{ token: 'T', escala: 'hora', cantidad: 1, de: 'club', a: null }, { token: 'E', emisor: 'club', denominacion: 'vale', cantidad: 1, de: null, a: 'club' }] });
  await Eje.desde([g, ev], { eventosV2: 2 }); // en el prefijo v2, el eje lo acepta
  const r = veredictos(await Eje.desde([g], { eventosV2: 1 }), ev)['minting P or E needs own R at stake'];
  assert.equal(r.pasa, false, 'la regla no sabe que el evento es del prefijo');
});

// Lo que VG retira (mapa §15, «R según el corpus», 9-11): la regla no lo traduce, a propósito.
(DIVERGENCIAS ? test : test.skip)('RR-3 retirada · R is minted by its issuer: emitir R ya no exige colateral (VG 9-11); el eje de hoy lo rechaza por RR-3 y la regla lo deja pasar', async () => {
  const w = await mundo();
  const ev = await aMano({ autor: 'bea', sobre: w.eje.genesisId, t: iso(T0 + 3600e3), payload: ['R sin colateral'], movimientos: [minuto('bea'), { token: 'R', emisor: 'bea', cantidad: 500, de: null, a: 'bea' }] });
  const ctx = w.eje.contexto(ev);
  assert.ok(RR3.evaluar(ev, ctx.r, analizarR(ev, ctx.r)).length > 0, 'RR-3 lo rechaza');
  assert.equal(veredictos(w.eje, ev)['R is minted by its issuer'].pasa, true);
});
(DIVERGENCIAS ? test : test.skip)('RR-1 retirada: la R se transfiere libremente entre tenedores y se quema (perdonar); ninguna regla lo prohíbe y el eje de hoy lo rechaza («R no es fungible»)', async () => {
  const w = await mundo();
  await w.eje.escribir({ autor: 'casa', sobre: w.eje.genesisId, t: iso(T0 + 3600e3), payload: ['da R'], movimientos: [minuto('casa'), { token: 'R', emisor: 'casa', cantidad: 2, de: 'casa', a: 'bea' }] });
  const ev = await aMano({ autor: 'bea', sobre: w.eje.genesisId, t: iso(T0 + 7200e3), payload: ['pasa R'], movimientos: [minuto('bea'), { token: 'R', emisor: 'casa', cantidad: 1, de: 'bea', a: 'socia' }] });
  assert.ok((await w.eje.validar(ev)).some((e) => /no es fungible/.test(e)));
  assert.ok(Object.values(veredictos(w.eje, ev)).every((r) => r.pasa));
});
