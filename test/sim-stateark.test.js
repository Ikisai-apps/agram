// Pruebas de la simulación de StateArk (§3, sello de tiempo), copiadas tal cual del commit b65c93d de
// InTheState/stateark/sim con las rutas adaptadas a servidor/sim/stateark/. Cada archivo original es un describe.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { sellar, prueba, verificar, minar, SIMULADO, crearSellador } from '../servidor/sim/stateark/index.js';
import { arbol, raizDesde, hoja } from '../servidor/sim/stateark/merkle.js';
import { Sellador } from '../servidor/sim/stateark/sello.js';
import { Cadena } from '../servidor/sim/stateark/cadena.js';
import { crearServidor } from '../servidor/sim/stateark/servidor.js';
import { sha256Texto } from '../servidor/sim/stateark/hash.js';

describe("sim stateark: index", () => {
  test('las tres llamadas sueltas del §3 funcionan sobre el sellador por defecto', async () => {
    assert.equal(SIMULADO, true);
    const id = await sha256Texto('un evento de AGRAM');
    const { lote, pendiente } = await sellar([id]);
    assert.equal(pendiente, true);
    assert.equal((await prueba(id)).pendiente, true);
    await minar();
    const p = await prueba(id);
    assert.equal(p.lote, lote);
    assert.equal((await verificar({ id }, p)).ok, true);
  });

  test('crearSellador da selladores independientes', async () => {
    const a = await crearSellador();
    const b = await crearSellador();
    const id = await sha256Texto('solo en a');
    await a.sellar([id]);
    assert.equal(b.prueba(id), null);
  });
});

describe("sim stateark: merkle", () => {
  const ids = async (n) => Promise.all(Array.from({ length: n }, (_, k) => sha256Texto(`evento ${k}`)));

  test('cada id recalcula la raíz con su camino, para tamaños de 1 a 17', async () => {
    for (let n = 1; n <= 17; n++) {
      const lista = (await ids(n)).sort();
      const { raiz, caminos } = await arbol(lista);
      for (const id of lista) assert.equal(await raizDesde(id, caminos.get(id)), raiz, `n=${n}`);
    }
  });

  test('un lote de un solo id tiene por raíz la hoja de ese id, con camino vacío', async () => {
    const [id] = await ids(1);
    const { raiz, caminos } = await arbol([id]);
    assert.equal(raiz, await hoja(id));
    assert.deepEqual(caminos.get(id), []);
  });

  test('hoja y nodo están separados: la raíz de un lote no es la hoja de nadie', async () => {
    const lista = (await ids(2)).sort();
    const { raiz } = await arbol(lista);
    assert.notEqual(raiz, await hoja(lista[0]));
    assert.notEqual(raiz, await hoja(lista[1]));
  });

  test('el impar sube sin duplicarse: [a,b,c] y [a,b,c,c] no dan la misma raíz', async () => {
    const [a, b, c] = (await ids(3)).sort();
    const r3 = (await arbol([a, b, c])).raiz;
    const r4 = (await arbol([a, b, c, c])).raiz;
    assert.notEqual(r3, r4);
  });

  test('un camino mal formado da null', async () => {
    const [id] = await ids(1);
    assert.equal(await raizDesde(id, 'no'), null);
    assert.equal(await raizDesde(id, [['x', id]]), null);
    assert.equal(await raizDesde(id, [['i', 'corto']]), null);
    assert.equal(await raizDesde(id, [['i']]), null);
  });

  test('un lote vacío no tiene raíz', async () => {
    await assert.rejects(arbol([]), RangeError);
  });
});

