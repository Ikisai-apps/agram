// Encargo 3c-2b: los modelos de visualización como registros (src/modelos.js) y el importador de paquetes de arte
// (arte/importar.mjs). Respaldo en cadena (VG): el modelo que nombra la configuración, luego el animado genérico de la
// época, luego el sobrio, que siempre responde; una pieza se busca en orden, y el paso inferior más cercano del mismo
// modelo va antes que el siguiente modelo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { modelo, pieza, modelosDeLaEpoca, cabecera, leerPieza, piezasDeModelo, validarModelo, recursoAdmitido, CUALQUIERA } from '../src/modelos.js';
import { importar, mundoDe } from '../arte/importar.mjs';
import { configuracion, validar } from '../src/contrato.js';
import { EPOCA_0_BTML, cargarEpocaBtml, REGISTROS_DE_MODELOS } from '../src/epocas.js';
import { EPOCA_0_BTML_DATOS, REGLAS_DE_EPOCA_DATOS, CORRECCIONES_DE_EPOCA_DATOS, MODELOS_DE_EPOCA_DATOS } from '../datos/epocas/epocas.js';
import { modelosDe, modeloConPiezas, SIN_PIEZAS, MUNDOS } from '../datos/epocas/generar.mjs';
import { validarPayload } from '../src/btml.js';
import { evaluar } from '../src/bqlm.js';
import { ContextoEje } from '../src/contexto-eje.js';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';

const minuto = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
const T = '2026-11-07T18:00:00Z';

/** Una copia de la época 0 con cambios, con sus modelos. */
function epocaCon(cambiar) {
  const e = JSON.parse(JSON.stringify(EPOCA_0_BTML_DATOS));
  cambiar(e);
  return cargarEpocaBtml(e, { registros: [...REGLAS_DE_EPOCA_DATOS, ...REGISTROS_DE_MODELOS], correcciones: CORRECCIONES_DE_EPOCA_DATOS, id: EPOCA_0_BTML.id });
}

/** La configuración de `quien` con el modelo `nombre`: un registro de preferencias en el 9 de su alta. */
async function conModelo(eje, quien, nombre, t = T) {
  return eje.escribir({ autor: quien, sobre: eje.alta(quien).id, en: '9000000000', t, movimientos: [minuto(quien)], payload: ['preferences', 10, 'animated', 'en', [1, 2, 3], 'preferences', nombre] });
}

