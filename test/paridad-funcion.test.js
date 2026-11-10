// Paridad entre la función de Supabase (servidor/supabase/funciones/eventos/verificar.js, JavaScript puro que Deno
// ejecuta tal cual, sin el núcleo) y el núcleo (src/evento.js, src/autoridad.js): el JSON canónico, el hash, la copia
// normalizada, la firma y la comprobación entera del servidor dan lo mismo caso a caso. La función no corre en CI
// (no hay Deno): esto es lo que garantiza que decide igual que el servidor de prueba.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as funcion from '../servidor/supabase/funciones/eventos/verificar.js';
import * as criptoNucleo from '../servidor/prueba/cripto-nucleo.mjs';
import { crearApi } from '../servidor/supabase/funciones/eventos/api.js';
import { almacenEnMemoria } from '../servidor/prueba/servidor.mjs';
import { canonico, cuerpo, hash, normalizarEvento, crearEvento } from '../src/evento.js';
import { generarClaves, firmar, verificar, firmarPosesion } from '../src/autoridad.js';
import { Eje } from '../src/eje.js';

const T = '2026-11-10T09:00:00Z';
const minuto = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

test('canónico y hash: los mismos bytes para valores con claves desordenadas, undefined, unicode, números y toJSON', async () => {
  const casos = [
    { b: 1, a: [3, { z: null, y: 'ñ' }], c: undefined },
    [undefined, 1, () => 1, 'texto'],
    { fecha: new Date('2026-11-10T00:00:00Z'), n: -0, m: 1e21, k: 0.1 + 0.2 },
    'una cadena con "comillas" y \\ y  ',
    null,
    { anidado: { profundo: { x: [1, [2, [3]]] } }, '': 'clave vacía' },
  ];
  for (const c of casos) {
    assert.equal(funcion.canonico(c), canonico(c));
    assert.equal(await funcion.hash(funcion.canonico(c)), await hash(canonico(c)));
  }
  assert.throws(() => funcion.canonico({ n: 1n }));
  assert.throws(() => canonico({ n: 1n }));
});

test('cuerpo y normalizar: la misma copia que el núcleo (en y contexto por defecto, lo de más fuera, el mismo orden de campos)', async () => {
  const claves = await generarClaves();
  const ev = await firmar(await crearEvento({ autor: 'vg', sobre: null, t: T, movimientos: [], payload: ['x'], contexto: { genesis: true, claves: { vg: claves.publica } } }), claves.privada);
  const conPosesion = await firmarPosesion(ev, 'vg', claves.privada);
  const crudo = { ...conPosesion, extra: 'fuera', en: undefined, contexto: undefined, otra: { cosa: 1 } };
  assert.deepEqual(funcion.normalizar(crudo), JSON.parse(JSON.stringify(normalizarEvento(crudo))));
  assert.deepEqual(Object.keys(funcion.normalizar(crudo)), Object.keys(normalizarEvento(crudo)));
  assert.deepEqual(funcion.cuerpo(crudo), cuerpo(crudo));
  assert.equal(funcion.canonico(funcion.cuerpo(crudo)), canonico(cuerpo(crudo)));
  assert.equal(await funcion.verificarId(ev), true);
  assert.equal(await funcion.verificarId({ ...ev, payload: ['y'] }), false);
  assert.equal(funcion.normalizar('texto'), null);
  assert.equal(funcion.normalizar(null), null);
});

