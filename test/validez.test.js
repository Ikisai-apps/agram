import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { validez, CAPAS, ESTADOS_CAPA, estadoDeBql, SIN_ACREDITAR } from '../src/validez.js';
import { consolidar, cerrado, siguiente, FABRICA, ANUNCIO } from '../src/motor.js';
import { serializar, restaurar } from '../src/persistencia.js';
import { generarClaves, firmar } from '../src/autoridad.js';
import { crearEvento } from '../src/evento.js';
import { PV, EPOCA_0 } from '../src/epocas.js';

const T = '2026-11-07T16:00:00Z';
const gastaT = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
const estados = (v) => v.capas.map((c) => c.estado);
const salvo = (v, n) => v.capas.filter((c) => c.capa !== n).map((c) => c.estado);
const TODO_OK = ['ok', 'ok', 'ok', 'ok', 'ok'];
/** Un movimiento anunciado en el 4.1 de un registro por su dueño: [[serie], [cuánto], [qué], [[de], [a]]] (motor.ANUNCIO). */
const anuncio = (serie, cantidad, que, de, a) => [[serie], [cantidad], [que], [[de], [a]]];
const CERRADO = 'all announced movements happened';

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
  // Encargo 3b (mapa §15 [D] «Una sola operación: registrar»): la capa 5 ya no lee estados del motor; lee el ciclo, si
  // lo que el registro anuncia ya pasó (N5), con la plantilla de cerrado de su dueño (por defecto, la de la época).
  assert.deepEqual(v.permiso.motor, { cerrado: true, plantilla: CERRADO });
  assert.match(v.permiso.resumen, /^mueve lo suyo · cerrado \(all announced movements happened\) · externa: sin confirmar$/);
});

test('todos los registros del ejemplo, cuenta incluida, en ok; las fórmulas de la cuenta, resueltas', async () => {
  const { eje, compra } = await ejemploCompra();
  const cuenta = await ejemploCuenta(eje, compra);
  for (const id of eje.orden) assert.deepEqual(estados(await validez(eje, id)), TODO_OK, id.slice(0, 8));
  const v = await validez(eje, cuenta.id);
  assert.deepEqual(v.interpretacion.formulas.map((f) => [f.dir, f.estado]), [['1000000000', 'RESUELTO'], ['2000000000', 'RESUELTO']]);
  assert.equal(v.interpretacion.formulas[0].texto, '14 EUR (12 EUR + 2 EUR)');
});

test('el génesis del ejemplo, en ok: la época 0, no mueve nada', async () => {
  const { eje } = await ejemploCompra();
  const g = await validez(eje, eje.genesisId);
  assert.deepEqual(estados(g), TODO_OK);
  assert.match(g.permiso.resumen, /génesis: la época 0, no mueve nada/);
  assert.match(g.criptografia.resumen, /génesis/);
});

