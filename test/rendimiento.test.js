// Los índices que el banco de rendimiento (bench/eje.mjs,
// docs/notas/RENDIMIENTO.md) metió en el núcleo: ninguno cambia lo que se
// devuelve. Cada prueba compara con la forma directa de antes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { marcarEmpates, acuerdo, ocupantes } from '../src/encaje.js';
import { generarClaves, firmar, verificar } from '../src/autoridad.js';
import { crearEvento } from '../src/evento.js';
import { direccion } from '../src/btml.js';
import { serializar, restaurar } from '../src/persistencia.js';

const T0 = '2026-11-07T10:00:00Z';
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

function azar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** marcarEmpates tal como era: cada par comparado. La referencia. */
function marcarEmpatesPorPares(lista, { epoca } = {}) {
  const ordinales = epoca && typeof epoca.ordinal === 'function' ? [...Array(10).keys()].filter((k) => epoca.ordinal(k)) : [];
  const porDistancia = (va, vb) => {
    for (const k of ordinales) {
      const d = Math.abs(va[k]) - Math.abs(vb[k]);
      if (d !== 0) return d;
    }
    return 0;
  };
  const porEncaje = (a, b) => (acuerdo(b.vector) - acuerdo(a.vector)) || porDistancia(a.vector, b.vector);
  return lista.map((o) => {
    const empatados = lista.filter((p) => p !== o && porEncaje(o, p) === 0).length;
    return { ...o, empate: empatados > 0, empatados };
  });
}

test('marcarEmpates por claves da lo mismo que comparar cada par', () => {
  const r = azar(7);
  const epocas = [undefined, { ordinal: () => false }, { ordinal: (k) => k === 2 || k === 5 }, { ordinal: () => true }];
  // Hasta 12 se compara por pares (más barato); por encima, por claves: los dos caminos, contra la referencia.
  for (let vuelta = 0; vuelta < 600; vuelta++) {
    const largo = Math.floor(r() * 40);
    const lista = [];
    for (let i = 0; i < largo; i++) {
      // Vectores con pocos valores distintos, para que haya empates; a veces el mismo objeto dos veces.
      if (lista.length && r() < 0.1) { lista.push(lista[Math.floor(r() * lista.length)]); continue; }
      const v = Array.from({ length: 10 }, () => (r() < 0.6 ? 0 : Math.floor(r() * 5) - 2));
      if (r() < 0.05) v[Math.floor(r() * 10)] = r() < 0.5 ? NaN : Infinity;
      lista.push({ id: i, vector: v });
    }
    const epoca = epocas[vuelta % epocas.length];
    assert.deepEqual(marcarEmpates(lista, { epoca }), marcarEmpatesPorPares(lista, { epoca }), 'vuelta ' + vuelta);
  }
  // Sin dos objetos distintos no se compara nada: no hace falta vector.
  assert.deepEqual(marcarEmpates([{ x: 1 }]), [{ x: 1, empate: false, empatados: 0 }]);
  const solo = { x: 1 };
  assert.deepEqual(marcarEmpates([solo, solo]), marcarEmpatesPorPares([solo, solo]));
  const muchas = Array(20).fill(solo); // el mismo objeto veinte veces: por claves, tampoco hace falta vector
  assert.deepEqual(marcarEmpates(muchas), marcarEmpatesPorPares(muchas));
});

test('marcarEmpates es lineal: veinte mil ocupantes en una posición no tardan segundos', () => {
  const lista = Array.from({ length: 20000 }, (_, i) => ({ i, vector: [0, 0, 0, i % 3, 0, 0, 0, 0, 0, 0] }));
  const t = performance.now();
  const marcados = marcarEmpates(lista, { epoca: { ordinal: (k) => k === 3 } });
  const ms = performance.now() - t;
  assert.equal(marcados[0].empatados, 6666);
  assert.equal(marcados[2].empatados, 6665);
  assert.ok(ms < 2000, 'veinte mil ocupantes en ' + ms.toFixed(0) + ' ms (por pares serían 400 millones de comparaciones)');
});