test('la firma: verifica lo que el núcleo firma y rechaza lo mismo que el núcleo (relleno, bits sobrantes, otra clave, id raro)', async () => {
  const claves = await generarClaves();
  const otras = await generarClaves();
  const ev = await firmar(await crearEvento({ autor: 'vg', sobre: null, t: T, movimientos: [], payload: ['x'], contexto: { genesis: true } }), claves.privada);
  const casos = [
    [ev.firma, ev.id, claves.publica],
    [ev.firma, ev.id, otras.publica],
    [ev.firma + '=', ev.id, claves.publica],
    [ev.firma.replace(/-/g, '+'), ev.id, claves.publica],
    [ev.firma.slice(0, -1) + (ev.firma.endsWith('A') ? 'B' : 'A'), ev.id, claves.publica],
    ['', ev.id, claves.publica],
    [ev.firma, 'nohex', claves.publica],
    [ev.firma, ev.id, { kty: 'EC', crv: 'P-256', x: 'AAAA', y: 'BBBB' }],
    [ev.firma, ev.id, { ...claves.publica, d: 'privada' }],
  ];
  for (const [firma, id, jwk] of casos) {
    const nucleo = await verificar({ firma, id }, jwk);
    assert.equal(await funcion.verificarFirma(firma, id, jwk), nucleo, 'caso ' + JSON.stringify([firma.slice(0, 6), id.slice(0, 6), Object.keys(jwk)]));
  }
  assert.equal(await funcion.verificarFirma(ev.firma, ev.id, claves.publica), true);
  assert.equal(await funcion.verificarFirma(ev.firma, ev.id, null), false);
  assert.equal(funcion.esClavePublica({ ...claves.publica, d: 'x' }), false);
  assert.equal(funcion.esClavePublica(claves.publica), true);
});

/** Los casos que el servidor decide: el mismo evento ante un eje vacío o con el alta de vg. */
async function casosDelServidor() {
  const claves = await generarClaves();
  const otras = await generarClaves();
  const eje = await Eje.genesis({ identidad: 'vg', foco: ['p'], t: T, clave: claves.publica, privada: claves.privada, exigirFirmas: true });
  const g = eje.obtener(eje.genesisId);
  const e1 = await eje.escribir({ autor: 'vg', sobre: g.id, t: '2026-11-10T09:01:00Z', movimientos: [minuto('vg')], payload: ['uno'] }, claves.privada);
  const demo = await Eje.genesis({ identidad: 'vg', foco: ['demo'], t: T, demostracion: true });
  const sinFirma = await crearEvento({ autor: 'vg', sobre: g.id, t: T, movimientos: [minuto('vg')], payload: ['sin firma'] });
  const extrano = await firmar(await crearEvento({ autor: 'otro', sobre: g.id, t: T, movimientos: [minuto('otro')], payload: ['hola'] }), otras.privada);
  const suplantado = await firmar(await crearEvento({ autor: 'vg', sobre: g.id, t: T, movimientos: [minuto('vg')], payload: ['soy vg'] }), otras.privada);
  const ciclico = { autor: 'vg' };
  ciclico.yo = ciclico;
  const eventos = {
    genesis: g, e1, genesisDemo: demo.obtener(demo.genesisId), sinFirma, extrano, suplantado, ciclico,
    idTocado: { ...e1, id: 'f'.repeat(64) },
    cuerpoTocado: { ...e1, payload: ['dos'] },
    firmaTocada: { ...e1, firma: e1.firma.slice(0, -2) + 'zz' },
    firmanteOtro: { ...e1, firmante: 'otro' },
    sinAutor: { ...e1, autor: undefined },
    texto: 'no soy un evento',
    nada: null,
    enRaro: { ...e1, en: '12' },
    posesionRara: { ...e1, posesion: { vg: 7 } },
  };
  return { eventos, claves };
}

