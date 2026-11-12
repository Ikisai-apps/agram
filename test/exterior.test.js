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

const T = (m) => '2026-11-10T10:' + String(m).padStart(2, '0') + ':00Z';
const minuto = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
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

test('la plantilla «exterior settings» es de la época (9.2.5): relé, archivos, sello (y la reserva de pagos), sin valor por defecto, con su texto en es y su canónico en en', () => {
  assert.deepEqual(contrato.plantillas(null).map((p) => p.nombre), ['purchase', 'booking', 'guide settings', 'opinion', PLANTILLA, 'preferences']);
  assert.equal(contrato.plantillas(null).find((p) => p.nombre === PLANTILLA).donde, '9250000000');
  assert.deepEqual(contrato.clavesDeConfiguracionDe(PLANTILLA).map((c) => [c.pv, c.clave, c.defecto]), [
    [1, 'relay url', undefined], [2, 'blossom url', undefined], [3, 'seal url', undefined], [4, 'pay url', undefined],
  ]);
  assert.deepEqual(contrato.configuracionDe(null, 'vg', PLANTILLA), { de: null }, 'sin registro, sin url: nada va por fuera');
  const etiqueta = (clave, idioma) => contrato.texto(null, contrato.claves.parametro(PLANTILLA, clave, 'label'), idioma, { original: clave });
  assert.deepEqual(['relay url', 'blossom url', 'seal url'].map((c) => etiqueta(c, 'en')), ['relay url', 'blossom url', 'seal url']);
  assert.deepEqual(['relay url', 'blossom url', 'seal url'].map((c) => etiqueta(c, 'es')), ['relé', 'archivos', 'sello']);
  assert.equal(contrato.texto(null, contrato.claves.plantilla(PLANTILLA), 'es', { original: PLANTILLA }), 'ajustes del exterior');
  assert.match(contrato.texto(null, contrato.claves.parametro(PLANTILLA, 'seal url', 'help'), 'es', { original: '' }), /sello de tiempo/);
});