test('la invitación del ejemplo, en ok: su referencia a la época 0 se resuelve', async () => {
  const { eje } = await ejemploCompra();
  const inv = eje.orden.find((id) => [eje.obtener(id).payload?.[0]].flat().includes('invitation'));
  assert.deepEqual(estados(await validez(eje, inv)), TODO_OK);
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
  // C1 (VG, 10-11): el eje local no la acepta; la validez de la candidata dice por qué capa: la 2, pendiente (con red,
  // se resolvería antes de aceptar).
  const nota = await crearEvento({
    autor: 'cocina', sobre: compra.id, t: T, movimientos: [gastaT('cocina')],
    payload: ['Nota', { ref: 'f'.repeat(64) }, { ref: menu.id, dir: '7000000000' }],
  });
  await assert.rejects(eje.anadir(nota), /referencia a un evento que no está en el eje: ffffffff/);
  const v = await validez(eje, nota);
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
  delete roto.eventos.find((e) => e.id === compra.id).firma; // la compra
  await assert.rejects(restaurar(roto), /who has a key signs: huesped has a key/);
  const { firma, firmante, ...sinFirma } = otro.obtener(compra.id);
  void firma; void firmante;
  const v = await validez(otro, sinFirma);
  assert.equal(v.enEje, true); // el mismo id: se lee en su lugar del eje
  assert.equal(v.criptografia.estado, 'falla');
  assert.equal(v.criptografia.firma, 'ausente');
  assert.match(v.criptografia.motivos[0], /who has a key signs: huesped has a key/);
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
  assert.match(ajena.permiso.motivos[0], /(E is minted by and to|R is minted by) its issuer/);
  assert.match((await eje.validar(ajenaEv)).join(' '), /(E is minted by and to|R is minted by) its issuer/); // lo mismo que rechaza el eje
  // Huesped mueve euros de la casa: hay respaldo (la casa los tiene), no hay permiso (capa 5).
  const robo = await validez(eje, await borrador('huesped', [{ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 1, de: 'casa', a: 'huesped' }]));
  assert.deepEqual(estados(robo), ['ok', 'ok', 'ok', 'ok', 'falla']);
  assert.match(robo.permiso.motivos[0], /nobody moves tokens of others/);
  // VG, 8-11: asignación diaria. Nadie emite T fuera del génesis: cada persona tiene, cada día, todo su T.
  // Cocina (una cosa de la casa, Core 8-11) emite T: solo las personas emiten (capa 5).
  const t = await validez(eje, await borrador('cocina', [{ token: 'T', escala: 'minuto', cantidad: 5, de: null, a: 'cocina' }]));
  assert.deepEqual(estados(t), ['ok', 'ok', 'ok', 'ok', 'falla']);
  assert.match(t.permiso.motivos[0], /only persons mint/);
  // Huesped (persona) tampoco emite T: no se emite (capa 5).
  const emite = await validez(eje, await borrador('huesped', [{ token: 'T', escala: 'hora', cantidad: 1, de: null, a: 'huesped' }]));
  assert.deepEqual(estados(emite), ['ok', 'ok', 'ok', 'ok', 'falla']);
  assert.match(emite.permiso.motivos.join(' '), /nobody mints T/);
  // Gasta más horas de las que le quedan del día: no hay respaldo (capa 4); el permiso sí (capa 5).
  const horas = await validez(eje, await borrador('huesped', [{ token: 'T', escala: 'hora', cantidad: 25, de: 'huesped', a: null }]));
  assert.deepEqual(estados(horas), ['ok', 'ok', 'ok', 'falla', 'ok']);
  assert.match(horas.acreditacion.motivos[0], /writing burns today's T/);
  assert.doesNotMatch(horas.acreditacion.resumen, /respaldados/);
  // Lo que le queda del día, sí: una hora y la parte del año de hoy (una escala que el génesis nunca emitió).
  assert.equal(eje.serie('T:anio').emitido, 0);
  const anio = await validez(eje, await borrador('huesped', [{ token: 'T', escala: 'hora', cantidad: 1, de: 'huesped', a: null }, { token: 'T', escala: 'anio', cantidad: 1, de: 'huesped', a: null }]));
  assert.deepEqual(estados(anio), TODO_OK);
  // Encargo 3b (mapa §15 [D] «P como peso de criterio»): no hay P sobre todo el eje, y nadie acuña P a mano. «genesis»
  // no es un registro (capa 4: no hay respaldo donde ponerlo) y acuñarlo no es un paso de reposición (capa 5).
  const p = await validez(eje, await borrador('huesped', [{ token: 'P', ambito: 'genesis', cantidad: 1, de: null, a: 'huesped' }]));
  assert.deepEqual(estados(p), ['ok', 'ok', 'ok', 'falla', 'falla']);
  assert.match(p.acreditacion.motivos[0], /P moves within a known scope: P:genesis names no record of the ledger/);
  assert.match(p.permiso.motivos[0], /P is repositioned one step at a time: huesped mints P/);
  // P sobre la compra, acuñado a mano por quien la escribió (y tiene diez por ello, N1): respaldo hay; permiso, no.
  const aMano = await validez(eje, await borrador('huesped', [{ token: 'P', ambito: compra.id, cantidad: 1, de: null, a: 'huesped' }]));
  assert.deepEqual(estados(aMano), ['ok', 'ok', 'ok', 'ok', 'falla']);
  assert.match(aMano.permiso.motivos[0], /P is repositioned one step at a time/);
});

// Encargo 3b: se retira autorizar (mapa §15 [D]); el P de la compra es de quien la escribió (diez, N1), que lo delega.
test('P delegado: el libro se rehace en el lugar del registro; quien recibe P lo compromete, y no más del que tiene', async () => {
  const { eje, compra } = await ejemploCompra();
  assert.deepEqual([eje.poderSobre('huesped', compra.id), eje.poderSobre('casa', compra.id)], [10, 0]);
  const delega = await eje.escribir({ autor: 'huesped', sobre: compra.id, t: T, movimientos: [gastaT('huesped'), { token: 'P', ambito: compra.id, cantidad: 1, de: 'huesped', a: 'cocina' }], payload: 'cocina decide lo de esta compra' });
  assert.deepEqual(estados(await validez(eje, delega.id)), TODO_OK);
  // Cocina no puede delegar más P del que tiene.
  const demasiado = await crearEvento({ autor: 'cocina', sobre: compra.id, t: T, movimientos: [gastaT('cocina'), { token: 'P', ambito: compra.id, cantidad: 5, de: 'cocina', a: 'huesped' }], payload: 'x' });
  const v = await validez(eje, demasiado);
  assert.deepEqual(estados(v), ['ok', 'ok', 'ok', 'falla', 'ok']);
  assert.match(v.acreditacion.motivos[0], /P insuficiente en cocina/);
  // Comprometerse con una propuesta es bloquear el P que se tiene con su id de salida (mapa §15 [D] (5)): cocina, el uno
  // que le dieron; la casa, que no tiene P sobre la compra, no.
  const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: 'dos menús' } });
  const comprometo = (autor) => ({ autor, sobre: c.id, t: T, payload: 'sí', movimientos: [gastaT(autor), { token: 'P', ambito: compra.id, cantidad: 1, de: autor, a: autor, estado: 'bloqueo', salida: c.id }] });
  const deCocina = await eje.escribir(comprometo('cocina'));
  assert.deepEqual(estados(await validez(eje, deCocina.id)), TODO_OK);
  const deLaCasa = await validez(eje, await crearEvento(comprometo('casa')));
  assert.equal(deLaCasa.acreditacion.estado, 'falla');
  // Los registros anteriores siguen en ok: cada uno se lee con el libro de su momento.
  for (const id of eje.orden.filter((x) => x !== eje.genesisId)) assert.equal((await validez(eje, id)).acreditacion.estado, 'ok');
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
  // C1 (VG, 10-11): las dos, como candidatas (la de { ref } el eje local no la acepta).
  const escribir = (payload) => crearEvento({ autor: 'cocina', sobre: compra.id, en: '1000000000', t: T, movimientos: [gastaT('cocina')], payload });
  const comoFormula = await validez(eje, await escribir(['Cuenta', '=REF("ffffffff", "1200000000") + 2 EUR']));
  const comoRef = await validez(eje, await escribir(['Cuenta', { ref: 'f'.repeat(64), dir: '1200000000' }]));
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

