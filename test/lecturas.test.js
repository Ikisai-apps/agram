// Las diez lecturas (encargo «lecturas», issue #12, VG 11-11 noche): una regla larga por punto de vista en epoch.2
// («point of view» en su 4), «qué lee el PV d aplicado a un nodo N», encadenadas por los dígitos de la dirección según
// las reglas cortas. contrato.leer(eje, N, d) da lo anclado en N.d más lo que deriva del libro; contrato.leerRuta(eje,
// N, [d1, d2, …]) encadena. Los primeros casos reales, con Core (la identidad «cosa» que VG da de alta y admite con R y
// T: 1.3, 1.3.4, 1.4, 3.4), la anidación 1 ⊂ 2 ⊂ 3 con el jardín y el parque, y la carta bajando toda la profundidad de
// cada matriz con la dirección entera (1 → 1.1 → 1.1.1 → 1.1.1.1) y creando en un hueco de cualquier nivel.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/contrato.js';
import { EPOCA_0_BTML } from '../src/epocas.js';
import { esLecturaDePv } from '../src/bqlm.js';
import { acciones, salida, autoridad, direccion } from '../src/index.js';
import { arbol } from '../carta/carta.js';
import { html } from '../carta/dom.js';
import { t as textoDe } from '../carta/textos.js';
import { instalar } from '../carta/gestos.js';
import * as Q from '../carta/cuentas.js';
import * as K from '../carta/carta.js';
import { ejemploCompra, ejemploJardinYParque } from '../ejemplos/ikisai/compra-food.mjs';

const GRANDE = { ancho: 1920, alto: 1080 };
const completa = (X, pv, extra = {}) => ({ foco: { X, pv }, ...extra });
const T = (m) => '2026-11-10T10:' + String(m).padStart(2, '0') + ':00Z';

/**
 * El caso de Core en memoria, como test/be.test.js sin servidor: VG (una cuenta) ancla «AGRAM» y «Menú del día» en su
 * alta; da de alta a Core («register a thing», 60 minutos de T y su clave con la prueba de posesión, en el 1.4 de su
 * alta); Core propone «Ikisai» en la fábrica de AGRAM; VG lo admite en el 2.3 de AGRAM; Core deja una sugerencia en el
 * menú; VG le da R por ella («give own R») y lo admite en el menú («admit someone»: R y 5 minutos de T).
 */
async function conCore() {
  const cuenta = await Q.crearCuenta({ nombre: 'Víctor', idioma: 'es', t: T(0) });
  const yo = cuenta.cuenta.identidad;
  const eje = cuenta.eje;
  const firmar = Q.firmarCon(cuenta.privada);
  let m = 1;
  const anclar = async (sobre, title, content) => {
    const tx = await acciones.transaccion(eje, 'anchor here', { X: sobre, title, ...(content ? { content } : {}) }, yo, { t: T(m++), firmar });
    assert.equal(tx.ok, true, JSON.stringify(tx.motivos));
    return (await eje.anadir(tx.evento)).id;
  };
  const agram = await anclar(cuenta.cuenta.alta, 'AGRAM', 'el proyecto');
  const menu = await anclar(cuenta.cuenta.alta, 'Menú del día', 'tres platos y postre');
  const core = { nombre: 'core', ...(await autoridad.generarClaves()) };
  const tAlta = T(m++);
  const peticion = await acciones.transaccion(eje, 'register a thing', { X: cuenta.cuenta.alta, thing: 'core', key: core.publica }, yo, { t: tAlta, firmar: (ev) => autoridad.firmarPosesion(ev, 'core', core.privada) });
  const alta = await K.enviar(eje, cuenta.cuenta.alta, 'register a thing', { thing: 'core', key: core.publica, minutes: 60, proof: peticion.evento.posesion.core }, yo, firmar, { t: tAlta });
  assert.equal(alta.ok, true, JSON.stringify(alta.motivos));
  const deCore = async (nombre, X, valores) => {
    const r = await acciones.transaccion(eje, nombre, { X, ...valores }, 'core', { t: T(m++), firmar: (ev) => autoridad.firmar(ev, core.privada) });
    assert.equal(r.ok, true, nombre + ': ' + JSON.stringify(r.motivos));
    return eje.anadir(r.evento);
  };
  const propuesta = await deCore('propose', agram, { title: 'Ikisai', content: 'el ecosistema de apps' });
  const admitidoEnAgram = await salida.escribirDesde(eje, { modo: 'sequenced', autor: yo, sobre: agram, en: direccion([2, 3]), payload: ['core'], t: T(m++) }, cuenta.privada);
  const sugerencia = await deCore('anchor here', menu, { title: 'Sugerencia de Core' });
  const dar = await K.enviar(eje, sugerencia.id, 'give own R', { amount: 1 }, yo, firmar, { t: T(m++) });
  assert.equal(dar.ok, true, JSON.stringify(dar.motivos));
  const admitir = await K.enviar(eje, menu, 'admit someone', { whom: 'core', minutes: 5 }, yo, firmar, { t: T(m++) });
  assert.equal(admitir.ok, true, JSON.stringify(admitir.motivos));
  return { eje, yo, firmar, cuenta, alta: cuenta.cuenta.alta, agram, menu, altaCore: alta.asentado.id, propuesta: propuesta.id, admitidoEnAgram: admitidoEnAgram.id, sugerencia: sugerencia.id, dar: dar.asentado.id, admitir: admitir.asentado.id, t: () => T(m++) };
}