test('exterior(): las tres url de mi registro (http o https, sin la barra final); lo que no es una url, vacío y «-» no cuentan; el último registro manda', async () => {
  const c = await cuentaDeVg();
  assert.deepEqual(exterior.exterior(c.eje, 'vg'), { relevo: null, archivos: null, sello: null });
  const a = await ajustarExterior(c, { 'relay url': 'http://127.0.0.1:8788/', 'blossom url': 'https://archivos.ejemplo/', 'seal url': 'ftp://no-es-http' });
  assert.deepEqual(a.campos.map((x) => x.clave), ['relay url', 'blossom url', 'seal url', 'pay url']);
  assert.deepEqual(exterior.exterior(c.eje, 'vg'), { relevo: 'http://127.0.0.1:8788', archivos: 'https://archivos.ejemplo', sello: null });
  // Cambiar solo una: lo demás se conserva; «-» quita; vacío conserva.
  const b = G.ajustesEditablesDe(PLANTILLA, c.eje, 'vg', { 'seal url': 'http://127.0.0.1:8787', 'blossom url': '-', 'relay url': '' });
  assert.equal(b.cambiado, true);
  await salida.escribirDesde(c.eje, { modo: 'sequenced', autor: 'vg', sobre: b.sobre, en: b.en, payload: b.payload, t: T(2) }, c.cuenta.privada);
  assert.deepEqual(exterior.exterior(c.eje, 'vg'), { relevo: 'http://127.0.0.1:8788', archivos: null, sello: 'http://127.0.0.1:8787' });
  assert.equal(G.ajustesEditablesDe(PLANTILLA, c.eje, 'vg', {}).cambiado, false, 'sin cambios, nada que escribir');
  // El registro es de configuración: no se manda a ninguna IA, como el de la guía.
  const id = contrato.configuracionDe(c.eje, 'vg', PLANTILLA).de;
  assert.ok(id);
  assert.equal(contrato.esDeConfiguracion(c.eje, id, { ajustes: [PLANTILLA] }), true);
  assert.equal(contrato.esDeConfiguracion(c.eje, id), false, 'sin decir qué plantillas de ajustes hay, solo las de la época');
  assert.deepEqual(contrato.validar(c.eje, id), [], 'el registro valida');
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
  assert.deepEqual(sincronia.destinoDelLibro(c.eje, 'vg'), { url: URL_SYNC, eje: 'eje' }, 'la guía (ruta /guia) sigue en sync url');
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

test('verificado(eje, id): { ok, sello, recibo, relojes }; ok = sello verificado y recibo (si el transporte los da) y los tres relojes en orden; se expone en leer del 5', async () => {
  const { cuenta, eje } = await cuentaDeVg();
  const e1 = await eje.escribir({ autor: 'vg', sobre: eje.genesisId, t: T(1), movimientos: [minuto('vg')], payload: ['uno'] }, cuenta.privada);
  const e2 = await eje.escribir({ autor: 'vg', sobre: e1.id, t: T(2), movimientos: [minuto('vg')], payload: ['dos'] }, cuenta.privada);
  assert.equal(contrato.verificado(eje, 'no existe'), null);
  assert.deepEqual(contrato.verificado(eje, e1.id), { ok: false, sello: false, recibo: null, relojes: true }, 'sin transporte ni sello: el recibo no se exige, pero sin sello no hay verificado');
  assert.deepEqual(contrato.leer(eje, e1.id, 5).verificado, { ok: false, sello: false, recibo: null, relojes: true }, 'en leer del 5');
  assert.equal(contrato.leer(eje, e1.id, 1).verificado, undefined, 'solo en el 5');
  assert.equal(contrato.leerRuta(eje, e1.id, [5]).verificado.ok, false);

  // Un sello en un bloque pero no comprobado (`verificado` falso) no basta.
  eje.marcarSello(e1.id, { altura: 3, hash: 'a'.repeat(64), instante: '2026-11-10T11:00:00.000Z', verificado: false });
  assert.equal(contrato.verificado(eje, e1.id).sello, false);
  assert.equal(contrato.verificado(eje, e1.id).ok, false);
  eje.marcarSello(e1.id, { altura: 3, hash: 'a'.repeat(64), instante: '2026-11-10T11:00:00.000Z', verificado: true });
  assert.deepEqual(contrato.verificado(eje, e1.id), { ok: true, sello: true, recibo: null, relojes: true }, 'sello verificado y ningún recibo en el eje: el transporte no los da, no se exigen');

  // El transporte da recibos (a e2, no a e1): ahora se exige el de cada uno.
  eje.marcarRecibo(e2.id, { instante: '2026-11-10T10:03:00.000Z', rele: 'b'.repeat(64), firma: 'c'.repeat(128) });
  assert.deepEqual(contrato.verificado(eje, e1.id), { ok: false, sello: true, recibo: false, relojes: true }, 'el transporte los da y a este no');
  assert.equal(contrato.verificado(eje, e2.id).recibo, true);
  assert.equal(contrato.verificado(eje, e2.id).ok, false, 'e2 tiene recibo pero no sello');
  eje.marcarRecibo(e1.id, { instante: '2026-11-10T10:02:00.000Z', rele: 'b'.repeat(64), firma: 'c'.repeat(128) });
  assert.deepEqual(contrato.verificado(eje, e1.id), { ok: true, sello: true, recibo: true, relojes: true });
  assert.equal(contrato.leer(eje, e1.id, 5).verificado.ok, true);

  // Relojes fuera de orden («clocks out of order»): el bloque va antes que el t del libro más del margen (epoch.7.3.1).
  eje.marcarSello(e2.id, { altura: 1, hash: 'd'.repeat(64), instante: '2026-11-10T07:00:00.000Z', verificado: true });
  assert.equal(contrato.relojesFueraDeOrden(eje, e2.id), true);
  assert.deepEqual(contrato.verificado(eje, e2.id), { ok: false, sello: true, recibo: true, relojes: false });
});

test('en la carta, «verificado» es una marca discreta: en el reverso (cara 5) y en la celda de la matriz del 4, solo si lo está; la configuración trae el desplegable del exterior', async () => {
  const { eje, compra, ...resto } = await ejemploCompra();
  await ejemploFabrica(eje, { compra, ...resto }); // las ejecuciones de la matriz del 4 (pagar, servir…)
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
  eje.marcarSello(X, { altura: 1, hash: 'a'.repeat(64), instante: '2099-01-01T00:00:00.000Z', verificado: true });
  const con = await arbol({ foco: { X: compra.id, pv: 4 } }, ORDENADOR);
  assert.deepEqual(celdas(con).filter((o) => o.verificado).map((o) => o.X), [X]);
  assert.match(html(con), /<small class="verificado" title="verificado: su sello de tiempo/);
  assert.equal((html(con).match(/class="verificado"/g) ?? []).length, 1, 'una sola marca, la de esa ejecución');

  // El reverso del propio registro: la marca va debajo del ancla.
  assert.equal((await arbol({ foco: { X: compra.id, pv: 5 } }, ORDENADOR)).centro.verificado, undefined);
  eje.marcarSello(compra.id, { altura: 1, hash: 'b'.repeat(64), instante: '2099-01-01T00:00:00.000Z', verificado: true });
  const reverso = await arbol({ foco: { X: compra.id, pv: 5 } }, ORDENADOR);
  assert.equal(reverso.centro.cara, 'reverso');
  assert.equal(reverso.centro.verificado, true);
  assert.match(html(reverso), /class="verificado-linea"><small class="verificado"[^>]*>◆ verificado<\/small>/);

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