test('la época lleva los modelos como registros: epoch.9.7 es la cabecera y las referencias a sobrio, animado-generico e ikisai, cada uno con sus piezas referenciadas por mundo; npm run epocas los tiene al día', () => {
  const c = cabecera();
  assert.deepEqual(c.niveles, ['sello', 'intermedio', 'ilustrado']);
  assert.deepEqual(c.cadena, ['animado-generico', 'sobrio']);
  assert.deepEqual(c.variantes, ['centro', 'izquierda', 'derecha']);
  assert.deepEqual(c.tipos, [{ tipo: 'elemento', clave: 'paso' }, { tipo: 'munequito', clave: 'accion' }, { tipo: 'movimiento', clave: 'primitiva' }, { tipo: 'fondo', clave: 'paso' }, { tipo: 'marco', clave: 'paso' }, { tipo: 'icono', clave: 'mundo' }]);
  assert.deepEqual([c.animados, c.bucle, c.fijo, c.multiplo, c.preferencia], [['lottie', 'video'], 'loop', 'once', 10, '9360000000']);
  const de = modelosDeLaEpoca();
  assert.deepEqual(de.map((m) => [m.nombre, m.nivel, m.piezas.length]), [['animado-generico', 'intermedio', 7], ['ikisai', 'ilustrado', 0], ['sobrio', 'sello', 34]]);
  assert.deepEqual(MODELOS_DE_EPOCA_DATOS.map((m) => m.nombre), ['animado-generico', 'ikisai', 'sobrio']);
  assert.deepEqual(modelosDe(), MODELOS_DE_EPOCA_DATOS, 'epocas.js lleva los modelos de modelos/');
  for (const m of MODELOS_DE_EPOCA_DATOS) {
    const enDisco = JSON.parse(readFileSync(new URL('../datos/epocas/modelos/' + m.archivo, import.meta.url), 'utf8'));
    assert.deepEqual(enDisco, m.registro, m.archivo + ': las posiciones en disco son las que salen de sus piezas');
    assert.deepEqual(validarPayload(m.registro), { ok: true, errores: [] });
    for (const p of m.piezas) assert.deepEqual(validarPayload(p.registro), { ok: true, errores: [] });
    assert.ok(EPOCA_0_BTML.registros.has(m.id) && m.piezas.every((p) => EPOCA_0_BTML.registros.has(p.id)), 'el BQL mínimo los alcanza por su id');
  }
  const refs = EPOCA_0_BTML.registro[9][7].slice(1);
  assert.deepEqual(refs.map((r) => r.ref), MODELOS_DE_EPOCA_DATOS.map((m) => m.id));
  // El sobrio sirve en los ocho mundos y en el 5; el animado solo en la ciudad; ikisai, nada más que el nombre.
  const sobrio = de.find((m) => m.nombre === 'sobrio');
  assert.deepEqual([...new Set(sobrio.piezas.map((p) => p.pv))], [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(sobrio.piezas.filter((p) => p.pv === 5).map((p) => [p.tipo, p.forma]), [['icono', 'texto'], ['marco', 'rectangulo']]);
  assert.deepEqual(de.find((m) => m.nombre === 'animado-generico').registro.length, 2, 'solo el 0 y el 1 (la ciudad): sin iconos del aro');
  assert.deepEqual(de.find((m) => m.nombre === 'ikisai').registro, [['ikisai', 'ilustrado', de.find((m) => m.nombre === 'ikisai').nota]]);
  // Leídos con el BQL mínimo: el 0 de cada modelo y la clave de una pieza.
  const ctx = new ContextoEje(null, { epoch: EPOCA_0_BTML });
  assert.deepEqual(evaluar('epoch.9.7.1.0', ctx).valor, ['animado-generico', 'intermedio', de[0].nota], 'el 9.7.1 es la referencia al primer modelo: se sigue');
  assert.deepEqual(evaluar('(first epoch.9.7.1.1).2', ctx).valor, [1], 'la primera pieza de la ciudad del animado: el paso 1');
  assert.deepEqual(evaluar('count epoch.9.7.3.1', ctx).valor, [4], 'cuatro piezas en la ciudad del sobrio');
  assert.deepEqual(evaluar('(first epoch.9.7.3.5).0', ctx).valor, ['icono'], 'el 5 del sobrio: el icono y el marco');
});

test('la cadena de respaldo: lo que nombra la configuración (model), luego el animado genérico, luego el sobrio; por defecto, sobrio', async () => {
  const { eje } = await ejemploCompra();
  assert.equal(configuracion(eje, 'huesped').model, 'sobrio', 'la preferencia «model» de la plantilla «preferences» (epoch.9.3.6)');
  assert.deepEqual(modelo(eje, 'huesped').map((m) => m.nombre), ['sobrio', 'animado-generico'], 'el defecto es el sobrio; detrás, la cadena sin repetir');
  const mias = await conModelo(eje, 'huesped', 'ikisai');
  assert.deepEqual(validar(eje, mias), []);
  assert.equal(configuracion(eje, 'huesped').model, 'ikisai');
  assert.deepEqual(modelo(eje, 'huesped').map((m) => m.nombre), ['ikisai', 'animado-generico', 'sobrio']);
  await conModelo(eje, 'huesped', 'animado-generico');
  assert.deepEqual(modelo(eje, 'huesped').map((m) => m.nombre), ['animado-generico', 'sobrio']);
  await conModelo(eje, 'huesped', 'desconocido');
  assert.deepEqual(modelo(eje, 'huesped').map((m) => m.nombre), ['animado-generico', 'sobrio'], 'un nombre que no existe no rompe la cadena');
  assert.deepEqual(modelo(eje, 'nadie').map((m) => m.nombre), ['sobrio', 'animado-generico'], 'sin alta, los defectos');
  // Un modelo del eje, anclado al dominio de un proyecto, con una pieza anclada en su ciudad: por su id o por su nombre.
  const propio = await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t: T, movimientos: [minuto('casa')], payload: [['casa-rural', 'ilustrado', 'el modelo de la casa']] });
  await eje.escribir({ autor: 'casa', sobre: propio.id, en: '1000000000', t: T, movimientos: [minuto('casa')], payload: [['fondo'], [2, 'image'], [3], ['centro'], ['once', 1], [1], ['arte/casa/fondo-3.png', 'la casa']] });
  await conModelo(eje, 'huesped', propio.id);
  const cadena = modelo(eje, 'huesped');
  assert.deepEqual(cadena.map((m) => [m.nombre, m.donde === propio.id, m.piezas.length]), [['casa-rural', true, 1], ['animado-generico', false, 7], ['sobrio', false, 34]]);
  await conModelo(eje, 'huesped', 'casa-rural');
  assert.deepEqual(modelo(eje, 'huesped').map((m) => m.nombre), ['animado-generico', 'sobrio'], 'un modelo del eje no se resuelve por nombre (SEG-14): solo por id');
  assert.deepEqual(pieza(cadena, 'fondo', 1, 5, 'centro', { tamano: 2 }).recurso, 'arte/casa/fondo-3.png', 'la pieza anclada en la ciudad del modelo del eje');
  assert.equal(pieza(cadena, 'fondo', 1, 5, 'centro', { tamano: 1 }).modelo, 'sobrio', 'en el hueco no cabe (tamaño mínimo 2): el siguiente que responda');
  // La cadena misma es un dato de la época.
  const otra = epocaCon((e) => { e[9][7][0][2] = ['sobrio']; });
  assert.deepEqual(modelo(eje, 'cocina', { epoca: otra }).map((m) => m.nombre), ['sobrio']);
});

