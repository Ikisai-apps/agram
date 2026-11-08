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
  // Por hojas (VG, 7-11 noche): compra 1.0 = [menú] es una lista; el índice de un ocupante no es una profundidad.
  assert.equal(v.forma.profundidad, 2);
  assert.equal(v.interpretacion.resumen, 'sin fórmulas · 2 de 2 referencias resuelven');
  assert.deepEqual(v.interpretacion.referencias.map((r) => r.estado), ['ok', 'ok']); // las referencias son de la capa 2
  assert.equal(v.criptografia.referencias, undefined);
  assert.equal(v.criptografia.idCorrecto, true);
  assert.equal(v.criptografia.firma, 'sin firma'); // sin claves: huesped no tiene clave
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

test('referencia a un id ausente: la interpretación queda pendiente y las otras cuatro capas no se enteran', async () => {
  const { eje, compra, menu } = await ejemploCompra();
  const nota = await eje.escribir({
    autor: 'cocina', sobre: compra.id, t: T, movimientos: [gastaT('cocina')],
    payload: ['Nota', { ref: 'f'.repeat(64) }, { ref: menu.id, dir: '7000000000' }],
  });
  const v = await validez(eje, nota.id);
  // Corpus: la capa 2 es «interpretación de contexto, referencias y posiciones» (V4 06 l.36); ausente → PENDIENTE, puede llegar.
  assert.equal(v.interpretacion.estado, 'pendiente');
  assert.deepEqual(v.interpretacion.referencias.map((r) => r.estado), ['pendiente', 'pendiente']);
  assert.match(v.interpretacion.motivos[0], /^1: referencia a un evento ausente del eje: ffffffff/);
  assert.match(v.interpretacion.motivos[1], /^2: posición sin desarrollar/);
  assert.deepEqual(salvo(v, 2), ['ok', 'ok', 'ok', 'ok']);
  // Un borrador cuyo foco no está en el eje: la procedencia queda pendiente, no falla.
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
  // Huesped (persona, puede emitir) emite euros de la casa: nadie los respalda (capa 4) y nadie emite en nombre
  // de otro (capa 5, MAPA §12 [D]: «Nadie emite denominación ajena»). Un hecho, dos capas, como con T.
  const ajenaEv = await borrador('huesped', [{ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 1, de: null, a: 'casa' }]);
  const ajena = await validez(eje, ajenaEv);
  assert.deepEqual(estados(ajena), ['ok', 'ok', 'ok', 'falla', 'falla']);
  assert.match(ajena.acreditacion.motivos[0], /es de casa y la emite huesped/);
  assert.match(ajena.permiso.motivos[0], /nadie emite en nombre de otro: casa no es el autor/);
  assert.match((await eje.validar(ajenaEv)).join(' '), /nadie emite en nombre de otro/); // lo mismo que rechaza el eje
  // Huesped mueve euros de la casa: hay respaldo (la casa los tiene), no hay permiso (capa 5).
  const robo = await validez(eje, await borrador('huesped', [{ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 1, de: 'casa', a: 'huesped' }]));
  assert.deepEqual(estados(robo), ['ok', 'ok', 'ok', 'ok', 'falla']);
  assert.match(robo.permiso.motivos[0], /nadie mueve tokens ajenos: casa no es el autor/);
  // VG, 8-11: asignación diaria. Nadie emite T fuera del génesis: cada persona tiene, cada día, todo su T.
  // Cocina (una cosa de la casa, Core 8-11) emite T: solo las personas emiten (capa 5).
  const t = await validez(eje, await borrador('cocina', [{ token: 'T', escala: 'minuto', cantidad: 5, de: null, a: 'cocina' }]));
  assert.deepEqual(estados(t), ['ok', 'ok', 'ok', 'ok', 'falla']);
  assert.match(t.permiso.motivos[0], /solo las personas emiten: cocina es cosa/);
  // Huesped (persona) tampoco emite T: no se emite (capa 5).
  const emite = await validez(eje, await borrador('huesped', [{ token: 'T', escala: 'hora', cantidad: 1, de: null, a: 'huesped' }]));
  assert.deepEqual(estados(emite), ['ok', 'ok', 'ok', 'ok', 'falla']);
  assert.match(emite.permiso.motivos.join(' '), /T no se emite: ni el génesis; cada persona tiene su asignación del día/);
  // Gasta más horas de las que le quedan del día: no hay respaldo (capa 4); el permiso sí (capa 5).
  const horas = await validez(eje, await borrador('huesped', [{ token: 'T', escala: 'hora', cantidad: 25, de: 'huesped', a: null }]));
  assert.deepEqual(estados(horas), ['ok', 'ok', 'ok', 'falla', 'ok']);
  assert.match(horas.acreditacion.motivos[0], /T del día agotado \(hora\): quedan \d+/);
  assert.doesNotMatch(horas.acreditacion.resumen, /respaldados/);
  // Lo que le queda del día, sí: una hora y la parte del año de hoy (una escala que el génesis nunca emitió).
  assert.equal(eje.serie('T:anio').emitido, 0);
  const anio = await validez(eje, await borrador('huesped', [{ token: 'T', escala: 'hora', cantidad: 1, de: 'huesped', a: null }, { token: 'T', escala: 'anio', cantidad: 1, de: 'huesped', a: null }]));
  assert.deepEqual(estados(anio), TODO_OK);
  // P sobre todo el eje fuera del génesis: sin respaldo (capa 4) y sin R propia en juego (capa 5).
  const p = await validez(eje, await borrador('huesped', [{ token: 'P', ambito: 'genesis', cantidad: 1, de: null, a: 'huesped' }]));
  assert.deepEqual(estados(p), ['ok', 'ok', 'ok', 'falla', 'falla']);
  assert.match(p.acreditacion.motivos[0], /P sobre todo el eje \(«genesis»\) solo lo emite el génesis/);
  assert.match(p.permiso.motivos[0], /emitir P exige R propia en juego: R:huesped bloqueada como colateral/);
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
  // VG, 7-11 noche: autorizar = bloquear P sobre el registro del recurso (VG, 8-11: nadie en el hilo tiene P propio
  // emitido, así que es el génesis y cuenta el P del eje). El P de cocina sobre la compra no es ese, y el autor cuenta como cualquiera:
  // a las dos consolidaciones las puede autorizar la casa, también a la suya.
  const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: 'dos menús' } });
  assert.deepEqual((await validez(eje, c.id)).permiso.motor.puedenAutorizar, ['casa']);
  const deLaCasa = await consolidar(eje, { autor: 'casa', foco: compra.id, t: T, elecciones: { 1: 'otro menú' } });
  assert.deepEqual((await validez(eje, deLaCasa.id)).permiso.motor.puedenAutorizar, ['casa']);
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