test('sobre(id, en) por el índice de direcciones da lo mismo que filtrar los hijos, en orden, y es una copia', async () => {
  const r = azar(11);
  const eje = await Eje.genesis({ identidad: 'r', emision: [{ token: 'T', escala: 'minuto', cantidad: 10000 }], foco: ['g', 1, 2], t: T0 });
  for (let k = 0; k < 400; k++) {
    const sobre = eje.orden[Math.floor(r() * eje.orden.length)];
    const en = r() < 0.2 ? '0000000000' : direccion(r() < 0.7 ? [Math.floor(r() * 10)] : [Math.floor(r() * 10), Math.floor(r() * 10)]);
    await eje.escribir({ autor: 'r', sobre, en, t: T0, movimientos: [gastaT('r')], payload: 'e' + k });
  }
  const direcciones = [...new Set(eje.orden.map((id) => eje.obtener(id).en)), '9900000000', 4000000000, null, ''];
  const comprobar = (e) => {
    for (const id of [...e.orden, 'nadie']) {
      const todos = e.sobre(id);
      for (const en of direcciones) assert.deepEqual(e.sobre(id, en), todos.filter((h) => h.en === en));
    }
  };
  comprobar(eje);
  // Una copia: tocarla no toca el índice.
  const g = eje.genesisId;
  const antes = eje.sobre(g, '1000000000').length;
  eje.sobre(g, '1000000000').pop();
  assert.equal(eje.sobre(g, '1000000000').length, antes);
  // Restaurar reconstruye el índice.
  comprobar(await restaurar(JSON.parse(JSON.stringify(serializar(eje)))));
  // Y ocupantes, que lo usa, sigue viendo los escritos de cada dirección.
  const escritos = ocupantes(eje, g, [1], { orden: 'llegada' }).filter((o) => o.origen === 'escrito').map((o) => o.evento);
  assert.deepEqual(escritos, eje.sobre(g).filter((h) => h.en === '1000000000').map((h) => h.id));
});

test('conPrefijo da lo mismo que filtrar eje.orden, y REF, «@id» y Scened resuelven igual', async () => {
  const r = azar(23);
  const eje = await Eje.genesis({ identidad: 'r', emision: [{ token: 'T', escala: 'minuto', cantidad: 10000 }], foco: ['g', 1], t: T0 });
  for (let k = 0; k < 300; k++) {
    await eje.escribir({ autor: 'r', sobre: eje.orden[Math.floor(r() * eje.orden.length)], t: T0, movimientos: [gastaT('r')], payload: ['e' + k, k] });
  }
  const filtrar = (p) => eje.orden.filter((id) => id.startsWith(p));
  const prefijos = ['', 'a', '0f', 'zz', 'ABCD', 'abcd', 'ffff0', '0000000'];
  for (const id of eje.orden.filter((_, i) => i % 7 === 0)) for (const largo of [1, 2, 3, 4, 5, 8, 64]) prefijos.push(id.slice(0, largo));
  for (const p of prefijos) assert.deepEqual(eje.conPrefijo(p), filtrar(p), 'prefijo «' + p + '»');
  // La copia que da es suya: tocarla no toca el índice.
  const uno = eje.orden[5].slice(0, 6);
  eje.conPrefijo(uno).pop();
  assert.deepEqual(eje.conPrefijo(uno), filtrar(uno));
  // BQL REF: único → su valor; varios → ERROR ambigua; ninguno → PENDIENTE. Lo mismo que antes, sea cual sea el largo.
  const { consultar } = await import('../src/bql.js');
  const { item } = await import('../src/escritura.js');
  for (const p of prefijos.filter((x) => /^[0-9a-f]+$/.test(x))) {
    const ids = filtrar(p);
    const res = consultar(eje, eje.genesisId, [1], 'REF("' + p + '")');
    if (ids.length === 1) assert.equal(res.estado, 'RESUELTO', p);
    else if (ids.length > 1) assert.equal(res.texto, 'ERROR: referencia ambigua: ' + p);
    else assert.equal(res.texto, 'PENDIENTE: referencia ausente del eje: ' + p);
    if (p.length >= 4) {
      if (ids.length === 1) assert.deepEqual(item(eje, '@' + p), { ref: ids[0] });
      else assert.throws(() => item(eje, '@' + p), ids.length ? /ambigua/ : /desconocida/);
    }
  }
  // Scened lee los REF de las fórmulas con el mismo índice: la escena es la misma que recorriendo eje.orden.
  const { escena } = await import('../src/scened.js');
  const hex = prefijos.filter((x) => /^[0-9a-f]+$/.test(x));
  const notas = [];
  for (let i = 0; i < hex.length; i += 9) {
    const formulas = hex.slice(i, i + 9).map((p, j) => '=REF("' + (j % 2 ? '@' + p.toUpperCase() : p) + '")');
    notas.push((await eje.escribir({ autor: 'r', sobre: eje.genesisId, t: T0, movimientos: [gastaT('r')], payload: ['refs', ...formulas] })).id);
  }
  const sinIndice = new Proxy(eje, { get: (t, k) => (k === 'conPrefijo' ? undefined : typeof t[k] === 'function' ? t[k].bind(t) : t[k]) });
  const focos = [...eje.orden.filter((_, i) => i % 7 === 0), ...notas];
  const conIndice = escena(eje, focos, { ahora: T0, capacidad: Infinity });
  assert.ok(conIndice.focos.some((f) => f.salen.some((x) => x.tipo === 'formula')), 'hay aristas de fórmula');
  assert.deepEqual(conIndice, escena(sinIndice, focos, { ahora: T0, capacidad: Infinity }));
  // Un eje restaurado tiene el mismo índice.
  const otro = await restaurar(JSON.parse(JSON.stringify(serializar(eje))));
  for (const p of prefijos) assert.deepEqual(otro.conPrefijo(p), eje.orden.filter((id) => id.startsWith(p)));
});