test('pieza: la primera que exista en la cadena; con un paso, el inferior más cercano del mismo modelo antes del siguiente modelo; la orientación pedida y, si no, la de respaldo; el sobrio siempre responde', async () => {
  const { eje } = await ejemploCompra();
  await conModelo(eje, 'huesped', 'ikisai');
  const cadena = modelo(eje, 'huesped');
  const tienda = (o) => 'arte/pruebas/03/ciudad/elemento/tienda-' + o + '-intermedio.svg';
  // La tienda: paso 5 en las tres orientaciones y, como respaldo de 1-10, paso 1 con el mismo recurso.
  const p7 = pieza(cadena, 'elemento', 1, 7, 'derecha');
  assert.deepEqual([p7.modelo, p7.nivel, p7.paso, p7.variante, p7.recurso, p7.formato, p7.bucle, p7.fotogramas, p7.tamano], ['animado-generico', 'intermedio', 5, 'derecha', tienda('derecha'), 'svg', false, 1, 1]);
  assert.deepEqual([pieza(cadena, 'elemento', 1, 5, 'izquierda').paso, pieza(cadena, 'elemento', 1, 3, 'izquierda').paso, pieza(cadena, 'elemento', 1, 10, 'centro').paso, pieza(cadena, 'elemento', 1, 1, 'centro').paso], [5, 1, 5, 1]);
  assert.equal(pieza(cadena, 'elemento', 1, 3, 'izquierda').recurso, tienda('izquierda'), 'el paso inferior más cercano (1), con el mismo recurso');
  assert.equal(pieza(cadena, 'elemento', 1, 5, 'arriba').variante, 'centro', 'una orientación que no hay: la de respaldo, del mismo modelo');
  // El vendedor esperando: el muñequito de la ciudad; otra acción, el sobrio (un punto).
  const v = pieza(cadena, 'munequito', 1, 'esperar');
  assert.deepEqual([v.modelo, v.accion, v.formato, v.bucle, v.fotogramas, v.recurso], ['animado-generico', 'esperar', 'lottie', true, 48, 'arte/pruebas/03/ciudad/munequito/vendedor-esperar-intermedio.json']);
  assert.deepEqual([pieza(cadena, 'munequito', 1, 'actuar').modelo, pieza(cadena, 'munequito', 1, 'actuar').forma, pieza(cadena, 'munequito', 1, 'actuar').accion], ['sobrio', 'punto', CUALQUIERA]);
  // Fuera de la ciudad, o lo que el animado no trae (iconos, fondos, movimientos): el sobrio, solo formas.
  assert.deepEqual([pieza(cadena, 'elemento', 2, 5, 'derecha').modelo, pieza(cadena, 'elemento', 2, 5, 'derecha').forma, pieza(cadena, 'elemento', 2, 5, 'derecha').recurso], ['sobrio', 'rectangulo', null]);
  assert.deepEqual([pieza(cadena, 'icono', 5, 3).forma, pieza(cadena, 'marco', 5, 2).forma, pieza(cadena, 'fondo', 4, 9).forma, pieza(cadena, 'movimiento', 7, 'mint').forma, pieza(cadena, 'movimiento', 6, 'crear-pasado').forma], ['texto', 'rectangulo', 'rectangulo', 'punto', 'punto']);
  // Nunca null al final: todos los tipos, mundos, pasos y orientaciones.
  const c = cabecera();
  const claves = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 'esperar', 'actuar', 'celebrar', 'mint', 'transfer', 'lock', 'release', 'burn', 'crear-pasado', 'crear-futuro', 'crear-abajo', 'crear-arriba', undefined];
  for (const { tipo } of c.tipos) {
    for (const pv of tipo === 'marco' || tipo === 'icono' ? [5] : [1, 2, 3, 4, 6, 7, 8, 9]) {
      for (const k of claves) for (const o of [...c.variantes, undefined]) assert.ok(pieza(cadena, tipo, pv, k, o), [tipo, pv, k, o].join(' '));
    }
  }
  // Sin el sobrio en la cadena, lo que no hay es null.
  assert.equal(pieza(cadena.slice(0, 2), 'elemento', 2, 5), null);
  assert.equal(pieza([], 'elemento', 1, 5), null);
  // Los tamaños: la mayor que quepa.
  const grande = [['elemento'], [3, 'image'], [5], ['centro'], ['once', 1], [1], ['arte/x/grande.png']];
  const mediana = [['elemento'], [2, 'image'], [5], ['centro'], ['once', 1], [1], ['arte/x/mediana.png']];
  const propio = { nombre: 'tamanos', nivel: 'ilustrado', donde: 'x', registro: [['tamanos', 'ilustrado']], cabecera: c, piezas: [leerPieza(grande, { pv: 1 }), leerPieza(mediana, { pv: 1 })] };
  assert.deepEqual([3, 2, 1].map((t) => pieza([propio, ...cadena], 'elemento', 1, 5, 'centro', { tamano: t }).recurso), ['arte/x/grande.png', 'arte/x/mediana.png', tienda('centro')]);
  assert.equal(pieza([propio, ...cadena], 'elemento', 1, 5, 'centro').recurso, 'arte/x/grande.png', 'sin tamaño, la mayor');
});