test('una referencia ausente da lo mismo escrita como { ref } o como =REF: pendiente, en la capa 2', async () => {
  const { eje, compra } = await ejemploCompra();
  const escribir = (payload) => eje.escribir({ autor: 'cocina', sobre: compra.id, en: '1000000000', t: T, movimientos: [gastaT('cocina')], payload });
  const comoFormula = await validez(eje, (await escribir(['Cuenta', '=REF("ffffffff", "1200000000") + 2 EUR'])).id);
  const comoRef = await validez(eje, (await escribir(['Cuenta', { ref: 'f'.repeat(64), dir: '1200000000' }])).id);
  const [f] = comoFormula.interpretacion.formulas;
  assert.equal(f.estado, 'PENDIENTE'); // BQL: «referencia ausente del eje» (lo ausente no es falso)
  assert.equal(f.capa, 'pendiente');
  assert.match(comoFormula.interpretacion.motivos[0], /^1: PENDIENTE: referencia ausente del eje: ffffffff/);
  assert.match(comoRef.interpretacion.motivos[0], /^1: referencia a un evento ausente del eje: ffffffff/);
  assert.deepEqual(estados(comoFormula), ['ok', 'pendiente', 'ok', 'ok', 'ok']);
  assert.deepEqual(estados(comoRef), estados(comoFormula));
});

