import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { validez, CAPAS, ESTADOS_CAPA, estadoDeBql, SIN_ACREDITAR } from '../src/validez.js';
import { consolidar, autorizar, ejecutar, estadoDe, FABRICA } from '../src/motor.js';
import { serializar, restaurar } from '../src/persistencia.js';
import { generarClaves, firmar } from '../src/autoridad.js';
import { crearEvento } from '../src/evento.js';
import { PV, EPOCA_0 } from '../src/epocas.js';

const T = '2026-11-07T16:00:00Z';
const gastaT = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
const estados = (v) => v.capas.map((c) => c.estado);
const salvo = (v, n) => v.capas.filter((c) => c.capa !== n).map((c) => c.estado);
const TODO_OK = ['ok', 'ok', 'ok', 'ok', 'ok'];

test('la compra del ejemplo: cinco capas independientes, cada una con estado y motivos, sin veredicto global', async () => {
  const { eje, compra } = await ejemploCompra();
  const v = await validez(eje, compra.id);
  assert.equal(v.id, compra.id);
  assert.equal(v.enEje, true);
  assert.equal(v.epoca, 'época 0');
  assert.deepEqual(v.capas.map((c) => c.capa), [1, 2, 3, 4, 5]);
  assert.deepEqual(v.capas.map((c) => c.nombre), CAPAS.map((c) => c.nombre));
  for (const c of v.capas) {
    assert.ok(ESTADOS_CAPA.includes(c.estado), c.nombre);
    assert.ok(Array.isArray(c.motivos));
    assert.equal(typeof c.resumen, 'string');
  }
  assert.deepEqual(estados(v), TODO_OK);
  // Ni «válido» ni puntuación: el resultado no tiene un estado propio.
  assert.equal(v.estado, undefined);
  assert.equal(v.valido, undefined);
  assert.equal(v.resumen.split('\n').length, 5);
  assert.equal(v.forma, v.capas[0]);
  assert.equal(v.permiso, v.capas[4]);
  // Señales de cada capa.
  assert.equal(v.forma.profundidad, 2);
  assert.equal(v.interpretacion.resumen, 'sin fórmulas: literales y referencias');
  assert.equal(v.criptografia.idCorrecto, true);
  assert.equal(v.criptografia.firma, 'sin firma'); // sin claves: huesped no tiene clave
  assert.deepEqual(v.criptografia.referencias.map((r) => r.estado), ['ok', 'ok']);
  assert.deepEqual(v.acreditacion.movimientos.map((m) => m.clave), ['T:hora', 'E:casa/EUR']);
  assert.equal(v.acreditacion.externa, SIN_ACREDITAR);
  assert.equal(v.permiso.motor, null);
  assert.match(v.permiso.resumen, /no es consolidación, autorización ni ejecución/);
});

test('todos los registros del ejemplo, génesis y cuenta incluidos, en ok; las fórmulas de la cuenta, resueltas', async () => {
  const { eje, compra } = await ejemploCompra();
  const cuenta = await ejemploCuenta(eje, compra);
  for (const id of eje.orden) assert.deepEqual(estados(await validez(eje, id)), TODO_OK, id.slice(0, 8));
  const v = await validez(eje, cuenta.id);
  assert.deepEqual(v.interpretacion.formulas.map((f) => [f.dir, f.estado]), [['1000000000', 'RESUELTO'], ['2000000000', 'RESUELTO']]);
  assert.equal(v.interpretacion.formulas[0].texto, '14 EUR (12 EUR + 2 EUR)');
  const g = await validez(eje, eje.genesisId);
  assert.match(g.permiso.resumen, /génesis: emite por convención/);
  assert.match(g.criptografia.resumen, /génesis/);
});

test('sin efectos: ni el eje ni el evento cambian', async () => {
  const { eje, compra } = await ejemploCompra();
  const antes = JSON.stringify({ orden: eje.orden, saldos: eje.identidades().map((id) => [id, eje.tiempos(id), eje.recursos(id), eje.poderes(id)]), compra });
  await validez(eje, compra.id);
  await validez(eje, { ...compra, payload: ['otra cosa'] });
  assert.equal(JSON.stringify({ orden: eje.orden, saldos: eje.identidades().map((id) => [id, eje.tiempos(id), eje.recursos(id), eje.poderes(id)]), compra }), antes);
});