test('verificar recuerda las claves congeladas y no las que pueden cambiar', async () => {
  const a = await generarClaves();
  const b = await generarClaves();
  const firmado = async (par, autor) => firmar(await crearEvento({ autor, sobre: 'x', t: T0, movimientos: [gastaT(autor)], payload: 'p' }), par.privada);
  const deA = await firmado(a, 'a');
  const deB = await firmado(b, 'b');
  // Congelada (como la guarda el eje): la misma respuesta cada vez.
  const congelada = Object.freeze({ ...a.publica });
  for (let i = 0; i < 3; i++) {
    assert.equal(await verificar(deA, congelada), true);
    assert.equal(await verificar(deB, congelada), false);
    assert.equal(await verificar({ ...deA, firma: deB.firma }, congelada), false);
  }
  // Una congelada que no se puede importar sigue sin verificar nada.
  const rota = Object.freeze({ ...a.publica, x: 'AAAA' });
  assert.equal(await verificar(deA, rota), false);
  assert.equal(await verificar(deA, rota), false);
  // Una que se puede cambiar no se recuerda: si cambia, verifica con la nueva.
  const mutable = { ...a.publica };
  assert.equal(await verificar(deA, mutable), true);
  Object.assign(mutable, b.publica);
  assert.equal(await verificar(deA, mutable), false);
  assert.equal(await verificar(deB, mutable), true);
});

test('el eje verifica con su clave guardada (congelada) en cada evento firmado', async () => {
  const par = await generarClaves();
  const eje = await Eje.genesis({ identidad: 'r', emision: [{ token: 'T', escala: 'minuto', cantidad: 100 }], foco: 'g', t: T0, clave: par.publica, privada: par.privada });
  assert.ok(Object.isFrozen(eje.clave('r')));
  for (let k = 0; k < 5; k++) await eje.escribir({ autor: 'r', sobre: eje.genesisId, t: T0, movimientos: [gastaT('r')], payload: 'e' + k }, par.privada);
  const otra = await generarClaves();
  const ajeno = await firmar(await crearEvento({ autor: 'r', sobre: eje.genesisId, t: T0, movimientos: [gastaT('r')], payload: 'ajeno' }), otra.privada);
  assert.deepEqual(await eje.validar(ajeno), ['firma inválida de r']);
  assert.equal(eje.orden.length, 6);
});