test('validar: bucle y fotogramas son obligatorios en lo animado; los fotogramas de lo nuevo, múltiplos de diez (el arte 03 trae 48: aviso); los tamaños, los de la época', () => {
  for (const m of modelosDeLaEpoca()) {
    const { motivos, avisos } = validarModelo(m);
    assert.deepEqual(motivos, [], m.nombre);
    assert.deepEqual(avisos, m.nombre === 'animado-generico' ? ['pieza munequito esperar centro (mundo 1): 48 fotogramas no son múltiplo de 10 (lo nuevo va en múltiplos de 10)'] : []);
  }
  const c = cabecera();
  const sinTiempo = [['munequito'], [1, 'lottie'], ['esperar'], ['centro']];
  const malRepite = [['munequito'], [1, 'lottie'], ['esperar'], ['centro'], ['siempre', 20], [1], ['x.json']];
  const sinFotogramas = [['movimiento'], [1, 'video'], ['mint'], ['centro'], ['loop', 0], [1], ['x.mp4']];
  const tamanoRaro = [['elemento'], [7, 'svg'], [1], ['centro'], ['once', 1], [1], ['x.svg']];
  const bien = [['elemento'], [2, 'svg'], [1], ['centro'], ['once', 1], [1], ['x.svg']];
  const fijoAnimado = [['fondo'], [1, 'lottie'], [1], ['centro'], ['once', 30], [1], ['x.json']];
  const m = { nombre: 'prueba', nivel: 'sello', registro: [['prueba', 'sello']], cabecera: c, piezas: [sinTiempo, malRepite, sinFotogramas, tamanoRaro, bien, fijoAnimado].map((r) => leerPieza(r, { pv: 1 })) };
  const { motivos, avisos } = validarModelo(m);
  assert.deepEqual(motivos, [
    'pieza munequito esperar centro (mundo 1): animada (lottie) sin su 4 [repetición, fotogramas]: bucle y fotogramas son obligatorios en lo animado',
    'pieza munequito esperar centro (mundo 1): repetición «siempre» que la cabecera no conoce (loop, once)',
    'pieza movimiento mint centro (mundo 1): los fotogramas son un entero positivo',
    'pieza elemento 1 centro (mundo 1): tamaño mínimo 7 que la época no tiene',
  ]);
  assert.deepEqual(avisos, []);
  assert.deepEqual(leerPieza(fijoAnimado, { pv: 1 }).bucle, false, 'once: una sola vez');
  assert.equal(leerPieza([['cosa'], [1, 'svg']], { pv: 1 }), null, 'lo que no es un tipo de la cabecera no es una pieza');
  // Un modelo cuya posición referencia algo que no es una pieza (una regla de la época).
  const regla = EPOCA_0_BTML.reglasConId[0];
  assert.match(validarModelo([['raro', 'sello'], [{ ref: regla.id }]]).motivos[0], /no es una pieza/);
});