describe("sim stateark: sello", () => {
  const INICIO = '2026-11-12T00:00:00.000Z';
  const relojFijo = () => Date.parse(INICIO);
  const nuevo = () => Sellador.crear({ inicio: INICIO, reloj: relojFijo });
  const ids = async (n, sal = '') => Promise.all(Array.from({ length: n }, (_, k) => sha256Texto(`evento ${sal}${k}`)));

  test('sellar → pendiente; minar → prueba con altura, hash, instante, lote y camino', async () => {
    const s = await nuevo();
    const lista = await ids(5);
    const r = await s.sellar(lista);
    assert.equal(r.pendiente, true);
    assert.deepEqual(s.prueba(lista[0]), { pendiente: true, lote: r.lote });

    const b = await s.minar();
    assert.equal(b.altura, 1);
    assert.equal(b.instante, '2026-11-12T00:10:00.000Z'); // génesis + 10 min

    for (const id of lista) {
      const p = s.prueba(id);
      assert.equal(p.altura, 1);
      assert.equal(p.hash, b.hash);
      assert.equal(p.instante, b.instante);
      assert.equal(p.lote, r.lote);
      assert.equal(p.prueba.via, 'simulado');
      assert.equal(p.prueba.ots, null);
      assert.deepEqual(await s.verificar(id, p), { ok: true, motivo: 'sellado', altura: 1, hash: b.hash, instante: b.instante });
    }
  });

  test('verificar acepta un evento de AGRAM y solo lee su id', async () => {
    const s = await nuevo();
    const [id] = await ids(1);
    await s.sellar([id]);
    await s.minar();
    const evento = Object.freeze({ id, autor: 'x', payload: { nada: 1 } });
    assert.equal((await s.verificar(evento, s.prueba(id))).ok, true);
  });

  test('un id nunca sellado: prueba null', async () => {
    const s = await nuevo();
    const [id] = await ids(1);
    assert.equal(s.prueba(id), null);
  });

  test('ids repetidos o desordenados dan el mismo lote; sellarlo dos veces no lo duplica', async () => {
    const s = await nuevo();
    const lista = await ids(3);
    const a = await s.sellar(lista);
    const b = await s.sellar([lista[2], lista[0], lista[1], lista[0]]);
    assert.equal(a.lote, b.lote);
    assert.equal(s.pendientes.length, 1);
  });

  test('un id en dos lotes: la prueba es la del sello más antiguo', async () => {
    const s = await nuevo();
    const [x, y] = await ids(2);
    await s.sellar([x]);
    const primero = await s.minar();
    await s.sellar([x, y]);
    await s.minar();
    assert.equal(s.prueba(x).altura, primero.altura);
  });

  test('verificar rechaza, con motivo, cada manipulación', async () => {
    const s = await nuevo();
    const lista = await ids(4);
    await s.sellar(lista);
    await s.minar();
    const [otro] = await ids(1, 'otro');
    const p = s.prueba(lista[1]);
    const copia = () => structuredClone(p);

    const casos = [
      ['otro id', otro, p, /no dan la raíz/],
      ['id inválido', 'xyz', p, /id de AGRAM/],
      ['sin prueba', lista[1], null, /no hay prueba/],
      ['pendiente', lista[1], { pendiente: true, lote: p.lote }, /pendiente/],
      ['camino tocado', lista[1], (() => { const c = copia(); c.prueba.camino[0][1] = otro; return c; })(), /no dan la raíz/],
      ['lado tocado', lista[1], (() => { const c = copia(); c.prueba.camino[0][0] = c.prueba.camino[0][0] === 'i' ? 'd' : 'i'; return c; })(), /no dan la raíz/],
      ['camino mal formado', lista[1], (() => { const c = copia(); c.prueba.camino = [['z', otro]]; return c; })(), /mal formado/],
      ['lote cambiado', lista[1], { ...copia(), lote: otro }, /no dan la raíz/],
      ['altura inexistente', lista[1], { ...copia(), altura: 99 }, /no hay bloque/],
      ['hash de otro bloque', lista[1], { ...copia(), hash: otro }, /hash no es el del bloque/],
      ['altura de otro bloque', lista[1], { ...copia(), altura: 0 }, /hash no es el del bloque/],
      ['vía real', lista[1], (() => { const c = copia(); c.prueba.via = 'opentimestamps'; return c; })(), /solo comprueba/],
    ];
    for (const [nombre, id, prueba, motivo] of casos) {
      const r = await s.verificar(id, prueba);
      assert.equal(r.ok, false, nombre);
      assert.match(r.motivo, motivo, nombre);
    }
  });

  test('una prueba válida de un lote que no está en ese bloque se rechaza', async () => {
    // Dos selladores con cadenas idénticas hasta el bloque 1, pero lotes distintos.
    const s = await nuevo();
    const [a, b] = await ids(2);
    await s.sellar([a]);
    await s.minar();
    const ajeno = await nuevo();
    await ajeno.sellar([b]);
    await ajeno.minar();
    const r = await s.verificar(b, ajeno.prueba(b));
    assert.equal(r.ok, false);
    assert.match(r.motivo, /hash no es el del bloque/);
  });

  test('sellar rechaza listas vacías e ids que no son de AGRAM', async () => {
    const s = await nuevo();
    await assert.rejects(s.sellar([]), TypeError);
    await assert.rejects(s.sellar('no'), TypeError);
    await assert.rejects(s.sellar(['ABC']), TypeError);
    await assert.rejects(s.sellar(['A'.repeat(64)]), TypeError); // mayúsculas: no es la forma de AGRAM
    assert.throws(() => s.prueba('no'), TypeError);
  });

  test('el instante del bloque no retrocede y respeta el reloj si va por delante', async () => {
    let ahora = Date.parse(INICIO);
    const s = await Sellador.crear({ inicio: INICIO, reloj: () => ahora });
    const b1 = await s.minar();
    ahora += 60 * 60 * 1000; // una hora después
    const b2 = await s.minar();
    assert.equal(b1.instante, '2026-11-12T00:10:00.000Z');
    assert.equal(b2.instante, '2026-11-12T01:00:00.000Z');
  });

  test('exportar e importar conserva las pruebas; un estado manipulado no se importa', async () => {
    const s = await nuevo();
    const lista = await ids(3);
    await s.sellar(lista);
    await s.minar();
    const [pend] = await ids(1, 'pend');
    await s.sellar([pend]);

    const estado = JSON.parse(JSON.stringify(s.exportar()));
    const r = await Sellador.importar(estado, { reloj: relojFijo });
    assert.deepEqual(r.prueba(lista[0]), s.prueba(lista[0]));
    assert.equal((await r.verificar(lista[0], r.prueba(lista[0]))).ok, true);
    assert.equal(r.prueba(pend).pendiente, true);

    const malo = structuredClone(estado);
    malo.cadena.bloques[1].lotes = [pend];
    await assert.rejects(Sellador.importar(malo), /no es íntegro/);
  });

  test('cadena: cada bloque queda encadenado al anterior', async () => {
    const c = await Cadena.crear({ inicio: INICIO, reloj: relojFijo });
    await c.minar();
    await c.minar();
    for (let h = 0; h <= c.altura; h++) assert.equal(await c.integro(h), true);
    assert.equal(c.bloque(2).previo, c.bloque(1).hash);
    assert.equal(c.bloque(-1), null);
  });
});

