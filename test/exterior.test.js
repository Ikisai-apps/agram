// Los servicios de fuera como configuración y «verificado» como lectura (decisión #58 de VG; docs/CONTRATO.md §16.2 bis y
// §4.4; src/exterior.js, src/contrato.js verificado): la plantilla «exterior settings» de la época (relé, archivos, sello,
// con sus textos en es y en), el destino del transporte y de los archivos que salen de ella (con «sync url» de respaldo), el
// sello que sale de «seal url», la lectura `verificado(eje, id)` = { ok, sello, recibo, relojes } y su marca discreta en la
// carta (el reverso, la celda de la matriz del 4). Elegir Supabase o la simulación es solo configuración.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrato, salida, sincronia, sello, exterior } from '../src/index.js';
import { Eje } from '../src/eje.js';
import { generarClaves } from '../src/autoridad.js';
import * as G from '../carta/guia.js';
import { preferencias, arbol as arbolEnIdioma } from '../carta/carta.js';
import { htmlConfiguracion, html } from '../carta/dom.js';
import { destinoDe } from '../carta/archivos.js';
import { t } from '../carta/textos.js';
import { ejemploCompra, ejemploFabrica } from '../ejemplos/ikisai/compra-food.mjs';
import { pagaElCoste } from './ayudas-coste.js';
import { selloCompleto, observadorDePrueba, releDePrueba, reciboFirmado, declararExterior } from './ayudas-sello.js';

/** verificado(…) sin `pendiente` (lo que falta para comprobar, que se mira aparte), y las lecturas que faltan. */
const sinPendiente = (v) => { const { pendiente, pendienteDeSello, ...r } = v; return r; };
const faltan = (v) => v.pendiente.map((p) => p.lectura);

const T = (m) => '2026-11-10T10:' + String(m).padStart(2, '0') + ':00Z';
const minuto = (de) => pagaElCoste(de);
const PLANTILLA = exterior.AJUSTES.plantilla;

async function cuentaDeVg() {
  const cuenta = await generarClaves();
  const eje = await Eje.genesis({ identidad: 'vg', foco: ['mi eje'], t: T(0), clave: cuenta.publica, privada: cuenta.privada, exigirFirmas: true });
  return { cuenta, eje };
}

/** Escribe en mi alta los ajustes del exterior (un registro más, firmado) o las preferencias. */
async function ajustarExterior({ cuenta, eje }, valores, m = 1) {
  const a = G.ajustesEditablesDe(PLANTILLA, eje, 'vg', valores);
  await salida.escribirDesde(eje, { modo: 'sequenced', autor: 'vg', sobre: a.sobre, en: a.en, payload: a.payload, t: T(m) }, cuenta.privada);
  return a;
}
async function ajustarPreferencias({ cuenta, eje }, valores, m = 1) {
  const p = preferencias(eje, 'vg', valores);
  await salida.escribirDesde(eje, { modo: 'sequenced', autor: 'vg', sobre: p.sobre, en: p.en, payload: p.payload, t: T(m) }, cuenta.privada);
}