test('referencia a un id ausente: la procedencia queda pendiente y las otras cuatro capas no se enteran', async () => {
  const { eje, compra, menu } = await ejemploCompra();
  const nota = await eje.escribir({
    autor: 'cocina', sobre: compra.id, t: T, movimientos: [gastaT('cocina')],
    payload: ['Nota', { ref: 'f'.repeat(64) }, { ref: menu.id, dir: '7000000000' }],
  });
  const v = await validez(eje, nota.id);
  assert.equal(v.criptografia.estado, 'pendiente'); // corpus V4: referencia ausente → PENDIENTE, puede llegar
  assert.deepEqual(v.criptografia.referencias.map((r) => r.estado), ['pendiente', 'pendiente']);
  assert.match(v.criptografia.motivos[0], /^1: referencia a un evento ausente del eje: ffffffff/);
  assert.match(v.criptografia.motivos[1], /^2: posición sin desarrollar/);
  assert.deepEqual(salvo(v, 3), ['ok', 'ok', 'ok', 'ok']);
  // Un borrador cuyo foco no está en el eje: también pendiente, no falla.
  const huerfano = await crearEvento({ autor: 'cocina', sobre: 'a'.repeat(64), t: T, movimientos: [gastaT('cocina')], payload: 'x' });
  const h = await validez(eje, huerfano);
  assert.equal(h.enEje, false);
  assert.deepEqual(estados(h), ['ok', 'ok', 'pendiente', 'ok', 'ok']);
  assert.match(h.criptografia.motivos.join(' '), /foco ausente del eje: aaaaaaaa/);
});

test('firma quitada tras restaurar: falla la capa 3 y solo ella', async () => {
  const claves = { casa: await generarClaves(), cocina: await generarClaves(), huesped: await generarClaves() };
  const { eje, compra } = await ejemploCompra({ claves });
  const otro = await restaurar(JSON.parse(JSON.stringify(serializar(eje))));
  const firmada = await validez(otro, compra.id);
  assert.deepEqual(estados(firmada), TODO_OK);
  assert.equal(firmada.criptografia.firma, 'verificada');
  // El eje no admite el guardado sin la firma; las capas dicen cuál de ellas cae.
  const roto = JSON.parse(JSON.stringify(serializar(eje)));
  delete roto.eventos[3].firma;
  await assert.rejects(restaurar(roto), /firma ausente de huesped/);
  const { firma, firmante, ...sinFirma } = otro.obtener(compra.id);
  void firma; void firmante;
  const v = await validez(otro, sinFirma);
  assert.equal(v.enEje, true); // el mismo id: se lee en su lugar del eje
  assert.equal(v.criptografia.estado, 'falla');
  assert.equal(v.criptografia.firma, 'ausente');
  assert.match(v.criptografia.motivos[0], /firma ausente de huesped/);
  assert.deepEqual(salvo(v, 3), salvo(firmada, 3));
  // Una firma no es veracidad: con ella, la capa 4 no dice que la compra ocurriera.
  assert.equal(firmada.acreditacion.externa, SIN_ACREDITAR);
});

test('una firma no es veracidad: firmado y verificado, sin respaldo en el libro', async () => {
  const claves = { casa: await generarClaves(), cocina: await generarClaves(), huesped: await generarClaves() };
  const { eje, compra } = await ejemploCompra({ claves });
  const borrador = await firmar(await crearEvento({
    autor: 'huesped', sobre: compra.id, t: T,
    movimientos: [gastaT('huesped'), { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 100, de: 'huesped', a: 'cocina' }],
    payload: 'pago de cien euros que no tengo',
  }), claves.huesped.privada);
  const v = await validez(eje, borrador);
  assert.equal(v.enEje, false);
  assert.equal(v.criptografia.estado, 'ok');
  assert.equal(v.criptografia.firma, 'verificada');
  assert.equal(v.acreditacion.estado, 'falla');
  assert.match(v.acreditacion.motivos[0], /saldo de E:casa\/EUR en huesped: tiene 48, mueve 100/);
  assert.deepEqual(estados(v), ['ok', 'ok', 'ok', 'falla', 'ok']);
  await assert.rejects(eje.anadir(borrador), /saldo insuficiente/);
});