// Encargo 3b (VG, 8-11, mapa §15 [D] «Una sola operación: registrar» y N5): se retiran autorizar, ejecutar y los
// estados del motor. Una propuesta está abierta mientras le falta algo de lo que su dueño anunció en su 4.1 y cerrada
// cuando ha pasado; cada uno mueve lo suyo. La capa 5 lo dice: abierta, pendiente; cerrada, ok.
test('una propuesta con un pago anunciado: abierta (permiso pendiente) hasta que se paga; lo escrito por otros no la cierra', async () => {
  const { eje, compra } = await ejemploCompra();
  const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, titulo: 'Pago del menú', elecciones: { 1: 'dos menús', 4: 'pagar 14 EUR' } });
  // Sin nada anunciado, cerrada.
  assert.deepEqual(estados(await validez(eje, c.id)), TODO_OK);
  // La huésped anuncia el pago: abierta.
  const an = await eje.escribir({ autor: 'huesped', sobre: c.id, en: ANUNCIO, t: T, movimientos: [gastaT('huesped')], payload: anuncio('E:casa/EUR', 14, 'pagar', 'huesped', 'cocina') });
  assert.deepEqual(estados(await validez(eje, an.id)), TODO_OK); // el anuncio en sí no anuncia nada
  let v = await validez(eje, c.id);
  assert.deepEqual(estados(v), ['ok', 'ok', 'ok', 'ok', 'pendiente']);
  assert.deepEqual(v.permiso.motor, { cerrado: false, plantilla: CERRADO });
  assert.match(v.permiso.motivos[0], /abierto: le falta lo que anuncia \(all announced movements happened; motor.siguiente dice qué y de quién\)/);
  // Cocina escribe a mano «autorizo» en la fábrica, y anuncia algo suyo: entra, no cuenta (el dueño es la huésped).
  const falso = await eje.escribir({ autor: 'cocina', sobre: c.id, en: FABRICA, t: T, movimientos: [gastaT('cocina')], payload: '==autorizo', contexto: { fase: 'autorizado' } });
  assert.deepEqual(estados(await validez(eje, falso.id)), TODO_OK);
  await eje.escribir({ autor: 'cocina', sobre: c.id, en: ANUNCIO, t: T, movimientos: [gastaT('cocina')], payload: anuncio('E:casa/EUR', 1, 'devolver', 'cocina', 'huesped') });
  assert.equal((await validez(eje, c.id)).permiso.estado, 'pendiente');
  // La huésped paga con la transacción que le da motor.siguiente: cerrada, y los efectos externos siguen sin confirmar.
  const pago = await eje.escribir({ ...siguiente(eje, c.id, 'huesped').faltaDeMi[0].transaccion, t: T });
  v = await validez(eje, c.id);
  assert.deepEqual(estados(v), TODO_OK);
  assert.equal(cerrado(eje, c.id).cerrado, true);
  assert.match(v.permiso.resumen, /cerrado \(all announced movements happened\) · externa: sin confirmar/);
  assert.match(v.acreditacion.resumen, /externa: sin acreditar/);
  assert.deepEqual(estados(await validez(eje, pago.id)), TODO_OK);
});