test('la plantilla «exterior settings» es de la época (9.2.5): relé, archivos, sello (y la reserva de pagos), claves del observador, confirmaciones (6) y guía (el 5 es el tipo), con su texto en es y su canónico en en', () => {
  assert.deepEqual(contrato.plantillas(null).map((p) => p.nombre), ['purchase', 'booking', 'guide settings', 'opinion', PLANTILLA, 'preferences']);
  assert.equal(contrato.plantillas(null).find((p) => p.nombre === PLANTILLA).donde, '9250000000');
  assert.deepEqual(contrato.clavesDeConfiguracionDe(PLANTILLA).map((c) => [c.pv, c.clave, c.defecto]), [
    [1, 'relay url', undefined], [2, 'blossom url', undefined], [3, 'seal url', undefined], [4, 'pay url', undefined],
    [6, 'observer keys', undefined], [7, 'confirmations', 6], [8, 'guide url', undefined],
  ]);
  assert.deepEqual(contrato.configuracionDe(null, 'vg', PLANTILLA), { confirmations: 6, de: null }, 'sin registro, sin url: nada va por fuera; en firme a las 6 confirmaciones');
  const etiqueta = (clave, idioma) => contrato.texto(null, contrato.claves.parametro(PLANTILLA, clave, 'label'), idioma, { original: clave });
  const nuevas = ['relay url', 'blossom url', 'seal url', 'observer keys', 'confirmations', 'guide url'];
  assert.deepEqual(nuevas.map((c) => etiqueta(c, 'en')), nuevas);
  assert.deepEqual(nuevas.map((c) => etiqueta(c, 'es')), ['relé', 'archivos', 'sello', 'claves del observador', 'confirmaciones', 'guía']);
  for (const c of ['observer keys', 'confirmations', 'guide url']) {
    assert.match(contrato.texto(null, contrato.claves.parametro(PLANTILLA, c, 'help'), 'es', { original: '' }), /[a-z]/, c + ': ayuda en español');
  }
  assert.equal(contrato.texto(null, contrato.claves.plantilla(PLANTILLA), 'es', { original: PLANTILLA }), 'ajustes del exterior');
  assert.match(contrato.texto(null, contrato.claves.parametro(PLANTILLA, 'seal url', 'help'), 'es', { original: '' }), /sello de tiempo/);
});

test('exterior(): las tres url de mi registro (http o https, sin la barra final); lo que no es una url y lo vacío no cuentan; el último registro manda; sin huecos: solo las claves con valor, y sus valores en paralelo (VG 13-11, #77)', async () => {
  const c = await cuentaDeVg();
  assert.deepEqual(exterior.exterior(c.eje, 'vg'), { relevo: null, archivos: null, sello: null, guia: null, observadores: [], confirmaciones: 6 });
  const a = await ajustarExterior(c, { 'relay url': 'http://127.0.0.1:8788/', 'blossom url': 'https://archivos.ejemplo/', 'seal url': 'ftp://no-es-http' });
  assert.deepEqual(a.campos.map((x) => x.clave), ['relay url', 'blossom url', 'seal url', 'pay url', 'observer keys', 'confirmations', 'guide url']);
  assert.deepEqual(exterior.exterior(c.eje, 'vg'), { relevo: 'http://127.0.0.1:8788', archivos: 'https://archivos.ejemplo', sello: null, guia: null, observadores: [], confirmaciones: 6 });
  // Sin huecos ni rellenos (#77): 0 el nombre, 1 las claves de los ajustes con valor, 2 sus valores en paralelo, 3 quién, 4 su ayuda, 5 el tipo; ninguna posición vacía ni «-»
  assert.deepEqual(a.payload.map((x) => x.length), [1, 4, 4, 1, 1, 1]);
  assert.deepEqual(a.payload.slice(0, 3), [[PLANTILLA], ['relay url', 'blossom url', 'seal url', 'confirmations'], ['http://127.0.0.1:8788/', 'https://archivos.ejemplo/', 'ftp://no-es-http', 6]]);
  assert.deepEqual([a.payload[3], a.payload[5]], [['vg'], [PLANTILLA]]);
  assert.ok(a.payload.length === 6 && a.payload.every((x) => Array.isArray(x) && x.length > 0 && x.every((v) => v !== '-' && v !== '')), 'ninguna posición vacía ni rellena');
  // Cambiar solo una: lo demás se conserva; vacío quita (un ajuste sin valor no se escribe); no dado conserva.
  const b = G.ajustesEditablesDe(PLANTILLA, c.eje, 'vg', { 'seal url': 'http://127.0.0.1:8787', 'blossom url': '' });
  assert.equal(b.cambiado, true);
  assert.deepEqual(b.payload.slice(0, 3), [[PLANTILLA], ['relay url', 'seal url', 'confirmations'], ['http://127.0.0.1:8788/', 'http://127.0.0.1:8787', 6]]);
  await salida.escribirDesde(c.eje, { modo: 'sequenced', autor: 'vg', sobre: b.sobre, en: b.en, payload: b.payload, t: T(2) }, c.cuenta.privada);
  assert.deepEqual(exterior.exterior(c.eje, 'vg'), { relevo: 'http://127.0.0.1:8788', archivos: null, sello: 'http://127.0.0.1:8787', guia: null, observadores: [], confirmaciones: 6 });
  assert.equal(G.ajustesEditablesDe(PLANTILLA, c.eje, 'vg', {}).cambiado, false, 'sin cambios, nada que escribir');
  // El registro es de configuración: no se manda a ninguna IA, como el de la guía.
  const id = contrato.configuracionDe(c.eje, 'vg', PLANTILLA).de;
  assert.ok(id);
  assert.equal(contrato.esDeConfiguracion(c.eje, id, { ajustes: [PLANTILLA] }), true);
  assert.equal(contrato.esDeConfiguracion(c.eje, id), false, 'sin decir qué plantillas de ajustes hay, solo las de la época');
  assert.deepEqual(contrato.validar(c.eje, id), [], 'el registro valida');
});