/** Los valores de una lectura, legibles para comparar: un registro por su id, lo demás tal cual. */
const valores = (lista) => lista.map((x) => (x.valor?.ref ? x.valor.ref : x.valor));
const porDe = (x) => x.por.map((p) => [p.pv, p.regla]);

// ---------- las diez reglas ----------

test('las diez lecturas son reglas largas de epoch.2, una por PV («point of view» en su 4, el PV en su 3), con sus textos es y en; ni condiciones ni lecturas materializadas', () => {
  const l = C.lecturasDePv();
  assert.deepEqual(l.map((x) => x.pv), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(l.map((x) => x.nombre), ['what it is', 'how much', 'on what condition', 'with whom', 'what is done', 'where it fits', 'where it comes from', 'by when', 'against others', 'how']);
  // En BQL donde el BQL mínimo alcanza; envueltas (una lectura JS nombrada) donde no.
  assert.deepEqual(l.filter((x) => x.formulas.length && !x.js.length).map((x) => x.pv), [2, 3, 4, 5, 6, 8]);
  assert.deepEqual(l.filter((x) => x.js.length).map((x) => [x.pv, x.js]), [[0, ['representaciones']], [1, ['flujo']], [7, ['futuro']], [9, ['camino']]]);
  for (const x of l) {
    assert.ok(esLecturaDePv(x.regla));
    assert.ok(!EPOCA_0_BTML.condiciones.includes(x.regla) && !EPOCA_0_BTML.lecturas.includes(x.regla), x.nombre + ': ni condición ni lectura materializada');
    assert.equal(x.regla.length, 10);
    const es = C.mensaje(null, x.regla, 'es');
    assert.ok(es.startsWith(x.nombre + ': ') && es !== x.regla[9].at(-1), x.nombre + ': su texto en español, distinto del canónico');
  }
});

test('leer: lo anclado es lo de ocupantes (igual que hoy) y lo derivado no lo repite; cada derivado lleva su por; un nodo que no es registro ni identidad no da nada', async () => {
  const c = await conCore();
  for (const d of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    const r = C.leer(c.eje, c.menu, d);
    assert.deepEqual(r.anclado, C.ocupantes(c.eje, c.menu, d, 0, 1000).ocupantes, 'el ' + d + ': lo anclado, como ocupantes');
    assert.deepEqual(r.lista.filter((x) => x.origen === 'anclado').map((x) => x.valor), r.anclado);
    assert.deepEqual(r.lista.filter((x) => x.origen === 'derivado').map((x) => x.valor), r.derivado.map((x) => x.valor));
    const claves = r.lista.map((x) => JSON.stringify(x.valor?.ref ?? x.valor));
    assert.equal(new Set(claves).size, claves.length, 'sin repetir');
    for (const x of r.derivado) assert.deepEqual(x.por.map((p) => p.pv), [d]);
  }
  assert.deepEqual(C.leer(c.eje, 'no-existe', 1), { pv: 1, anclado: [], derivado: [], lista: [] });
  assert.deepEqual(C.leerRuta(c.eje, c.menu, []).derivado, []);
});

test('las diez, una a una sobre un registro: 0 sus representaciones, 1 lo movido con otros, 2 sus criterios, 3 con quién, 4 el trabajo de otros, 5 su ancla, 6 su hilo, 7 el T futuro con su fecha, 8 sus hermanos, 9 el tutorial', async () => {
  const c = await conCore();
  const der = (N, d) => valores(C.leer(c.eje, N, d).derivado);
  assert.deepEqual(der(c.alta, 0), ['Víctor']);
  assert.deepEqual(new Set(der(c.alta, 1)), new Set([c.altaCore, c.propuesta, c.sugerencia, c.dar, c.admitir]), 'lo que VG movió con Core y lo que Core quemó en lo de VG; no lo que VG solo quema al escribir');
  assert.deepEqual(C.leer(c.eje, c.alta, 1).derivado.find((x) => x.valor.ref === c.altaCore).por[0].movimientos, [{ serie: 'T:minuto', cantidad: 60, de: c.yo, a: 'core' }]);
  assert.deepEqual(der(c.agram, 2), [c.admitidoEnAgram], 'el criterio de VG en el 2.3 de AGRAM');
  assert.deepEqual(der(c.admitir, 3), ['core'], 'con quién mueve R y T al admitirlo (lo anclado en su 3 es la décupla de la plantilla)');
  assert.deepEqual(der(c.menu, 4), [c.sugerencia], 'lo que Core escribió en el menú quemando T');
  assert.deepEqual(der(c.agram, 5), [c.alta]);
  assert.deepEqual(der(c.propuesta, 6), [c.agram, c.alta]);
  assert.deepEqual(new Set(der(c.agram, 8)), new Set([c.menu, c.altaCore]));
  assert.deepEqual(der(c.alta, 9), C.leer(c.eje, c.alta, 9).derivado.map((x) => x.valor));
  assert.ok(der(c.alta, 9).length > 0 && der(c.alta, 9).every((n) => typeof n === 'string'), 'el tutorial del alta: nombres de acciones');
  // 7: el T futuro declarado, con la fecha a la que se refiere
  const futuro = await acciones.transaccion(c.eje, 'declare future T', { X: c.agram, what: 'revisar', when: '2026-12-01T10:00:00Z', units: 2 }, c.yo, { t: c.t(), firmar: c.firmar });
  assert.equal(futuro.ok, true, JSON.stringify(futuro.motivos));
  const ev = await c.eje.anadir(futuro.evento);
  assert.deepEqual(C.leer(c.eje, c.agram, 7).anclado, [{ ref: ev.id }], 'en AGRAM está anclado en su 7 (lo derivado no lo repite)');
  const siete = C.leer(c.eje, c.alta, 7).derivado;
  assert.deepEqual(valores(siete), [ev.id]);
  assert.equal(siete[0].por[0].refiere, '2026-12-01T10:00:00Z');
});

// ---------- los casos de Core ----------

test('Core en lo de VG: 1.3 las identidades con las que ha movido R o T, 1.3.4 las que tienen T suya, 1.4 los trabajos (lo que Core escribió en lo de VG moviendo T), 3.4 quien tiene R suya dada al admitirlo; derivados, con su por', async () => {
  const c = await conCore();
  // 1.3: con quién (3) aplicado a lo que se mueve (1) en el alta de VG
  const r13 = C.leerRuta(c.eje, c.alta, [1, 3]);
  const core13 = r13.derivado.find((x) => x.valor === 'core');
  assert.ok(core13, '1.3: Core sale, derivado');
  assert.deepEqual(porDe(core13), [[1, 'how much'], [3, 'with whom']]);
  assert.deepEqual(new Set(core13.por[1].desde), new Set([c.altaCore, c.propuesta, c.sugerencia, c.dar, c.admitir]), 'por cada registro que movió R o T con Core');
  assert.ok(!r13.derivado.some((x) => x.valor === c.yo), 'VG no es «con quién» de lo suyo');
  assert.ok(r13.lista.some((x) => x.valor === 'core' && x.origen === 'derivado'));
  // 1.3.4: qué se hace (4) con ellos: las que tienen T de VG (lo laboral)
  const r134 = C.leerRuta(c.eje, c.alta, [1, 3, 4]);
  assert.deepEqual(valores(r134.derivado), ['core']);
  assert.deepEqual(porDe(r134.derivado[0]), [[1, 'how much'], [3, 'with whom'], [4, 'what is done']]);
  // 1.4: los trabajos: lo que Core escribió sobre lo de VG moviendo T (no lo de VG); lo anclado, el alta de Core
  const r14 = C.leerRuta(c.eje, c.alta, [1, 4]);
  assert.deepEqual(r14.anclado, [{ ref: c.altaCore }], 'lo anclado en el 1.4 del alta: el alta de Core');
  assert.deepEqual(new Set(valores(r14.derivado)), new Set([c.propuesta, c.sugerencia]));
  for (const x of r14.derivado) assert.deepEqual(porDe(x), [[1, 'how much'], [4, 'what is done']]);
  // 3.4: qué se hace (4) con quién (3): quien tiene R de VG dada al admitirlo (con T)
  const r34 = C.leerRuta(c.eje, c.alta, [3, 4]);
  assert.deepEqual(valores(r34.derivado), ['core']);
  assert.deepEqual(porDe(r34.derivado[0]), [[3, 'with whom'], [4, 'what is done']]);
  // el 1.4 y el 4 del menú (CORE_IDENTIDAD: lo escrito sobre X por quien admití que quema T)
  assert.deepEqual(valores(C.leerRuta(c.eje, c.menu, [1, 4]).derivado), [c.sugerencia]);
  assert.deepEqual(valores(C.leer(c.eje, c.menu, 4).derivado), [c.sugerencia]);
  // ocupantes no cambia: sigue dando lo anclado (test/be.test.js lo comprueba contra el servidor)
  assert.ok(!C.ocupantes(c.eje, c.alta, '1.3').ocupantes.includes('core'));
  assert.ok(!C.ocupantes(c.eje, c.menu, 4).ocupantes.some((o) => o?.ref === c.sugerencia));
});

test('Core en la carta: el mundo 1 del alta de VG trae a Core derivado en su 3 (1.3) y los trabajos en su 4 (1.4), con la marca discreta y el porqué; el 3 trae a Core en su 4 (3.4)', async () => {
  const c = await conCore();
  const uno = (await arbol(completa(c.alta, 1), c.eje, c.yo, GRANDE)).centro.rejilla;
  const celda = (r, pv) => r.celdas.find((x) => x.pv === pv);
  // Core es una hoja (la identidad); su texto es el legible del núcleo (el 0 de su alta)
  assert.deepEqual(celda(uno, 3).derivados.map((o) => o.valor).filter((x) => x === 'core'), ['core']);
  assert.ok(celda(uno, 3).derivados.every((o) => o.derivado && o.por.startsWith('1 cuánto › 3 con quién')));
  assert.deepEqual(new Set(celda(uno, 4).derivados.map((o) => o.X)), new Set([c.propuesta, c.sugerencia]));
  assert.ok(celda(uno, 4).ocupantes.every((o) => !o.derivado), 'lo anclado sigue en ocupantes, sin marca');
  const h = html(await arbol(completa(c.alta, 1), c.eje, c.yo, GRANDE));
  assert.ok(h.includes(`class="derivado" title="${textoDe('derivadoPor', { por: '1 cuánto › 3 con quién' })}"`), 'la marca: una clase y el title con el por');
  const tres = (await arbol(completa(c.alta, 3), c.eje, c.yo, GRANDE)).centro.rejilla;
  assert.deepEqual(celda(tres, 4).derivados.map((o) => [o.valor, o.por]), [['core', '3 con quién › 4 qué se hace']]);
});

// ---------- la anidación 1 ⊂ 2 ⊂ 3 ----------

test('la anidación con el jardín y el parque: el 2 de un elemento lee sus criterios; el 3 sobre el 2, los comentarios sobre esos criterios; el 2 contiene al 1 y el 3 al 2', async () => {
  const c = await ejemploCompra();
  const j = await ejemploJardinYParque(c.eje, c);
  const comentario = await c.eje.escribir({ autor: 'casa', sobre: j.decision.id, en: '3000000000', t: '2026-11-07T15:30:00Z', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'casa', a: null }], payload: 'el sábado no abrimos' });
  // el 2 de la compra: sus criterios (lo anclado en el 2 y en el 2.1)
  const dos = C.leer(c.eje, c.compra.id, 2);
  assert.ok(dos.lista.some((x) => x.valor?.ref === j.decision.id), 'la decisión, en el 2');
  assert.ok(dos.derivado.some((x) => x.valor?.ref && c.eje.obtener(x.valor.ref).en === '2100000000'), 'el criterio de la huésped en el 2.1, derivado');
  // el 3 aplicado al 2: los comentarios sobre los criterios
  const dosTres = C.leerRuta(c.eje, c.compra.id, [2, 3]);
  const x = dosTres.derivado.find((y) => y.valor?.ref === comentario.id);
  assert.ok(x, 'el comentario sobre la decisión, en el 2.3 de la compra');
  assert.deepEqual(porDe(x), [[2, 'on what condition'], [3, 'with whom']]);
  assert.deepEqual(x.por[1].desde, [j.decision.id]);
  // las matrices: el 2 enciende los del 1 y el 3 los del 2 (fila 8.7, sin tocar)
  const hijos = (pv) => C.divisionDelMundo(null, pv).hijos;
  assert.deepEqual(hijos(2).slice(0, 4), hijos(1));
  assert.deepEqual(hijos(3).slice(0, 5), hijos(2));
  // en la carta, el 3 del mundo 2 de la compra trae el comentario, derivado
  const r = (await arbol(completa(c.compra.id, 2), c.eje, 'huesped', GRANDE)).centro.rejilla;
  assert.ok(r.celdas.find((y) => y.pv === 3).derivados.some((o) => o.X === comentario.id && o.por === '2 con qué condición › 3 con quién'));
});