test('lo anunciado lo mueve cada uno: un pago anunciado de otro no lo puede hacer el dueño (nadie mueve lo ajeno)', async () => {
  const { eje, compra } = await ejemploCompra();
  const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: 'tres menús' } });
  await eje.escribir({ autor: 'huesped', sobre: c.id, en: ANUNCIO, t: T, movimientos: [gastaT('huesped')], payload: anuncio('E:casa/EUR', 1, 'devolver', 'cocina', 'huesped') });
  const s = siguiente(eje, c.id, 'huesped');
  assert.deepEqual([s.faltaDeMi.length, s.espera.map((e) => e.de)], [0, ['cocina']]);
  // La huésped lo escribe a mano por cocina: capa 5 falla.
  const aMano = await validez(eje, await crearEvento({ autor: 'huesped', sobre: c.id, t: T, payload: 'a mano', movimientos: [gastaT('huesped'), { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 1, de: 'cocina', a: 'huesped' }] }));
  assert.deepEqual(estados(aMano), ['ok', 'ok', 'ok', 'ok', 'falla']);
  assert.match(aMano.permiso.motivos[0], /nobody moves tokens of others/);
  assert.equal(cerrado(eje, c.id).cerrado, false);
});

test('id que no corresponde al cuerpo: falla la capa 3, y la copia no se lee como el registro del eje', async () => {
  const { eje, compra } = await ejemploCompra();
  const v = await validez(eje, { ...compra, payload: ['Compra de otro menú'] });
  assert.equal(v.enEje, false); // el mismo id con otro cuerpo no es ese registro
  assert.equal(v.criptografia.idCorrecto, false);
  assert.equal(v.criptografia.estado, 'falla');
  assert.match(v.criptografia.motivos[0], /el id no corresponde al cuerpo/);
  assert.deepEqual(estados(v), ['ok', 'ok', 'falla', 'ok', 'ok']);
  // La compra manipulada con otra fase: la capa 5 no la lee como el registro real (no tiene lectura del ciclo).
  const comoConsolidacion = await validez(eje, { ...compra, contexto: { ...compra.contexto, fase: 'consolidado' } });
  assert.equal(comoConsolidacion.enEje, false);
  assert.equal(comoConsolidacion.permiso.motor, null);
  assert.match(comoConsolidacion.permiso.resumen, /no está en el eje: sin lectura del ciclo/);
  // Una propuesta abierta, manipulada: la lectura del ciclo es de la real, no de la copia (encargo 3b: ya no hay
  // estados del motor; lo que se lee es si está cerrada).
  const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: 'dos menús' } });
  await eje.escribir({ autor: 'huesped', sobre: c.id, en: ANUNCIO, t: T, movimientos: [gastaT('huesped')], payload: anuncio('E:casa/EUR', 14, 'pagar', 'huesped', 'cocina') });
  assert.deepEqual((await validez(eje, c.id)).permiso.motor, { cerrado: false, plantilla: CERRADO });
  const copia = await validez(eje, { ...eje.obtener(c.id), payload: ['Pago de diez menús'] });
  assert.equal(copia.enEje, false);
  assert.equal(copia.permiso.motor, null);
  assert.match(copia.permiso.resumen, /no está en el eje: sin lectura del ciclo/);
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