const CLAVE_A = 'a'.repeat(64);
const CLAVE_B = 'b1'.repeat(32);

test('observer keys, confirmations y guide url (claves de un registro de ajustes, #77): se escriben y se leen, con la lista como texto con espacios o como lista BTML; lo que no es una clave x-only se descarta', async () => {
  const c = await cuentaDeVg();
  const dado = CLAVE_A + ' ' + CLAVE_B.toUpperCase() + ' ' + CLAVE_A + ' no-es-clave';
  const a = await ajustarExterior(c, { 'observer keys': dado, confirmations: '12', 'guide url': 'http://127.0.0.1:8799/' });
  assert.deepEqual(a.payload.slice(1, 3), [['observer keys', 'confirmations', 'guide url'], [dado, 12, 'http://127.0.0.1:8799/']]);
  assert.deepEqual(exterior.exterior(c.eje, 'vg'), { relevo: null, archivos: null, sello: null, guia: 'http://127.0.0.1:8799', observadores: [CLAVE_A, CLAVE_B], confirmaciones: 12 });
  assert.deepEqual(contrato.validar(c.eje, contrato.configuracionDe(c.eje, 'vg', PLANTILLA).de), []);
  // Los textos del formulario, en los dos idiomas: en inglés (el canónico) la ayuda es la del propio registro de la plantilla.
  const ayudas = (idioma) => G.ajustesEditablesDe(PLANTILLA, c.eje, 'vg', {}, { idioma }).campos.map((x) => x.ayuda);
  assert.ok(ayudas('en').every((x) => /^[a-z]/.test(x) && x.length > 20), 'ayudas en inglés: ' + ayudas('en').join(' | '));
  assert.ok(ayudas('es').every((x) => x.length > 20));
  assert.notDeepEqual(ayudas('en'), ayudas('es'));
  // En el formulario se enseña como texto; sin cambios no hay nada que escribir.
  const f = G.ajustesEditablesDe(PLANTILLA, c.eje, 'vg', {});
  assert.equal(f.cambiado, false);
  assert.equal(f.campos.find((x) => x.clave === 'confirmations').valor, 12);
  // Vacío quita las claves y la guía (el ajuste no se escribe); una cifra que no es un número positivo conserva la actual.
  const b = G.ajustesEditablesDe(PLANTILLA, c.eje, 'vg', { 'observer keys': '', 'guide url': '', confirmations: 'muchas' });
  assert.deepEqual(b.payload.slice(1, 3), [['confirmations'], [12]]);
  await salida.escribirDesde(c.eje, { modo: 'sequenced', autor: 'vg', sobre: b.sobre, en: b.en, payload: b.payload, t: T(2) }, c.cuenta.privada);
  assert.deepEqual(exterior.exterior(c.eje, 'vg'), { relevo: null, archivos: null, sello: null, guia: null, observadores: [], confirmaciones: 12 });
  // Como una clave repetida (varias hojas, un valor por clave) también se lee.
  const l = G.ajustesEditablesDe(PLANTILLA, c.eje, 'vg', { 'observer keys': CLAVE_A });
  const lista = contrato.registroDeAjustes(PLANTILLA, { 'observer keys': [CLAVE_A, CLAVE_B], confirmations: 12 }, { quien: 'vg' });
  assert.deepEqual(lista.slice(1, 3), [['observer keys', 'observer keys', 'confirmations'], [CLAVE_A, CLAVE_B, 12]]);
  await salida.escribirDesde(c.eje, { modo: 'sequenced', autor: 'vg', sobre: l.sobre, en: l.en, payload: lista, t: T(3) }, c.cuenta.privada);
  assert.deepEqual(exterior.exterior(c.eje, 'vg').observadores, [CLAVE_A, CLAVE_B]);
});