test('acreditación y permiso no se confunden: serie sin emitir, emisión ajena, tokens ajenos', async () => {
  const { eje, compra } = await ejemploCompra();
  const borrador = (autor, movimientos) => crearEvento({ autor, sobre: compra.id, t: T, movimientos: [gastaT(autor), ...movimientos], payload: 'x' });
  // Cocina paga con euros suyos que nunca emitió: nada los respalda (capa 4); moverlos sí es cosa suya (capa 5).
  const sinSerie = await validez(eje, await borrador('cocina', [{ token: 'E', emisor: 'cocina', denominacion: 'EUR', cantidad: 1, de: 'cocina', a: 'huesped' }]));
  assert.deepEqual(estados(sinSerie), ['ok', 'ok', 'ok', 'falla', 'ok']);
  assert.match(sinSerie.acreditacion.motivos[0], /la serie E:cocina\/EUR no se ha emitido/);
  // Huesped (persona, puede emitir) emite euros de la casa: la serie no la respalda su emisor (capa 4).
  const ajena = await validez(eje, await borrador('huesped', [{ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 1, de: null, a: 'casa' }]));
  assert.deepEqual(estados(ajena), ['ok', 'ok', 'ok', 'falla', 'ok']);
  assert.match(ajena.acreditacion.motivos[0], /es de casa y la emite huesped/);
  // Huesped mueve euros de la casa: hay respaldo (la casa los tiene), no hay permiso (capa 5).
  const robo = await validez(eje, await borrador('huesped', [{ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 1, de: 'casa', a: 'huesped' }]));
  assert.deepEqual(estados(robo), ['ok', 'ok', 'ok', 'ok', 'falla']);
  assert.match(robo.permiso.motivos[0], /nadie mueve tokens ajenos: casa no es el autor/);
  // Cocina emite más T: la serie es de la casa (capa 4) y solo el génesis emite T (capa 5).
  const t = await validez(eje, await borrador('cocina', [{ token: 'T', escala: 'minuto', cantidad: 5, de: null, a: 'cocina' }]));
  assert.deepEqual(estados(t), ['ok', 'ok', 'ok', 'falla', 'falla']);
  assert.match(t.permiso.motivos[0], /solo el génesis emite T/);
});

test('P delegado: el libro se rehace en el lugar del registro y el poder alcanza para autorizar', async () => {
  const { eje, compra } = await ejemploCompra();
  const delega = await eje.escribir({ autor: 'casa', sobre: compra.id, t: T, movimientos: [gastaT('casa'), { token: 'P', ambito: compra.id, cantidad: 1, de: 'casa', a: 'cocina' }], payload: 'cocina autoriza lo de esta compra' });
  assert.deepEqual(estados(await validez(eje, delega.id)), TODO_OK);
  // Cocina no puede delegar más P del que tiene.
  const demasiado = await crearEvento({ autor: 'cocina', sobre: compra.id, t: T, movimientos: [gastaT('cocina'), { token: 'P', ambito: compra.id, cantidad: 5, de: 'cocina', a: 'huesped' }], payload: 'x' });
  const v = await validez(eje, demasiado);
  assert.deepEqual(estados(v), ['ok', 'ok', 'ok', 'falla', 'ok']);
  assert.match(v.acreditacion.motivos[0], /P insuficiente en cocina/);
  // Con P sobre la compra, cocina puede autorizar lo que se consolide sobre ella.
  const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: 'dos menús' } });
  assert.deepEqual((await validez(eje, c.id)).permiso.motor.puedenAutorizar, ['casa', 'cocina']);
  // Los registros anteriores siguen en ok: cada uno se lee con el libro de su momento.
  for (const id of eje.orden) assert.equal((await validez(eje, id)).acreditacion.estado, 'ok');
});

test('fórmula pendiente: la interpretación queda pendiente y las otras capas no se enteran', async () => {
  const { eje, compra } = await ejemploCompra();
  const cuenta = await eje.escribir({ autor: 'cocina', sobre: compra.id, en: '1000000000', t: T, movimientos: [gastaT('cocina')], payload: ['Cuenta a medias', '=LOCAL(5) + 2 EUR'] });
  const v = await validez(eje, cuenta.id);
  assert.equal(v.interpretacion.estado, 'pendiente');
  assert.equal(v.interpretacion.formulas[0].estado, 'PENDIENTE');
  assert.match(v.interpretacion.motivos[0], /^1: PENDIENTE: posición sin desarrollar/);
  assert.deepEqual(salvo(v, 2), ['ok', 'ok', 'ok', 'ok']);
});