test('fórmula imposible: la interpretación falla y las otras capas no se enteran', async () => {
  const { eje, compra } = await ejemploCompra();
  const cuenta = await eje.escribir({
    autor: 'cocina', sobre: compra.id, en: '1000000000', t: T, movimientos: [gastaT('cocina')],
    payload: ['Cuenta rota', '="propina" + 2 EUR'],
  });
  const v = await validez(eje, cuenta.id);
  const [tipos] = v.interpretacion.formulas;
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
  assert.match(v.permiso.motivos[0], /pueden autorizar: casa · 0 de 10 P del eje bloqueado; umbral: más de la mitad/);

  // Cocina escribe a mano «autorizado» sin bloquear P: el escrito existe, entra en el eje y no cuenta.
  const falso = await eje.escribir({ autor: 'cocina', sobre: c.id, en: FABRICA, t: T, movimientos: [gastaT('cocina')], payload: '==autorizo', contexto: { fase: 'autorizado' } });
  const f = await validez(eje, falso.id);
  assert.deepEqual(estados(f), ['ok', 'ok', 'ok', 'ok', 'falla']);
  assert.match(f.permiso.motivos[0], /cocina no bloquea P que cuente para autorizar/);
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
  assert.match(v.permiso.motivos[0], /AUTORIZADO por casa \(10 de 10 P del eje bloqueado; umbral: más de la mitad\) · falta ejecutar/);

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
  assert.deepEqual(ve.interpretacion.referencias.filter((r) => r.desde === 'contexto.evidencia').map((r) => r.ref), [c.id, a.id]);
});

test('un «ejecutado» a mano sin autorización: el motor dice EJECUTADO y la capa 5 falla (MOTOR.md §13.2)', async () => {
  const { eje, compra } = await ejemploCompra();
  const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: 'tres menús' } });
  const aMano = await eje.escribir({ autor: 'huesped', sobre: c.id, en: FABRICA, t: T, movimientos: [gastaT('huesped')], payload: 'a mano', contexto: { fase: 'ejecutado' } });
  assert.equal(estadoDe(eje, c.id), 'EJECUTADO');
  const v = await validez(eje, c.id);
  assert.equal(v.permiso.estado, 'falla');
  assert.match(v.permiso.motivos[0], /ninguna ejecución se hizo con la consolidación AUTORIZADA/);
  const r = await validez(eje, aMano.id);
  assert.deepEqual(estados(r), ['ok', 'ok', 'ok', 'ok', 'falla']);
  assert.match(r.permiso.motivos[0], /al ejecutar no estaba AUTORIZADA \(0 de 10 P del eje bloqueado; umbral: más de la mitad\): ejecutar exige autorización/);
});

test('id que no corresponde al cuerpo: falla la capa 3, y la copia no se lee como el registro del eje', async () => {
  const { eje, compra } = await ejemploCompra();
  const v = await validez(eje, { ...compra, payload: ['Compra de otro menú'] });
  assert.equal(v.enEje, false); // el mismo id con otro cuerpo no es ese registro
  assert.equal(v.criptografia.idCorrecto, false);
  assert.equal(v.criptografia.estado, 'falla');
  assert.match(v.criptografia.motivos[0], /el id no corresponde al cuerpo/);
  assert.deepEqual(estados(v), ['ok', 'ok', 'falla', 'ok', 'ok']);
  // La compra manipulada para pasar por consolidación: la capa 5 la lee como borrador, no dice lo del registro real.
  const comoConsolidacion = await validez(eje, { ...compra, contexto: { ...compra.contexto, fase: 'consolidado' } });
  assert.equal(comoConsolidacion.enEje, false);
  assert.match(comoConsolidacion.permiso.motivos[0], /PENDIENTE DE AUTORIZACIÓN \(no está en el eje: se lee como borrador\)/);
  // Una consolidación autorizada, manipulada: el motor del eje dice AUTORIZADO de la real, no de la copia.
  const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: 'dos menús' } });
  await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: T });
  assert.equal((await validez(eje, c.id)).permiso.motor.estadoMotor, 'AUTORIZADO');
  const copia = await validez(eje, { ...eje.obtener(c.id), payload: ['Pago de diez menús'] });
  assert.equal(copia.enEje, false);
  assert.equal(copia.permiso.motor.estadoMotor, 'PENDIENTE DE AUTORIZACIÓN');
  assert.deepEqual(copia.permiso.motor.autorizaciones, []);
  assert.match(copia.permiso.resumen, /no está en el eje: se lee como borrador/);
  assert.equal(copia.criptografia.estado, 'falla');
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