describe("sim stateark: servidor", () => {
  let servidor;
  let base;

  before(async () => {
    ({ servidor } = await crearServidor());
    await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${servidor.address().port}`;
  });
  after(() => new Promise((r) => servidor.close(r)));

  const post = (ruta, cuerpo) =>
    fetch(base + ruta, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo ?? {}) });

  test('recorrido completo por HTTP: sellar, 202 pendiente, minar, 200 prueba, verificar', async () => {
    const id = await sha256Texto('evento por http');
    const s = await post('/sellar', { ids: [id] });
    assert.equal(s.status, 200);
    const { lote } = await s.json();

    const pend = await fetch(`${base}/prueba/${id}`);
    assert.equal(pend.status, 202);
    assert.deepEqual(await pend.json(), { pendiente: true, lote });

    const m = await post('/minar');
    assert.equal(m.status, 200);

    const r = await fetch(`${base}/prueba/${id}`);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('access-control-allow-origin'), '*');
    const p = await r.json();
    assert.equal(p.lote, lote);

    const v = await (await post('/verificar', { evento: { id }, prueba: p })).json();
    assert.equal(v.ok, true);
    const v2 = await (await post('/verificar', { id, prueba: { ...p, hash: id } })).json();
    assert.equal(v2.ok, false);
  });

  test('errores: id no sellado 404, entrada mala 400, ruta desconocida 404, JSON roto 400', async () => {
    const id = await sha256Texto('nunca sellado');
    assert.equal((await fetch(`${base}/prueba/${id}`)).status, 404);
    assert.equal((await fetch(`${base}/prueba/nohex`)).status, 400);
    assert.equal((await post('/sellar', { ids: ['malo'] })).status, 400);
    assert.equal((await fetch(`${base}/nada`)).status, 404);
    const roto = await fetch(base + '/sellar', { method: 'POST', body: '{' });
    assert.equal(roto.status, 400);
  });

  test('GET / dice que es una simulación', async () => {
    const r = await (await fetch(base + '/')).json();
    assert.equal(r.simulado, true);
  });
});