test('comprobar: la función y el núcleo deciden lo mismo (estado y motivo) en todos los casos, con el eje vacío y con alta', async () => {
  const { eventos, claves } = await casosDelServidor();
  const claveDelAutor = async (autor) => (autor === 'vg' ? claves.publica : undefined);
  for (const [nombre, ev] of Object.entries(eventos)) {
    for (const vacio of [true, false]) {
      const a = await funcion.comprobar(ev, { vacio, claveDelAutor });
      const b = await criptoNucleo.comprobar(ev, { vacio, claveDelAutor });
      assert.deepEqual(a, JSON.parse(JSON.stringify(b)), nombre + (vacio ? ' (vacío)' : ' (con alta)'));
    }
  }
  // Y lo que deciden es lo esperado.
  const estado = async (ev, vacio) => (await funcion.comprobar(ev, { vacio, claveDelAutor })).estado ?? 'ok';
  assert.deepEqual(
    await Promise.all([estado(eventos.genesis, true), estado(eventos.genesis, false), estado(eventos.e1, true), estado(eventos.e1, false), estado(eventos.genesisDemo, true), estado(eventos.extrano, false), estado(eventos.suplantado, false), estado(eventos.ciclico, false), estado(eventos.sinFirma, false), estado(eventos.cuerpoTocado, false), estado(eventos.firmaTocada, false), estado(eventos.texto, false)]),
    ['ok', 400, 400, 'ok', 400, 403, 400, 400, 400, 400, 400, 400],
  );
});

test('el contrato entero con las dos criptografías: las mismas respuestas a la misma secuencia de peticiones', async () => {
  const { eventos } = await casosDelServidor();
  const ahora = () => new Date('2026-11-10T12:00:00Z');
  const apis = [funcion, criptoNucleo].map((cripto) => crearApi({ almacen: almacenEnMemoria({ ahora }), cripto, crearEjes: { secreto: 's' }, ahora }));
  const pedir = async (api, metodo, camino, cuerpo, cabeceras = {}) => {
    const r = await api(new Request('http://x' + camino, { method: metodo, headers: { 'Content-Type': 'application/json', ...cabeceras }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) }));
    return { estado: r.status, cuerpo: await r.json() };
  };
  const claves = await Promise.all(apis.map(async (api) => (await pedir(api, 'POST', '/ejes', { eje: 'par' }, { 'X-Crear-Ejes': 's' })).cuerpo.claveLectura));
  const secuencia = [
    ['POST', '/eventos', (ev) => ({ eje: 'par', evento: ev.e1 })],
    ['POST', '/eventos', (ev) => ({ eje: 'par', evento: ev.genesisDemo })],
    ['POST', '/eventos', (ev) => ({ eje: 'par', evento: ev.genesis })],
    ['POST', '/eventos', (ev) => ({ eje: 'par', evento: ev.genesis })],
    ['POST', '/eventos', (ev) => ({ eje: 'par', evento: ev.extrano })],
    ['POST', '/eventos', (ev) => ({ eje: 'par', evento: ev.suplantado })],
    ['POST', '/eventos', (ev) => ({ eje: 'par', evento: ev.firmaTocada })],
    ['POST', '/eventos', (ev) => ({ eje: 'par', evento: ev.cuerpoTocado })],
    ['POST', '/eventos', (ev) => ({ eje: 'par', evento: ev.sinFirma })],
    ['POST', '/eventos', (ev) => ({ eje: 'par', evento: ev.e1 })],
    ['POST', '/eventos', (ev) => ({ eje: 'par', evento: ev.e1 })],
    ['POST', '/eventos', (ev) => ({ eje: 'par', evento: ev.texto })],
    ['GET', '/eventos?eje=par&desde=0'],
    ['GET', '/eventos?eje=par&desde=1&cuantos=1'],
  ];
  const respuestas = await Promise.all(apis.map(async (api, k) => {
    const salida = [];
    for (const [metodo, camino, cuerpo] of secuencia) salida.push(await pedir(api, metodo, camino, cuerpo?.(eventos), { 'X-Clave-Lectura': claves[k] }));
    return salida;
  }));
  assert.deepEqual(respuestas[0], respuestas[1]);
  assert.deepEqual(respuestas[0].map((r) => r.estado), [400, 400, 201, 200, 403, 400, 400, 400, 400, 201, 200, 400, 200, 200]);
  assert.deepEqual(respuestas[0][12].cuerpo.eventos.map((x) => x.evento.id), [eventos.genesis.id, eventos.e1.id]);
});