test('el importador: un índice con campos que faltan da un modelo con sus piezas (tipo y mundo de las carpetas, orientación y nivel del nombre, formato de la extensión, fotogramas del Lottie), sin copiar archivos', async () => {
  const carpeta = new URL('../arte/pruebas/03/', import.meta.url);
  const indice = JSON.parse(readFileSync(new URL('indice.json', carpeta), 'utf8'));
  const archivosAntes = readdirSync(carpeta, { recursive: true }).length;
  const r = importar(indice, { carpeta: carpeta.pathname.replace(/^\/([A-Za-z]:)/, '$1') });
  assert.equal(readdirSync(carpeta, { recursive: true }).length, archivosAntes, 'no copia ni escribe nada en el paquete');
  assert.deepEqual([r.nombre, r.nivel], ['prueba-03', 'intermedio']);
  assert.deepEqual(r.modelo[0], ['prueba-03', 'intermedio', indice.nota]);
  assert.equal(r.modelo.length, 2, 'solo la ciudad');
  assert.deepEqual(r.modelo[1], r.piezas.map((p) => ({ ref: p.id })));
  assert.deepEqual(r.piezas.map((p) => p.registro.slice(0, 6)), [
    [['elemento'], [1, 'svg'], [5], ['centro'], ['once', 1], [1]],
    [['elemento'], [1, 'svg'], [5], ['izquierda'], ['once', 1], [1]],
    [['elemento'], [1, 'svg'], [5], ['derecha'], ['once', 1], [1]],
    [['munequito'], [1, 'lottie'], ['esperar'], ['centro'], ['loop', 48], [1]],
  ]);
  assert.deepEqual(r.piezas.map((p) => p.registro[6][0]), ['arte/pruebas/03/ciudad/elemento/tienda-centro-intermedio.svg', 'arte/pruebas/03/ciudad/elemento/tienda-izquierda-intermedio.svg', 'arte/pruebas/03/ciudad/elemento/tienda-derecha-intermedio.svg', 'arte/pruebas/03/ciudad/munequito/vendedor-esperar-intermedio.json']);
  assert.deepEqual(r.avisos, ['pieza munequito esperar centro (mundo 1): 48 fotogramas no son múltiplo de 10 (lo nuevo va en múltiplos de 10)']);
  for (const p of r.piezas) assert.deepEqual(validarPayload(p.registro), { ok: true, errores: [] });
  // Con menos todavía: solo rutas. El Lottie se lee del disco para sus fotogramas; sin clave, la pieza sirve para cualquiera.
  const minimo = importar([{ ruta: 'ciudad/elemento/tienda-derecha-intermedio.svg' }, { ruta: 'ciudad/munequito/vendedor-esperar-intermedio.json' }, { ruta: 'sin/mundo.svg' }, { ruta: 'ciudad/cosa/x.svg' }, { ruta: 'ciudad/elemento/x.raro' }], { carpeta: carpeta.pathname.replace(/^\/([A-Za-z]:)/, '$1') });
  assert.deepEqual([minimo.nombre, minimo.nivel], ['03', 'intermedio'], 'el nombre de la carpeta; el nivel, del nombre de los archivos');
  assert.deepEqual(minimo.piezas.map((p) => p.registro.slice(0, 6)), [
    [['elemento'], [1, 'svg'], ['*'], ['derecha'], ['once', 1], [1]],
    [['munequito'], [1, 'lottie'], ['*'], ['centro'], ['loop', 48], [1]],
  ]);
  assert.equal(minimo.avisos.filter((a) => /se omite/.test(a)).length, 3, 'sin mundo, sin familia, sin formato: se omiten y se dice');
  assert.ok(minimo.avisos.some((a) => /sirve para cualquiera/.test(a)));
  // El modelo importado entra en una cadena y responde.
  const { eje } = await ejemploCompra();
  await conModelo(eje, 'huesped', 'animado-generico');
  const importado = { nombre: r.nombre, nivel: r.nivel, nota: null, donde: 'importado', registro: r.modelo, cabecera: cabecera(), piezas: r.piezas.map((p) => ({ ...leerPieza(p.registro, { pv: 1 }), donde: p.id })) };
  const cadena = [importado, ...modelo(eje, 'huesped')];
  assert.equal(pieza(cadena, 'elemento', 1, 8, 'izquierda').modelo, 'prueba-03');
  assert.equal(pieza(cadena, 'elemento', 1, 2, 'izquierda').modelo, 'animado-generico', 'por debajo del 5 el importado no tiene: el siguiente');
  // Los mundos por nombre o dígito.
  assert.deepEqual([mundoDe('ciudad'), mundoDe('Jardín'), mundoDe('fábrica'), mundoDe(8), mundoDe('9'), mundoDe('recursos'), mundoDe('otro')], [1, 2, 4, 8, 9, 1, undefined]);
  // Un modelo con mundos sin piezas delante de otros con ellas lleva la hoja «sin piezas», y es un payload válido.
  const salto = modeloConPiezas(['salto', 'sello'], [{ id: 'a'.repeat(64), registro: [['fondo'], [1, 'image'], [1], ['centro'], ['once', 1], [3], ['x.png']] }]);
  assert.deepEqual(salto, [['salto', 'sello'], SIN_PIEZAS, SIN_PIEZAS, [{ ref: 'a'.repeat(64) }]]);
  assert.deepEqual(validarPayload(salto), { ok: true, errores: [] });
  assert.deepEqual(piezasDeModelo(salto, {}).length, 0, 'sin registros que alcanzar, sin piezas');
  assert.deepEqual(MUNDOS, [1, 2, 3, 4, 6, 7, 8, 9]);
  assert.ok(existsSync(new URL('../arte/MANIFIESTO.md', import.meta.url)), 'el manifiesto de arte existe');
});