test('la guía por «guide url»: sincronia.destinoDelLibro y la guía piden ahí (pasarela de AARPIA) y no en «sync url»; sin ella, como siempre', async () => {
  const c = await cuentaDeVg();
  await ajustarPreferencias(c, { 'sync url': ['http://127.0.0.1:8787'], 'sync ledger': ['eje'] });
  assert.equal(G.destinoDe(c.eje, 'vg').url, 'http://127.0.0.1:8787');
  await ajustarExterior(c, { 'guide url': 'http://127.0.0.1:8799/' });
  assert.deepEqual(sincronia.destinoDelLibro(c.eje, 'vg'), { url: 'http://127.0.0.1:8799', eje: 'eje' });
  assert.deepEqual(G.destinoDe(c.eje, 'vg'), { url: 'http://127.0.0.1:8799', eje: 'eje' });
  assert.equal(sincronia.destino(c.eje, 'vg').url, 'http://127.0.0.1:8787', 'el transporte no cambia');
  let pedido = null;
  const fetchFalso = async (url, init) => ((pedido = { url, init }), { ok: true, status: 200, json: async () => ({ texto: 'hola', uso: { entrada: 1, salida: 1 } }) });
  const r = await G.preguntar({ via: 'server', url: G.destinoDe(c.eje, 'vg').url, ejeCompartido: 'eje', claveLectura: 'clave', modelo: 'm', instrucciones: '', contexto: '', historial: [], pregunta: 'hola', maximo: 5, fetch: fetchFalso });
  assert.equal(r.ok, true);
  assert.equal(pedido.url, 'http://127.0.0.1:8799/guia');
});

test('el destino del transporte y de los archivos: «relay url» y «blossom url» mandan sobre «sync url»; el eje y la clave son los mismos; la guía sigue en «sync url»; sin «sync url» basta el relé', async () => {
  const c = await cuentaDeVg();
  const URL_SYNC = 'http://127.0.0.1:8787';
  const SYNC = { 'sync url': [URL_SYNC], 'sync ledger': ['eje'] };
  await ajustarPreferencias(c, SYNC);
  assert.deepEqual(sincronia.destino(c.eje, 'vg'), { url: URL_SYNC, eje: 'eje' }, 'sin ajustes del exterior, como siempre');
  assert.deepEqual(sincronia.destinoDeArchivos(c.eje, 'vg'), { url: URL_SYNC, eje: 'eje' });
  assert.deepEqual(destinoDe(c.eje, 'vg', 'clave'), { url: URL_SYNC, eje: 'eje', claveLectura: 'clave' });
  assert.equal(destinoDe(c.eje, 'vg', ''), null, 'sin clave de lectura no hay archivos');
  assert.equal(sello.deConfiguracion(c.eje, 'vg'), null, 'sin «seal url», nada se sella');

  await ajustarExterior(c, { 'relay url': 'http://127.0.0.1:8788', 'blossom url': 'http://127.0.0.1:8789', 'seal url': 'http://127.0.0.1:8790' });
  assert.deepEqual(sincronia.destino(c.eje, 'vg'), { url: 'http://127.0.0.1:8788', eje: 'eje' }, 'el transporte (eventos y recibo) por el relé');
  assert.deepEqual(sincronia.destinoDeArchivos(c.eje, 'vg'), { url: 'http://127.0.0.1:8789', eje: 'eje' }, 'los archivos por blossom');
  assert.deepEqual(destinoDe(c.eje, 'vg', 'clave'), { url: 'http://127.0.0.1:8789', eje: 'eje', claveLectura: 'clave' });
  assert.deepEqual(sincronia.destinoDelLibro(c.eje, 'vg'), { url: URL_SYNC, eje: 'eje' }, 'la guía (ruta /guia) sigue en sync url mientras no haya «guide url»');
  assert.equal(G.destinoDe(c.eje, 'vg').url, URL_SYNC);
  assert.equal(sello.destino(c.eje, 'vg'), 'http://127.0.0.1:8790');
  assert.equal(sello.deConfiguracion(c.eje, 'vg').via, 'http');
  assert.equal(sello.deConfiguracion(c.eje, 'vg').url, 'http://127.0.0.1:8790');

  // Sin «relay url», el transporte sigue a «sync url»; solo los archivos van por blossom.
  const d = await cuentaDeVg();
  await ajustarPreferencias(d, SYNC);
  await ajustarExterior(d, { 'blossom url': 'http://127.0.0.1:8789' });
  assert.equal(sincronia.destino(d.eje, 'vg').url, URL_SYNC);
  assert.equal(sincronia.destinoDeArchivos(d.eje, 'vg').url, 'http://127.0.0.1:8789');

  // Sin «sync url» pero con relé: falta el eje compartido; con él, basta el relé.
  const e = await cuentaDeVg();
  await ajustarExterior(e, { 'relay url': 'http://127.0.0.1:8788' });
  assert.equal(sincronia.destino(e.eje, 'vg'), null, 'sin «sync ledger» no hay eje compartido');
  await ajustarPreferencias(e, { 'sync ledger': ['eje'] }, 2);
  assert.deepEqual(sincronia.destino(e.eje, 'vg'), { url: 'http://127.0.0.1:8788', eje: 'eje' });
  assert.equal(sincronia.destinoDeArchivos(e.eje, 'vg'), null, 'los archivos no tienen ni «blossom url» ni «sync url»');
  assert.equal(sincronia.destinoDelLibro(e.eje, 'vg'), null);
});