// ---------- la profundidad entera ----------

/** Una compra con algo anclado en su 1.1, su 1.1.1 y su 1.1.1.1 (y en su 2.1.1.1 y su 3.1.1.1.1), para bajar por los dígitos. */
async function conProfundidad() {
  const c = await ejemploCompra();
  const T1 = [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'huesped', a: null }];
  const anclar = (en, payload, minuto) => c.eje.escribir({ autor: 'huesped', sobre: c.compra.id, en, t: '2026-11-08T10:' + String(minuto).padStart(2, '0') + ':00Z', movimientos: T1, payload });
  const a11 = await anclar('1100000000', 'uno.uno', 1);
  const a111 = await anclar('1110000000', 'uno.uno.uno', 2);
  const a1111 = await anclar('1111000000', 'uno.uno.uno.uno', 3);
  await anclar('2111000000', 'dos.uno.uno.uno', 4);
  await anclar('3111100000', 'tres.uno.uno.uno.uno', 5);
  return { ...c, a11: a11.id, a111: a111.id, a1111: a1111.id };
}

test('la carta baja toda la profundidad del 1 con la dirección entera (1 → 1.1 → 1.1.1 → 1.1.1.1): cada nivel lee R.<base>.<dígito> y trae lo anclado más lo derivado de la dirección entera; no pasa del cuarto', async () => {
  const c = await conProfundidad();
  const nivel = async (pasos) => (await arbol(completa(c.compra.id, 1, { profundidad: { 1: pasos } }), c.eje, 'huesped', GRANDE)).centro.rejilla;
  const esperados = [[], [1], [1, 1], [1, 1, 1]];
  const anclados = [null, c.a11, c.a111, c.a1111];
  for (const [k, base] of esperados.entries()) {
    const r = await nivel(base.map((d) => ({ d })));
    assert.equal(r.nivel, k + 1);
    assert.deepEqual(r.base, base);
    assert.equal(r.direccion, [1, ...base].join('.'), 'la dirección entera: el mundo y los dígitos bajados');
    for (const celda of r.celdas) {
      assert.deepEqual(celda.ocupantes.map((o) => o.X ?? o.valor ?? o.texto).length, C.ocupantes(c.eje, c.compra.id, [...base, celda.pv]).total, 'lo anclado en R.' + [...base, celda.pv].join('.'));
      const derivado = C.leerRuta(c.eje, c.compra.id, [1, ...base, celda.pv]).derivado.filter((x) => !C.ocupantes(c.eje, c.compra.id, [...base, celda.pv], 0, 100).ocupantes.some((o) => JSON.stringify(o) === JSON.stringify(x.valor)));
      assert.equal((celda.derivados ?? []).length, Math.min(derivado.length, 10), 'lo derivado de ' + [1, ...base, celda.pv].join('.'));
    }
    if (anclados[k]) {
      const uno = r.celdas.find((x) => x.pv === 1);
      assert.ok(uno.ocupantes.some((o) => o.valor === c.eje.obtener(anclados[k]).payload || o.texto === c.eje.obtener(anclados[k]).payload), 'lo anclado en ' + [...base, 1].join('.'));
    }
    assert.equal(r.celdas.some((x) => Number.isInteger(x.bajar)), k < 3, k < 3 ? 'se puede bajar' : 'el cuarto nivel es el último del 1');
  }
  const quinto = await nivel([{ d: 1 }, { d: 1 }, { d: 1 }, { d: 1 }]);
  assert.equal(quinto.nivel, 4, 'no pasa de la profundidad de su matriz');
  // el 2 baja cinco niveles y el 3 seis, con la dirección entera
  const enMundo = async (pv, n) => (await arbol(completa(c.compra.id, pv, { profundidad: { [pv]: Array(n).fill({ d: 1 }) } }), c.eje, 'huesped', GRANDE)).centro.rejilla;
  const r2 = await enMundo(2, 4);
  assert.deepEqual([r2.nivel, r2.direccion], [5, '2.1.1.1.1']);
  const r3 = await enMundo(3, 5);
  assert.deepEqual([r3.nivel, r3.direccion], [6, '3.1.1.1.1.1']);
  // entrar en un registro (con el dígito de su celda) también suma su dígito a la dirección
  const nota = await c.eje.escribir({ autor: 'huesped', sobre: c.compra.id, en: '3000000000', t: '2026-11-08T11:00:00Z', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'huesped', a: null }], payload: [['Nota']] });
  const dentro = (await arbol(completa(c.compra.id, 1, { profundidad: { 1: [{ X: nota.id, d: 3 }] } }), c.eje, 'huesped', GRANDE)).centro.rejilla;
  assert.deepEqual([dentro.X, dentro.direccion, dentro.ruta], [nota.id, '1.3', [nota.id]]);
  const sinDigito = (await arbol(completa(c.compra.id, 1, { profundidad: { 1: [nota.id] } }), c.eje, 'huesped', GRANDE)).centro.rejilla;
  assert.equal(sinDigito.direccion, '1.3', 'un id suelto (como hasta hoy): su dígito, el de la celda donde está anclado');
});