test('fórmula imposible: la interpretación no queda en ok, y la procedencia sí (una fórmula no es una referencia BTML)', async () => {
  const { eje, compra } = await ejemploCompra();
  const cuenta = await eje.escribir({
    autor: 'cocina', sobre: compra.id, en: '1000000000', t: T, movimientos: [gastaT('cocina')],
    payload: ['Cuenta rota', '=REF("ffffffff", "1200000000") + 2 EUR', '="propina" + 2 EUR'],
  });
  const v = await validez(eje, cuenta.id);
  const [ref, tipos] = v.interpretacion.formulas;
  assert.ok(['ERROR', 'PENDIENTE'].includes(ref.estado)); // referencia desconocida en BQL
  assert.equal(tipos.estado, 'INCOMPATIBLE');
  assert.equal(tipos.capa, 'falla');
  assert.deepEqual(estados(v), ['ok', 'falla', 'ok', 'ok', 'ok']);
  assert.deepEqual(estadoDeBql('PENDIENTE POR LÍMITE'), 'pendiente');
  assert.deepEqual(estadoDeBql('PENDIENTE DE AUTORIZACIÓN'), 'pendiente');
  assert.deepEqual(estadoDeBql('ERROR'), 'falla');
});

test('consolidación sin autorizar: permiso pendiente, quién puede autorizar y lo escrito que no cuenta', async () => {
  const { eje, compra } = await ejemploCompra();
  const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, titulo: 'Pago del menú', elecciones: { 1: 'dos menús', 4: 'pagar 14 EUR' } });
  let v = await validez(eje, c.id);
  assert.deepEqual(estados(v), ['ok', 'ok', 'ok', 'ok', 'pendiente']);
  assert.equal(v.permiso.motor.estadoMotor, 'PENDIENTE DE AUTORIZACIÓN');
  assert.deepEqual(v.permiso.motor.puedenAutorizar, ['casa']);
  assert.match(v.permiso.motivos[0], /pueden autorizar: casa \(regla V0\)/);

  // Cocina escribe a mano «autorizado» sin poder: el escrito existe, entra en el eje y no cuenta.
  const falso = await eje.escribir({ autor: 'cocina', sobre: c.id, en: FABRICA, t: T, movimientos: [gastaT('cocina')], payload: '==autorizo', contexto: { fase: 'autorizado' } });
  const f = await validez(eje, falso.id);
  assert.deepEqual(estados(f), ['ok', 'ok', 'ok', 'ok', 'falla']);
  assert.match(f.permiso.motivos[0], /cocina no tiene poder \(P\) sobre este registro/);
  assert.equal(f.permiso.motor.cuenta, false);
  v = await validez(eje, c.id);
  assert.equal(v.permiso.estado, 'pendiente');
  assert.deepEqual(v.permiso.motor.noCuentan.map((a) => a.autor), ['cocina']);

  // Autoriza la casa: autorizado aún no es ejecutado.
  const a = await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: T });
  assert.deepEqual(estados(await validez(eje, a.id)), TODO_OK);
  v = await validez(eje, c.id);
  assert.deepEqual(estados(v), ['ok', 'ok', 'ok', 'ok', 'pendiente']);
  assert.equal(v.permiso.motor.estadoMotor, 'AUTORIZADO');
  assert.match(v.permiso.motivos[0], /AUTORIZADO por casa · falta ejecutar/);

  // Ejecuta el autor, con evidencia: la capa 5 en ok, y los efectos externos siguen sin confirmar.
  const e = await ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: T, movimientos: [{ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 14, de: 'huesped', a: 'cocina' }] });
  v = await validez(eje, c.id);
  assert.deepEqual(estados(v), TODO_OK);
  assert.equal(v.permiso.motor.estadoMotor, 'EJECUTADO');
  assert.match(v.permiso.resumen, /externa: sin confirmar/);
  assert.match(v.acreditacion.resumen, /externa: sin acreditar/);
  const ve = await validez(eje, e.id);
  assert.deepEqual(estados(ve), TODO_OK);
  assert.equal(ve.permiso.motor.cuenta, true);
  assert.deepEqual(ve.criptografia.referencias.filter((r) => r.desde === 'contexto.evidencia').map((r) => r.ref), [c.id, a.id]);
});