test('verificado(eje, id): { ok, sello, recibo, relojes, altura, profundidad, enFirme, pendiente }; ok = «sealed» y «received» (si el transporte da recibos) verdaderos y los tres relojes en orden; se expone en leer del 5', async () => {
  const { cuenta, eje } = await cuentaDeVg();
  const e1 = await eje.escribir({ autor: 'vg', sobre: eje.genesisId, t: T(1), movimientos: [minuto('vg')], payload: ['uno'] }, cuenta.privada);
  const e2 = await eje.escribir({ autor: 'vg', sobre: e1.id, t: T(2), movimientos: [minuto('vg')], payload: ['dos'] }, cuenta.privada);
  // La cuenta raíz declara la clave de su observador de cabeceras (de prueba): con ella verifica la regla «sealed».
  const obs = await observadorDePrueba();
  const rele = await releDePrueba();
  await ajustarExterior({ cuenta, eje }, { 'observer keys': obs.publica }, 3);
  assert.equal(contrato.verificado(eje, 'no existe'), null);
  assert.deepEqual(sinPendiente(contrato.verificado(eje, e1.id)), { ok: false, sello: false, recibo: null, relojes: true, pago: null, altura: null, profundidad: null, enFirme: false }, 'sin transporte ni sello: el recibo no se exige, pero sin sello no hay verificado');
  assert.deepEqual(faltan(contrato.verificado(eje, e1.id)), ['sello'], 'sin sello, la regla «sealed» queda pendiente: falta el dato');
  assert.deepEqual(sinPendiente(contrato.leer(eje, e1.id, 5).verificado), { ok: false, sello: false, recibo: null, relojes: true, pago: null, altura: null, profundidad: null, enFirme: false }, 'en leer del 5');
  assert.equal(contrato.leer(eje, e1.id, 1).verificado, undefined, 'solo en el 5');
  assert.equal(contrato.leerRuta(eje, e1.id, [5]).verificado.ok, false);

  // Un sello en un bloque sin la prueba copiada no basta, aunque el adaptador lo diera por bueno: lo dice la regla.
  const completo = await selloCompleto(e1.id, { altura: 3, instante: '2026-11-10T11:00:00.000Z', observador: obs });
  const { decupla, ...sinPrueba } = completo;
  eje.marcarSello(e1.id, sinPrueba);
  assert.deepEqual([contrato.verificado(eje, e1.id).sello, contrato.verificado(eje, e1.id).ok, faltan(contrato.verificado(eje, e1.id))], [false, false, ['sello']]);
  // La misma altura y el mismo hash, ahora con la prueba: la décupla se añade al sello que ya estaba.
  assert.ok(decupla);
  eje.marcarSello(e1.id, completo);
  assert.deepEqual(contrato.verificado(eje, e1.id), { ok: true, sello: true, recibo: null, relojes: true, pago: null, altura: 3, profundidad: 1, enFirme: false, pendiente: [], pendienteDeSello: false }, 'sello con su prueba y ningún recibo en el eje: el transporte no los da, no se exigen');

  // El transporte da recibos (a e2, no a e1): ahora se exige el de cada uno.
  eje.marcarRecibo(e2.id, reciboFirmado(rele, { instante: '2026-11-10T10:03:00.000Z' }));
  assert.deepEqual(contrato.verificado(eje, e1.id), { ok: false, sello: true, recibo: false, relojes: true, pago: null, altura: 3, profundidad: 1, enFirme: false, pendiente: [], pendienteDeSello: false }, 'el transporte los da y a este no');
  assert.equal(contrato.verificado(eje, e2.id).recibo, true);
  assert.equal(contrato.verificado(eje, e2.id).ok, false, 'e2 tiene recibo pero no sello');
  eje.marcarRecibo(e1.id, reciboFirmado(rele, { instante: '2026-11-10T10:02:00.000Z' }));
  assert.deepEqual(contrato.verificado(eje, e1.id), { ok: true, sello: true, recibo: true, relojes: true, pago: null, altura: 3, profundidad: 1, enFirme: false, pendiente: [], pendienteDeSello: false });
  assert.equal(contrato.leer(eje, e1.id, 5).verificado.ok, true);

  // Relojes fuera de orden («clocks out of order»): el bloque va antes que el t del libro más del margen (epoch.7.3.1).
  eje.marcarSello(e2.id, await selloCompleto(e2.id, { altura: 1, instante: '2026-11-10T07:00:00.000Z', observador: obs }));
  assert.equal(contrato.relojesFueraDeOrden(eje, e2.id), true);
  assert.deepEqual(contrato.verificado(eje, e2.id), { ok: false, sello: true, recibo: true, relojes: false, pago: null, altura: 1, profundidad: 3, enFirme: false, pendiente: [], pendienteDeSello: false }, 'la altura conocida es la del último sello (3): e2, sellado en 1, tiene 3 confirmaciones');
});