test('crear en un hueco de cualquier nivel escribe la dirección entera: el contenedor lleva la base (data-hueco-en), mantener un hijo abre el aro con ella y lo escrito ahí se lee en esa misma celda', async () => {
  const c = await conProfundidad();
  const estado = completa(c.compra.id, 1, { profundidad: { 1: [{ d: 1 }, { d: 1 }] } });
  const a = await arbol(estado, c.eje, 'huesped', GRANDE);
  assert.match(html(a), new RegExp(`data-hueco-x="${c.compra.id}" data-hueco-pv="1" data-hueco-en="1.1"`));
  // gestos.js: mantener (clic derecho) sobre el hijo 3 dentro del contenedor → aroNuevo(X, 3, { en: [1, 1] })
  const oyentes = [];
  const documento = { defaultView: { innerWidth: 1920, innerHeight: 1080 }, addEventListener: (tipo, f) => oyentes.push([tipo, f]), removeEventListener() {} };
  const raiz = { ownerDocument: documento, addEventListener: (tipo, f) => oyentes.push([tipo, f]), removeEventListener() {}, querySelector: () => null };
  const llamadas = [];
  instalar(raiz, new Proxy({}, { get: (_, nombre) => (...args) => { llamadas.push([nombre, ...args]); } }));
  const hijo = { dataset: { pv: '3' } };
  const contenedor = { dataset: { huecoX: c.compra.id, huecoPv: '1', huecoEn: '1.1' }, contains: (x) => x === hijo, parentElement: null };
  const objetivo = { closest: (sel) => (sel === '[data-x], [data-hueco-x]' ? contenedor : sel === '.rejilla-celda.hijo[data-pv]' ? hijo : null) };
  for (const [tipo, f] of oyentes) if (tipo === 'contextmenu') f({ target: objetivo, clientX: 500, clientY: 400, preventDefault() {} });
  const [llamada] = llamadas.filter((x) => x[0] === 'aroNuevo');
  assert.deepEqual([llamada[1], llamada[2], llamada[3].en], [c.compra.id, 3, [1, 1]]);
  // lo que hace la app con ella (app.js, campo con el aro de un hueco): escribe sobre X en la dirección entera, 1.1.3
  const ev = await salida.escribirDesde(c.eje, { modo: 'pointed', autor: 'huesped', sobre: c.compra.id, en: direccion([...llamada[3].en, llamada[2]]), payload: 'nuevo en 1.1.3', t: '2026-11-08T12:00:00Z' });
  assert.equal(ev.en, '1130000000');
  const r = (await arbol(estado, c.eje, 'huesped', GRANDE)).centro.rejilla;
  assert.ok(r.celdas.find((x) => x.pv === 3).ocupantes.some((o) => o.texto === 'nuevo en 1.1.3'), 'lo escrito se lee en la celda 3 del nivel 3 (1.1.3)');
});