test('SEG-14: un modelo del eje se nombra por id ({ ref } o texto) y no por nombre; solo cuentan las piezas ancladas por su autor; recursos y formatos acotados en lo que viene del eje', async () => {
  const { eje } = await ejemploCompra();
  const propio = await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t: T, movimientos: [minuto('casa')], payload: [['casa-rural', 'ilustrado', 'el modelo de la casa']] });
  const pieza1 = (recurso, formato = 'image', clave = 3) => [['fondo'], [2, formato], [clave], ['centro'], ['once', 1], [1], ...(recurso ? [recurso] : [])];
  const ancla = (autor, payload, sobre = propio.id) => eje.escribir({ autor, sobre, en: '1000000000', t: T, movimientos: [minuto(autor)], payload });
  const fondo = (cadena, paso, tamano = 2) => pieza(cadena, 'fondo', 1, paso, 'centro', { tamano });

  // La pieza anclada por un tercero no entra; la del autor, sí.
  await ancla('cocina', pieza1(['arte/otro/fondo-1.png'], 'image', 1));
  await ancla('casa', pieza1(['arte/casa/fondo-3.png']));
  await conModelo(eje, 'huesped', propio.id);
  let cadena = modelo(eje, 'huesped');
  assert.deepEqual(cadena.map((m) => [m.nombre, m.piezas.length]), [['casa-rural', 1], ['animado-generico', 7], ['sobrio', 34]]);
  assert.equal(cadena[0].piezas[0].recurso, 'arte/casa/fondo-3.png');
  assert.equal(fondo(cadena, 1).modelo, 'sobrio', 'la pieza del tercero (paso 1) no cuenta: responde el respaldo');
  assert.equal(fondo(cadena, 3).modelo, 'casa-rural', 'la del autor, sí');
  assert.deepEqual(piezasDeModelo(propio.payload, { eje, id: propio.id }).map((p) => p.recurso), ['arte/casa/fondo-3.png'], 'también leyendo el modelo directamente');

  // La preferencia con el id (texto o { ref }) resuelve el modelo del eje.
  await conModelo(eje, 'huesped', { ref: propio.id });
  assert.equal(modelo(eje, 'huesped')[0].donde, propio.id, 'la preferencia como { ref }');
  await conModelo(eje, 'huesped', 'f'.repeat(64));
  assert.deepEqual(modelo(eje, 'huesped').map((m) => m.nombre), ['animado-generico', 'sobrio'], 'un id que el eje no tiene se salta');

  // Un registro del eje que parece el modelo «ikisai» no suplanta al de la época.
  const falso = await eje.escribir({ autor: 'cocina', sobre: eje.alta('cocina').id, en: '1000000000', t: T, movimientos: [minuto('cocina')], payload: [['ikisai', 'ilustrado', 'yo soy ikisai']] });
  await ancla('cocina', pieza1(['arte/cocina/fondo.png'], 'image', 1), falso.id);
  await conModelo(eje, 'huesped', 'ikisai');
  cadena = modelo(eje, 'huesped');
  assert.deepEqual(cadena.map((m) => [m.nombre, m.donde === falso.id, m.piezas.length]), [['ikisai', false, 0], ['animado-generico', false, 7], ['sobrio', false, 34]], 'el de la época (sin piezas), no el del eje');
  await conModelo(eje, 'huesped', falso.id);
  assert.equal(modelo(eje, 'huesped')[0].donde, falso.id, 'por id sí se puede adoptar (quien mira lo elige)');

  // Recursos y formatos en lo que viene del eje.
  const malos = [
    'http://malo/x.png', 'https://agram.ikisai.com.malo.org/x.png', 'https://malo.org/x.png', 'arte/../secreto.png', '../x.png', '/etc/x.png', '//malo/x.png',
    'arte//x.png', 'arte\\x.png', 'arte/%2e%2e/x.png', 'javascript:alert(1)', 'data:image/png;base64,AAAA', 'otra/x.png', 'arte/',
  ];
  for (const [i, r] of malos.entries()) assert.equal(recursoAdmitido(r, cabecera()), false, r);
  const buenos = ['arte/casa/ok.png', 'https://agram.ikisai.com/arte/ok.png'];
  for (const r of buenos) assert.equal(recursoAdmitido(r, cabecera()), true, r);
  for (const [i, r] of [...malos, ...buenos].entries()) await ancla('casa', pieza1([r], 'image', 1 + (i % 9)));
  await ancla('casa', [['fondo'], [2, 'html'], [7], ['centro'], ['once', 1], [1], ['arte/casa/pagina.html']]);
  await ancla('casa', [['fondo'], [2, 'html'], [8], ['centro'], ['once', 1], [1]]);
  await conModelo(eje, 'huesped', propio.id, '2026-11-07T18:05:00Z');
  cadena = modelo(eje, 'huesped');
  const recursos = cadena[0].piezas.map((p) => p.recurso);
  assert.deepEqual(recursos.filter((r) => r !== null).sort(), ['arte/casa/fondo-3.png', 'arte/casa/ok.png', 'https://agram.ikisai.com/arte/ok.png'].sort(), 'solo lo acotado entra');
  assert.ok(cadena[0].piezas.every((p) => p.formato !== 'html' && p.forma !== 'html'), 'el formato html no entra');
  assert.ok(!cadena[0].piezas.some((p) => String(p.recurso).endsWith('.html')), 'la pieza html se descarta');
  assert.equal(fondo(cadena, 8).recurso, 'https://agram.ikisai.com/arte/ok.png', 'la pieza html sin recurso del paso 8 tampoco entra: responde la inferior');
  // Lo mismo con una pieza referenciada desde el registro del modelo del eje.
  const referida = await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t: T, movimientos: [minuto('casa')], payload: pieza1(['http://malo/x.png'], 'image', 5) });
  const conRef = await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t: T, movimientos: [minuto('casa')], payload: [['con-ref', 'ilustrado'], [{ ref: referida.id }]] });
  await conModelo(eje, 'huesped', conRef.id);
  cadena = modelo(eje, 'huesped');
  assert.equal(cadena[0].piezas.length, 0, 'la pieza referenciada del eje con URL ajena se descarta');
  assert.equal(fondo(cadena, 5).modelo, 'sobrio');
  // La lista blanca es un dato de la cabecera de la época; lo de la época no pasa por este filtro.
  assert.deepEqual(cabecera().origenes, ['https://agram.ikisai.com']);
  const sinLista = epocaCon((e) => { e[9][7][0][9] = [e[9][7][0][9][0]]; });
  assert.deepEqual(cabecera({ epoca: sinLista }).origenes, []);
  assert.equal(recursoAdmitido('https://agram.ikisai.com/x.svg', cabecera({ epoca: sinLista })), false, 'sin orígenes, ninguna URL');
  assert.equal(modelosDeLaEpoca().find((m) => m.nombre === 'animado-generico').piezas.length, 7);
});