test('profundidad y «en firme»: (altura del último sello verificado conocido − la de su bloque + 1) contra las «confirmations» de la cuenta RAÍZ del eje, no de quien escribe', async () => {
  const { cuenta, eje } = await cuentaDeVg();
  const e1 = await eje.escribir({ autor: 'vg', sobre: eje.genesisId, t: T(1), movimientos: [minuto('vg')], payload: ['uno'] }, cuenta.privada);
  const e2 = await eje.escribir({ autor: 'vg', sobre: e1.id, t: T(2), movimientos: [minuto('vg')], payload: ['dos'] }, cuenta.privada);
  const e3 = await eje.escribir({ autor: 'vg', sobre: e2.id, t: T(3), movimientos: [minuto('vg')], payload: ['tres'] }, cuenta.privada);
  const obs = await observadorDePrueba();
  await ajustarExterior({ cuenta, eje }, { 'observer keys': obs.publica }, 4);
  // Sellos con su prueba copiada (la regla «sealed» verdadera); `verificado`, lo que dijo el adaptador (la cota de alturas).
  const marcar = async (id, altura, verificado = true) => eje.marcarSello(id, { ...(await selloCompleto(id, { altura, instante: '2099-01-01T00:00:00.000Z', observador: obs })), verificado });
  const de = (id) => { const v = contrato.verificado(eje, id); return [v.altura, v.profundidad, v.enFirme]; };
  assert.equal(eje.alturaConocida, null);
  await marcar(e1.id, 100);
  assert.equal(eje.alturaConocida, 100);
  assert.deepEqual(de(e1.id), [100, 1, false], 'recién minado: 1 confirmación');
  await marcar(e2.id, 104, false);
  assert.equal(eje.alturaConocida, 100, 'un sello sin comprobar no alarga la profundidad de nadie');
  await marcar(e2.id, 104);
  assert.equal(eje.alturaConocida, 104);
  assert.deepEqual(de(e1.id), [100, 5, false], '104 − 100 + 1: faltan confirmaciones (el defecto es 6)');
  assert.deepEqual(de(e2.id), [104, 1, false]);
  assert.deepEqual(de(e3.id), [null, null, false], 'sin sello no hay altura ni profundidad');
  // El último sello conocido puede ser de otro registro: sube la profundidad de todos.
  await marcar(e3.id, 105);
  assert.deepEqual(de(e1.id), [100, 6, true], '105 − 100 + 1 = 6');
  assert.equal(de(e2.id)[2], false);
  // Las confirmaciones que cuentan son las de la cuenta raíz del eje (la del génesis), con sus defectos si no hay registro.
  assert.deepEqual(exterior.ajustesDelEje(eje), { relevo: null, archivos: null, sello: null, guia: null, observadores: [obs.publica], confirmaciones: 6 });
  await ajustarExterior({ cuenta, eje }, { confirmations: '3', 'observer keys': obs.publica + ' ' + CLAVE_A }, 5);
  assert.deepEqual(exterior.ajustesDelEje(eje).observadores, [obs.publica, CLAVE_A]);
  assert.equal(exterior.ajustesDelEje(eje).confirmaciones, 3);
  assert.equal(de(e2.id)[1], 2, '105 − 104 + 1');
  assert.equal(de(e2.id)[2], false, '2 < 3');
  assert.equal(de(e1.id)[2], true);
});