test('firma que no se puede verificar: cuenta como sin firma; la clave de quien escribe su alta va en ella (B1)', async () => {
  const { eje, compra } = await ejemploCompra(); // sin claves
  const otra = await generarClaves();
  // Cocina ya tiene alta y no tiene clave: el eje no deja añadírsela («no se puede cambiar la clave»). Cuenta como sin firma (G1).
  const deCocina = await firmar(await crearEvento({ autor: 'cocina', sobre: compra.id, t: T, movimientos: [gastaT('cocina')], payload: 'x' }), otra.privada);
  const v = await validez(eje, deCocina);
  assert.equal(v.criptografia.firma, 'sin verificar');
  assert.equal(v.criptografia.estado, 'ok');
  assert.deepEqual(await eje.validar(deCocina), []); // el eje la admite
  // Un autor sin alta: su firma, sin clave declarada, no se puede verificar nunca: cuenta como sin firma (G1), igual
  // que la de cocina. (Encargo 3b, mapa §16 [D]: su alta es aceptar una invitación; escribir sin ella falla la capa 5.)
  const deNadie = await firmar(await crearEvento({ autor: 'nadie', sobre: compra.id, t: T, movimientos: [gastaT('nadie')], payload: 'x' }), otra.privada);
  const n = await validez(eje, deNadie);
  assert.deepEqual([n.criptografia.estado, n.criptografia.firma], ['ok', 'sin verificar']);
  // Con la clave declarada en su alta y firmada con ella, se verifica: su firma es su prueba de posesión.
  const conClave = await firmar(await crearEvento({ autor: 'nadie', sobre: compra.id, t: T, movimientos: [gastaT('nadie')], payload: 'x', contexto: { claves: { nadie: otra.publica } } }), otra.privada);
  const k = await validez(eje, conClave);
  assert.deepEqual([k.criptografia.estado, k.criptografia.firma, k.criptografia.clavesDeclaradas], ['ok', 'verificada', [{ identidad: 'nadie', por: 'nadie', posesion: 'probada' }]]);
  // …pero no es un alta: no acepta ninguna invitación. La capa 5 lo dice, y el eje no la admite.
  assert.match(k.permiso.motivos.join(' '), /a person joins by an invitation: nadie has no alta/);
  assert.match((await eje.validar(conClave)).join(' '), /a person joins by an invitation/);
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
