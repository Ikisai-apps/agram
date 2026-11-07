// Pruebas de regresión de la auditoría de ajuste 2 (docs/notas/AUDITORIA_AJUSTE_2.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';
import { descubrir, consolidar, autorizar, ejecutar, estadoDe, consolidaciones, esConsolidacion } from '../src/motor.js';
import { Eje } from '../src/eje.js';
import { evaluar, consultar } from '../src/bql.js';
import { item, desdePointed, desdeSequenced } from '../src/escritura.js';
import { cargarEpoca, EPOCA_0 } from '../src/epocas.js';
import { confluir } from '../src/tiempo.js';
import { cortesDe } from '../src/bases.js';

const T = '2026-11-07T16:00:00Z';

// A2-02 · una consolidación se reconoce por su anclaje en la fábrica, no solo por contexto.fase.
test('A2-02: un registro con fase «consolidado» escrito fuera de la fábrica no entra en el ciclo', async () => {
  const { eje, compra } = await ejemploCompra();
  const falsa = await eje.escribir({
    autor: 'huesped', sobre: compra.id, en: '7000000000', t: T,
    movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'huesped', a: null }],
    payload: 'mañana',
    contexto: { motor: 'fabrica', fase: 'consolidado' },
  });
  assert.equal(esConsolidacion(falsa), false);
  assert.equal(estadoDe(eje, falsa.id), undefined);
  await assert.rejects(autorizar(eje, { autorizante: 'casa', consolidacion: falsa.id, t: T }), /no es una consolidación/);
  await assert.rejects(ejecutar(eje, { autor: 'huesped', consolidacion: falsa.id, t: T }), /no es una consolidación/);
  assert.equal(consolidaciones(eje, compra.id).length, 0);
  // La fase declarada a mano en la posición 4, pero sin motor 'fabrica', tampoco cuenta.
  const sinMotor = await eje.escribir({
    autor: 'huesped', sobre: compra.id, en: '4000000000', t: T,
    movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'huesped', a: null }],
    payload: 'x', contexto: { fase: 'consolidado' },
  });
  assert.equal(estadoDe(eje, sinMotor.id), undefined);
  assert.equal(consolidaciones(eje, compra.id).length, 0);
  // La consolidación que escribe consolidar sí cuenta.
  const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, titulo: 'Pago', elecciones: { 1: 'un menú', 4: 'pagar' } });
  assert.equal(esConsolidacion(c), true);
  assert.equal(estadoDe(eje, c.id), 'PENDIENTE DE AUTORIZACIÓN');
  assert.deepEqual(consolidaciones(eje, compra.id).map((x) => x.id), [c.id]);
});

// A2-03 · descubrir da a cada candidato el estado de su camino exacto; la posición 0 es solo su etiqueta.
test('A2-03: [1] y [1, 0] se distinguen, y una fórmula pendiente en la 0 no vuelve pendiente al candidato', async () => {
  const { eje, compra } = await ejemploCompra();
  const escrito = await eje.escribir({
    autor: 'cocina', sobre: compra.id, en: '1000000000', t: T,
    movimientos: [{ token: 'T', escala: 'minuto', cantidad: 3, de: 'cocina', a: null }],
    payload: ['=REF("ffffffff")', 'ensalada', 'nota'],
  });
  const [p1] = descubrir(eje, compra.id, { posiciones: [1] });
  const propio1 = p1.candidatos.find((c) => c.origen === 'propio' && c.camino.length === 1);
  const propio10 = p1.candidatos.find((c) => c.origen === 'propio' && c.camino.length === 2);
  assert.notEqual(propio1.texto, propio10.texto);
  const e = p1.candidatos.find((c) => c.evento === escrito.id);
  assert.equal(e.estado, 'RESUELTO'); // el registro escrito entero
  assert.match(e.etiqueta, /^PENDIENTE/); // su posición 0, solo como etiqueta
});

// A2-06 · los cortes de las cajas son regla de la época: una época cargada de datos puede llevarlos.
test('A2-06: cargarEpoca lee y valida los cortes; confluir acepta la época por nombre y usa sus cortes', async () => {
  const cortes = [1, 2, 3, 4, 6, 10, 16, 26, 42];
  const conCortes = cargarEpoca({ nombre: 'prueba', reglas: [], cortes: { posiciones: cortes } }, { respaldo: EPOCA_0 });
  assert.deepEqual(conCortes.cortes('posiciones'), cortes);
  assert.equal(conCortes.cortes('escritos'), undefined);
  assert.equal(EPOCA_0.cortes('posiciones'), undefined); // la época 0 aún no los trae en sus datos
  assert.throws(() => cargarEpoca({ nombre: 'mal', reglas: [], cortes: { posiciones: [3, 2, 1] } }, { respaldo: EPOCA_0 }), /nueve umbrales crecientes/);
  const { eje, compra } = await ejemploCompra();
  assert.doesNotThrow(() => confluir(eje, compra.id, { epoca: 'época 0' }));
  assert.deepEqual(confluir(eje, compra.id, { epoca: conCortes }).medidas.posiciones.cortes, cortes);
  assert.equal(cortesDe('posiciones', conCortes).origen, 'epoca');
});

// A2-01 · una cadena de cifras es una cadena literal; el número lo da el JSON.
test('A2-01: «0034» y «120» escritos como texto se leen como texto, sin perder ceros', async () => {
  const eje = await Eje.genesis({
    demostracion: true,
    identidad: 'raiz', tipo: 'persona', t: T,
    emision: [{ token: 'T', escala: 'minuto', cantidad: 10 }],
    foco: ['Registro', 'x', '0034', '120', 'Mesa 4', '12 EUR', 120],
  });
  const g = eje.genesisId;
  assert.deepEqual(evaluar(eje, g, [2]).valor, { tipo: 'texto', valor: '0034' });
  assert.equal(consultar(eje, g, [0], 'LOCAL(2) = "0034"').valor.valor, true);
  assert.equal(consultar(eje, g, [0], 'LOCAL(3) = "120"').valor.valor, true);
  assert.deepEqual(evaluar(eje, g, [6]).valor, { tipo: 'numero', valor: 120 }); // número JSON
  assert.equal(evaluar(eje, g, [5]).valor.tipo, 'magnitud'); // «12 EUR»: [X] decidir VG la forma de la magnitud
});

// A2-04 · item() conserva como texto una dirección de diez dígitos.
test('A2-04: una dirección escrita desde un modo sigue siendo dirección para BQL', async () => {
  const { eje, compra } = await ejemploCompra();
  assert.equal(item(eje, '0400000000'), '0400000000');
  assert.equal(item(eje, '4000000000'), '4000000000');
  assert.equal(desdePointed(eje, '0400000000'), '0400000000');
  assert.equal(item(eje, '120'), 120); // lo demás, igual que antes
  const hilera = desdeSequenced(eje, ['Busco', 'a', 'b', 'c', 'd', '1000000000']);
  assert.equal(hilera[5], '1000000000');
  const r = await eje.escribir({
    autor: 'huesped', sobre: compra.id, t: T,
    movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'huesped', a: null }],
    payload: hilera,
  });
  assert.equal(consultar(eje, r.id, [0], 'BUSCAR(LOCAL(5))').estado, 'RESUELTO');
  assert.equal(
    consultar(eje, r.id, [0], 'CONTAR(BUSCAR(LOCAL(5)))').valor.valor,
    consultar(eje, r.id, [0], 'CONTAR(BUSCAR("1000000000"))').valor.valor,
  );
});