test('en la carta, «verificado» es una marca discreta: en el reverso (cara 5) y en la celda de la matriz del 4, solo si lo está; la configuración trae el desplegable del exterior', async () => {
  const { eje, compra, ...resto } = await ejemploCompra();
  await ejemploFabrica(eje, { compra, ...resto }); // las ejecuciones de la matriz del 4 (pagar, servir…)
  // La cuenta raíz (casa) declara su observador de cabeceras: los sellos con su prueba copiada pasan la regla «sealed».
  const obs = await observadorDePrueba();
  await declararExterior(eje, { observadores: [obs.publica] });
  const sellar = async (id, altura) => eje.marcarSello(id, await selloCompleto(id, { altura, instante: '2099-01-01T00:00:00.000Z', observador: obs }));
  const arbol = (estado, medidas) => arbolEnIdioma(estado, eje, 'huesped', medidas, { idioma: 'es' });
  const ORDENADOR = { ancho: 1920, alto: 1080 };
  // Sin sello: ninguna marca.
  const sin = await arbol({ foco: { X: compra.id, pv: 4 } }, ORDENADOR);
  const celdas = (a) => a.centro.rejilla.celdas.flatMap((c) => c.ocupantes ?? []).filter((o) => o.X);
  assert.ok(celdas(sin).length > 0, 'la compra tiene ejecuciones en la matriz del 4');
  assert.ok(celdas(sin).every((o) => !o.verificado));
  assert.doesNotMatch(html(sin), /class="verificado"/);

  // Verificar una ejecución de la matriz (sello y relojes en orden; el eje no tiene recibos de transporte): la celda la marca.
  const X = celdas(sin)[0].X;
  await sellar(X, 1);
  const con = await arbol({ foco: { X: compra.id, pv: 4 } }, ORDENADOR);
  assert.deepEqual(celdas(con).filter((o) => o.verificado).map((o) => o.X), [X]);
  assert.match(html(con), /<small class="verificado" data-confirmaciones="1" title="verificado: su sello de tiempo[^"]*">◆ verificado · 1 confirmación<\/small>/, 'con la altura del sello conocida, la profundidad: recién minado, 1 confirmación');
  assert.equal(celdas(con).find((o) => o.X === X).confirmaciones, 1);
  assert.equal((html(con).match(/class="verificado"/g) ?? []).length, 1, 'una sola marca, la de esa ejecución');

  // El reverso del propio registro: la marca va debajo del ancla.
  assert.equal((await arbol({ foco: { X: compra.id, pv: 5 } }, ORDENADOR)).centro.verificado, undefined);
  await sellar(compra.id, 1);
  const reverso = await arbol({ foco: { X: compra.id, pv: 5 } }, ORDENADOR);
  assert.equal(reverso.centro.cara, 'reverso');
  assert.equal(reverso.centro.verificado, true);
  assert.equal(reverso.centro.confirmaciones, 1);
  assert.match(html(reverso), /class="verificado-linea"><small class="verificado" data-confirmaciones="1"[^>]*>◆ verificado · 1 confirmación<\/small>/);

  // Pasan los bloques: el último sello conocido sube la profundidad («verificado · N confirmaciones») y, con las 6 de los ajustes del eje, «en firme».
  const otro = celdas(sin).find((o) => o.X !== X).X;
  await sellar(otro, 3);
  const tres = await arbol({ foco: { X: compra.id, pv: 5 } }, ORDENADOR);
  assert.equal(tres.centro.confirmaciones, 3, '3 − 1 + 1');
  assert.equal(tres.centro.enFirme, undefined);
  assert.match(html(tres), /class="verificado-linea"><small class="verificado" data-confirmaciones="3"[^>]*>◆ verificado · 3 confirmaciones<\/small>/);
  const ultimo = celdas(sin).find((o) => o.X !== X && o.X !== otro).X;
  await sellar(ultimo, 6);
  const firme = await arbol({ foco: { X: compra.id, pv: 5 } }, ORDENADOR);
  assert.deepEqual([firme.centro.confirmaciones, firme.centro.enFirme, firme.centro.minimas], [6, true, 6], '6 − 1 + 1');
  assert.match(html(firme), /class="verificado-linea"><small class="verificado" data-en-firme data-confirmaciones="6" title="en firme: [^"]*\(6 de 6;[^"]*">◆ en firme<\/small>/);
  assert.doesNotMatch(html(firme), /verificado · \d/, 'en firme sustituye a «N confirmaciones»');
  // La celda de la matriz del 4 dice lo mismo de cada ejecución.
  const matriz = html(await arbol({ foco: { X: compra.id, pv: 4 } }, ORDENADOR));
  assert.match(matriz, /data-en-firme data-confirmaciones="6"[^>]*>◆ en firme<\//);
  assert.match(matriz, /data-confirmaciones="4"[^>]*>◆ verificado · 4 confirmaciones<\//, 'la de altura 3: 6 − 3 + 1');

  // La configuración: el desplegable de los ajustes del exterior, con sus campos (sin `name`: la app los escribe como su registro).
  const form = htmlConfiguracion(preferencias(eje, 'huesped'), { exterior: G.ajustesEditablesDe(PLANTILLA, eje, 'huesped', {}, { idioma: 'es' }) });
  assert.match(form, new RegExp('<details class="exterior-ajustes"[^>]*><summary>' + t('exteriorAjustes') + '</summary>'));
  for (const clave of ['relay url', 'blossom url', 'seal url']) assert.match(form, new RegExp('data-exterior-campo="' + clave + '"'));
  assert.doesNotMatch(form, /name="relay url"/);
  assert.match(form, />relé<\/label>/);
  assert.equal(htmlConfiguracion(preferencias(eje, 'huesped'), {}).includes('exterior-ajustes'), false, 'sin plantilla de exterior, nada');
  // Y por la pantalla entera (html con lo que la app sabe): la configuración abierta lleva el desplegable.
  const entera = html(await arbol({ foco: { X: compra.id, pv: 0 } }, ORDENADOR), { preferencias: preferencias(eje, 'huesped'), exteriorAjustes: G.ajustesEditablesDe(PLANTILLA, eje, 'huesped', {}, { idioma: 'es' }) });
  assert.match(entera, /data-exterior-campo="seal url"/);
});