test('más de diez profundidades: no es fallo de forma; la capa 2 da lo mismo que BQL en main', async () => {
  const { eje, compra } = await ejemploCompra();
  let hondo = 'hoja';
  // VG, 7-11 noche: por hojas. El array más hondo, ['hoja'], es una lista y no añade profundidad: hacen falta doce.
  for (let i = 0; i < 12; i++) hondo = [hondo];
  const ev = await eje.escribir({ autor: 'cocina', sobre: compra.id, t: T, movimientos: [gastaT('cocina')], payload: hondo });
  const v = await validez(eje, ev.id);
  // Auditoría l.299: «El límite es de posicionamiento por foco, no de forma». [X] docs/VALIDEZ.md §8.
  assert.equal(v.forma.estado, 'ok');
  assert.equal(v.forma.profundidad, 11);
  assert.equal(v.interpretacion.estado, 'pendiente');
  assert.match(v.interpretacion.motivos[0], /más de diez profundidades en .*posición sin desarrollar/);
  assert.deepEqual(estados(v), ['ok', 'pendiente', 'ok', 'ok', 'ok']);
  // BQL en main: el mismo estado para un camino de más de diez índices (sin una tercera respuesta).
  const bql = await validez(eje, (await eje.escribir({ autor: 'cocina', sobre: compra.id, t: T, movimientos: [gastaT('cocina')], payload: ['x', '=LOCAL(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1)'] })).id);
  assert.equal(bql.interpretacion.formulas[0].estado, 'PENDIENTE');
  assert.match(bql.interpretacion.formulas[0].texto, /más de diez profundidades/);
});

test('firma que no se puede verificar: pendiente solo si la clave aún puede llegar', async () => {
  const { eje, compra } = await ejemploCompra(); // sin claves
  const otra = await generarClaves();
  // Cocina ya tiene alta y no tiene clave: el eje no deja añadírsela («no se puede cambiar la clave»). Cuenta como sin firma (G1).
  const deCocina = await firmar(await crearEvento({ autor: 'cocina', sobre: compra.id, t: T, movimientos: [gastaT('cocina')], payload: 'x' }), otra.privada);
  const v = await validez(eje, deCocina);
  assert.equal(v.criptografia.firma, 'sin verificar');
  assert.equal(v.criptografia.estado, 'ok');
  assert.deepEqual(await eje.validar(deCocina), []); // el eje la admite
  // Un autor sin alta: su clave puede llegar con el alta y entonces se verificaría.
  const deNadie = await firmar(await crearEvento({ autor: 'nadie', sobre: compra.id, t: T, movimientos: [gastaT('nadie')], payload: 'x' }), otra.privada);
  const n = await validez(eje, deNadie);
  assert.equal(n.criptografia.estado, 'pendiente');
  assert.match(n.criptografia.motivos.join(' '), /aún no tiene alta: su clave puede llegar con ella/);
});

test('un registro desconocido o malformado no tumba nada: lo que no se puede comprobar, falla', async () => {
  const { eje, compra } = await ejemploCompra();
  await assert.rejects(validez(eje, 'nadie'), /registro desconocido/);
  const v = await validez(eje, { autor: 'cocina', payload: ['a', null], movimientos: 'muchos' });
  assert.equal(v.id, '(sin id)');
  assert.equal(v.forma.estado, 'falla');
  assert.equal(v.criptografia.estado, 'falla');
  // El evento no cambia: lo que no se puede comprobar no llegará nunca. No es pendiente.
  assert.equal(v.acreditacion.estado, 'falla');
  assert.match(v.acreditacion.motivos[0], /sin movimientos: no hay respaldo que comprobar/);
  for (const c of v.capas) assert.ok(ESTADOS_CAPA.includes(c.estado));
  const bien = await crearEvento({ autor: 'cocina', sobre: compra.id, t: T, movimientos: [gastaT('cocina')], payload: 'x' });
  const malMovido = await validez(eje, { ...bien, movimientos: [gastaT('cocina'), { token: 'X', cantidad: 1, de: 'cocina', a: null }] });
  assert.equal(malMovido.forma.estado, 'falla');
  assert.equal(malMovido.acreditacion.estado, 'falla');
  assert.match(malMovido.acreditacion.motivos[0], /movimiento 1: mal formado \(capa 1\): su respaldo no se puede comprobar/);
});