test('un «ejecutado» a mano sin autorización: el motor dice EJECUTADO y la capa 5 falla (MOTOR.md §13.2)', async () => {
  const { eje, compra } = await ejemploCompra();
  const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: 'tres menús' } });
  const aMano = await eje.escribir({ autor: 'huesped', sobre: c.id, en: FABRICA, t: T, movimientos: [gastaT('huesped')], payload: 'a mano', contexto: { fase: 'ejecutado' } });
  assert.equal(estadoDe(eje, c.id), 'EJECUTADO');
  const v = await validez(eje, c.id);
  assert.equal(v.permiso.estado, 'falla');
  assert.match(v.permiso.motivos[0], /ninguna ejecución lleva en su evidencia una autorización válida/);
  const r = await validez(eje, aMano.id);
  assert.deepEqual(estados(r), ['ok', 'ok', 'ok', 'ok', 'falla']);
  assert.match(r.permiso.motivos[0], /su evidencia no incluye una autorización válida/);
});

test('id que no corresponde al cuerpo: falla la capa 3; la forma sigue en ok', async () => {
  const { eje, compra } = await ejemploCompra();
  const v = await validez(eje, { ...compra, payload: ['Compra de otro menú'] });
  assert.equal(v.criptografia.idCorrecto, false);
  assert.equal(v.criptografia.estado, 'falla');
  assert.match(v.criptografia.motivos[0], /el id no corresponde al cuerpo/);
  assert.deepEqual(estados(v), ['ok', 'ok', 'falla', 'ok', 'ok']);
});

test('la época está fuera del dato: el mismo registro, legible bajo la época 0 y no bajo otra', async () => {
  const { eje, compra } = await ejemploCompra();
  const soloRaiz = { nombre: 'época de prueba', reglaCorta: (p, d) => (p === 0 ? PV[d] : undefined) };
  const bajo0 = await validez(eje, compra.id, { epoca: EPOCA_0 });
  const bajoOtra = await validez(eje, compra.id, { epoca: soloRaiz });
  assert.equal(bajoOtra.epoca, 'época de prueba');
  assert.equal(bajoOtra.forma.estado, 'pendiente');
  assert.match(bajoOtra.forma.motivos[0], /sin regla corta en época de prueba para 1\.0/);
  assert.deepEqual(salvo(bajoOtra, 1), salvo(bajo0, 1));
  assert.deepEqual(bajo0.forma.lectura.en, []); // la compra se anida en la raíz
  await assert.rejects(validez(eje, compra.id, { epoca: {} }), /regla corta/);
});

test('más de diez profundidades: el eje lo admite y la capa 1 falla', async () => {
  const { eje, compra } = await ejemploCompra();
  let hondo = 'hoja';
  for (let i = 0; i < 11; i++) hondo = [hondo];
  const ev = await eje.escribir({ autor: 'cocina', sobre: compra.id, t: T, movimientos: [gastaT('cocina')], payload: hondo });
  const v = await validez(eje, ev.id);
  assert.equal(v.forma.estado, 'falla');
  assert.equal(v.forma.profundidad, 11);
  assert.match(v.forma.motivos[0], /más de diez profundidades/);
  assert.deepEqual(salvo(v, 1), ['ok', 'ok', 'ok', 'ok']);
});

test('un registro desconocido o malformado no tumba nada: lo que no se puede comprobar, falla', async () => {
  const { eje } = await ejemploCompra();
  await assert.rejects(validez(eje, 'nadie'), /registro desconocido/);
  const v = await validez(eje, { autor: 'cocina', payload: ['a', null], movimientos: 'muchos' });
  assert.equal(v.id, '(sin id)');
  assert.equal(v.forma.estado, 'falla');
  assert.equal(v.criptografia.estado, 'falla');
  assert.equal(v.acreditacion.estado, 'pendiente');
  for (const c of v.capas) assert.ok(ESTADOS_CAPA.includes(c.estado));
});
