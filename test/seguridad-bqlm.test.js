// Revisión de seguridad del BQL mínimo y su contexto (SEG-09 a SEG-12): el
// payload no fabrica movimientos ni «nadie»; la expansión de ocupantes tiene
// un presupuesto; y los textos de fuera no tocan el prototipo de los
// diccionarios del libro.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluar, evaluarRegla, evaluarEscritura, POR_LIMITE, LIMITES, NADIE, DESTINOS_DE_PUT, VERIFICACION, COSTE_FIRMA, queMueve } from '../src/bqlm.js';
import { readFileSync } from 'node:fs';
import { ContextoEje } from '../src/contexto-eje.js';
import { EPOCA_0_BTML, cargarEpocaBtml } from '../src/epocas.js';
import { EPOCA_0_BTML_DATOS, REGLAS_DE_EPOCA_DATOS, PLANTILLAS_DE_EPOCA_DATOS, CORRECCIONES_DE_EPOCA_DATOS } from '../datos/epocas/epocas.js';
import * as A from '../src/acciones.js';
import { generarClaves, firmar as firmarEvento } from '../src/autoridad.js';
import { crearEvento, canonico, cuerpo, hash, RAIZ } from '../src/evento.js';
import { validarMovimiento } from '../src/tokens.js';
import { Libro, acunar, bloquear, transaccion } from '../src/libro.js';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';
import { entrarPorInvitacion } from '../ejemplos/ikisai/altas.mjs';
import { pagaElCoste } from './ayudas-coste.js';
import { selloCompleto, declararExterior } from './ayudas-sello.js';
import { Eje } from '../src/eje.js';
import { verificado as verificadoDe } from '../src/contrato.js';

const REGLA = EPOCA_0_BTML.condiciones[0];
const uno = (src, ctx) => {
  const r = evaluar(src, ctx);
  assert.equal(r.estado, 'RESUELTO', src + ': ' + r.motivo);
  assert.equal(r.valor.length, 1, src);
  return r.valor[0];
};
const aMano = async (datos) => {
  const ev = { en: RAIZ, contexto: {}, ...datos };
  return { ...ev, id: await hash(canonico(cuerpo(ev))) };
};

test('SEG-09 una décupla del payload que imita un movimiento no cuenta: las primitivas y las familias son símbolos del libro', async () => {
  const { eje, menu } = await ejemploCompra();
  // Sin quemar T de verdad, con un payload que lleva en su 1 algo con la forma de una quema de T.
  const falso = [['T:minuto'], [1], ['nada'], [['huesped'], ['nadie']], ['burn']];
  const ev = await aMano({
    autor: 'huesped',
    sobre: menu.id,
    t: '2026-11-07T15:00:00Z',
    movimientos: [{ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 1, de: 'huesped', a: 'cocina' }],
    payload: ['Quema fingida', falso],
  });
  const ctx = new ContextoEje(eje, { ev, epoch: EPOCA_0_BTML });
  assert.equal(uno('count ev.1', ctx), 2, 'el movimiento y la décupla del payload colisionan en el 1');
  assert.equal(uno('count (ev.1 where it.4 = burn)', ctx), 0, 'el texto «burn» no es el símbolo burn');
  assert.equal(uno('count (ev.1 where it.0.0 = T)', ctx), 0, 'ni el texto «T» de una clave del payload es la familia T');
  assert.equal(uno('count (ev.1 where it.4 = "burn")', ctx), 1, 'como texto sigue ahí, y se puede leer');
  assert.ok((await eje.validar(ev)).some((e) => /escribir consume T/.test(e)));
  const r = evaluarRegla(REGLA, ctx);
  assert.deepEqual([r.pasa, r.estado], [false, 'RESUELTO']);
});

test('SEG-10 la expansión de ocupantes tiene un presupuesto por evaluación; las referencias repetidas se siguen una vez', async () => {
  const { eje, menu } = await ejemploCompra();
  const minuto = pagaElCoste('huesped');
  const grande = await crearEvento({ autor: 'huesped', sobre: menu.id, t: '2026-11-07T15:00:00Z', movimientos: [minuto], payload: ['Lista enorme', Array.from({ length: 20000 }, (_, k) => 'x' + k)] });
  const ctx = new ContextoEje(eje, { ev: grande });
  const r = evaluar('count ev.1', ctx);
  assert.deepEqual([r.estado, r.subtipo], ['PENDIENTE', POR_LIMITE]);
  assert.match(r.motivo, new RegExp('más de ' + LIMITES.ocupantes + ' ocupantes'));
  assert.equal(evaluar('count ev.1', ctx, { limites: { ocupantes: 50000 } }).valor[0], 20001, 'el tope se puede subir');
  // Mil referencias al mismo 1 del menú (tres platos): con la memoria por (ref, dir) se sigue una vez, y lo que
  // devuelve cada una se cobra igual (SEG-13): tres mil ocupantes, que caben en el presupuesto.
  const ref = { ref: menu.id, dir: '1000000000' };
  const repetidas = await crearEvento({ autor: 'huesped', sobre: menu.id, t: '2026-11-07T15:00:00Z', movimientos: [minuto], payload: ['Referencias', Array.from({ length: 1000 }, () => ref)] });
  assert.equal(uno('count ev.1', new ContextoEje(eje, { ev: repetidas })), 3001);
});

test('SEG-11 «nadie» es un símbolo: una identidad que se llama así no se confunde con el otro lado de una quema', async () => {
  const { eje } = await ejemploCompra();
  // B1: escribe su propia alta, aceptando la invitación de la casa (encargo 3b).
  await entrarPorInvitacion(eje, { por: 'casa', quien: 'nadie', t: '2026-11-07T15:00:00Z' });
  const alta = await eje.escribir({
    autor: 'casa',
    sobre: eje.genesisId,
    t: '2026-11-07T15:00:00Z',
    movimientos: [pagaElCoste('casa'), { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 5, de: 'casa', a: 'nadie' }],
    payload: ['Alta de alguien que se llama nadie', ['nadie']],
  });
  const ev = await crearEvento({ autor: 'nadie', sobre: alta.id, t: '2026-11-07T16:00:00Z', movimientos: [pagaElCoste('nadie')], payload: ['Escribe nadie'] });
  const ctx = new ContextoEje(eje, { ev, epoch: EPOCA_0_BTML });
  assert.equal(uno('first ev.3', ctx), 'nadie');
  assert.equal(uno('first ev.1.3.1', ctx), NADIE);
  assert.equal(uno('first ev.1.3.1 = first ev.3', ctx), false, 'el destino de la quema no es la identidad «nadie»');
  assert.equal(evaluar('ev.1.3.1', ctx).texto, 'nadie', 'aunque se lea igual');
  assert.deepEqual(await eje.validar(ev), []);
  assert.equal(evaluarRegla(REGLA, ctx).pasa, true, 'la identidad «nadie» quema su T como cualquiera');
});

test('SEG-12 una salida o una serie llamada «__proto__» o «constructor»: el eje la rechaza y el libro no se altera', async () => {
  for (const nombre of ['__proto__', 'constructor', 'prototype']) {
    assert.ok(validarMovimiento({ token: 'P', ambito: 'x', cantidad: 1, de: 'ana', a: 'ana', estado: 'bloqueo', salida: nombre }).some((e) => /nombre reservado/.test(e)), nombre);
    assert.ok(validarMovimiento({ token: 'E', emisor: nombre, denominacion: 'EUR', cantidad: 1, de: null, a: nombre }).some((e) => /emisor no puede llamarse/.test(e)), nombre);
  }
  const { eje } = await ejemploCompra();
  await assert.rejects(eje.escribir({
    autor: 'casa',
    sobre: eje.genesisId,
    t: '2026-11-07T15:00:00Z',
    movimientos: [pagaElCoste('casa'), { token: 'P', ambito: 'genesis', cantidad: 1, de: 'casa', a: 'casa', estado: 'bloqueo', salida: '__proto__' }],
    payload: ['bloqueo raro'],
  }), /salida no puede llamarse «__proto__»/);
  // El libro, por debajo de la validación: las claves raras son claves propias y el prototipo no cambia.
  const libro = new Libro();
  const ok = await libro.aplicar(transaccion({ movimientos: [acunar('P:x', 'ana', 10), bloquear('P:x', 'ana', 3, '__proto__'), bloquear('P:x', 'ana', 2, 'constructor'), acunar('__proto__', 'ana', 1)], autor: 'ana' }));
  assert.equal(ok.ok, true);
  const vista = libro.vista('ana');
  assert.equal(Object.getPrototypeOf(vista), Object.prototype);
  assert.deepEqual(Object.keys(vista), ['P:x', '__proto__']);
  assert.deepEqual(Object.keys(vista['P:x'].bloqueado), ['__proto__', 'constructor']);
  assert.deepEqual([vista['P:x'].disponible, Object.getOwnPropertyDescriptor(vista['P:x'].bloqueado, '__proto__').value, vista['P:x'].bloqueado.constructor], [5, 3, 2]);
  assert.equal(Object.getPrototypeOf(vista['P:x'].bloqueado), Object.prototype);
  assert.equal(Object.getOwnPropertyDescriptor(libro.sumas({ primitiva: 'acunar' }), '__proto__').value, 1);
  assert.deepEqual(Object.entries(libro.bloqueadoPorSalida('constructor')), [['P:x', 2]], 'la salida «constructor» suma lo suyo, sin leer el prototipo');
  assert.equal({}.constructor, Object, 'Object.prototype intacto');
});

test('SEG-13 el presupuesto cobra lo que devuelve cada referencia aunque esté memoizada: muchas referencias a un registro grande no salen gratis', async () => {
  const { eje, menu } = await ejemploCompra();
  const minuto = pagaElCoste('huesped');
  const grande = await eje.escribir({ autor: 'huesped', sobre: menu.id, t: '2026-11-07T15:00:00Z', movimientos: [minuto], payload: ['Doscientos', Array.from({ length: 200 }, (_, k) => 'x' + k)] });
  const ref = { ref: grande.id, dir: '1000000000' };
  const cien = await crearEvento({ autor: 'huesped', sobre: menu.id, t: '2026-11-07T15:01:00Z', movimientos: [minuto], payload: ['Cien referencias', Array.from({ length: 100 }, () => ref)] });
  const r = evaluar('count ev.1', new ContextoEje(eje, { ev: cien }));
  assert.deepEqual([r.estado, r.subtipo], ['PENDIENTE', POR_LIMITE], 'cien referencias a doscientos ocupantes son veinte mil, más que el presupuesto');
  assert.equal(evaluar('count ev.1', new ContextoEje(eje, { ev: cien }), { limites: { ocupantes: 50000 } }).valor[0], 20001, 'con más presupuesto se cuenta entero');
});

// ---------- BQL mueve: el invariante del núcleo (VG 12-11, estudio BQL-transacciones, decisión 6) ----------

/** La época 0 con una regla o una plantilla cambiadas (los datos, no el código). */
function epocaCambiada({ regla, plantilla } = {}) {
  const registros = REGLAS_DE_EPOCA_DATOS.map((r) => (regla && r.registro[0][0] === regla.nombre ? { ...r, registro: r.registro.map((x, i) => (i === 2 ? [regla.formula] : i === 4 && regla.cuatro ? regla.cuatro : x)) } : r));
  const plantillas = PLANTILLAS_DE_EPOCA_DATOS.map((p) => (plantilla && p.registro[0][0] === plantilla.nombre ? { ...p, registro: p.registro.map((x, i) => (i === 4 ? plantilla.cuatro : x)) } : p));
  return cargarEpocaBtml(JSON.parse(JSON.stringify(EPOCA_0_BTML_DATOS)), { registros, plantillas, correcciones: CORRECCIONES_DE_EPOCA_DATOS, id: EPOCA_0_BTML.id });
}

test('SEG-14 nadie mueve lo ajeno desde una regla: una regla de la época con un verbo no se carga (y evaluada, es ERROR); un put solo en una regla que escribe y solo en su lista cerrada', async () => {
  // Una condición que intentara mover (aunque el verbo quede detrás de un and que da falso): la época no se carga.
  assert.throws(() => epocaCambiada({ regla: { nombre: 'nobody moves tokens of others', formula: '=1 = 2 and transfer 1 R.("casa") from "casa" to first ev.3' } }), /mueve \(«transfer»\): una regla solo lee; solo una plantilla de transacción mueve/);
  // Ni una lectura ni una regla que escribe pueden llevar un verbo; una lectura tampoco coloca.
  assert.throws(() => epocaCambiada({ regla: { nombre: 'stage', formula: '=burn 1 T.1 from first it.3' } }), /una regla solo lee/);
  assert.throws(() => epocaCambiada({ regla: { nombre: 'writing a record gives ten P on it', formula: '=mint 10 P.(first ev.5).(first ev.3) to first ev.3' } }), /una regla solo lee/);
  assert.throws(() => epocaCambiada({ regla: { nombre: 'stage', formula: '=put 10 at (first it.3).2.1.(it)' } }), /coloca \(put\) sin ser una regla que escribe/);
  // Evaluada a mano (sin el cargador), la regla con un verbo es ERROR: nunca se mueve nada desde una regla.
  const { eje, menu } = await ejemploCompra();
  const ev = await crearEvento({ autor: 'huesped', sobre: menu.id, t: '2026-11-07T15:00:00Z', movimientos: [pagaElCoste('huesped')], payload: ['x'] });
  const ctx = new ContextoEje(eje, { ev, epoch: EPOCA_0_BTML });
  const r = evaluarRegla([['thief'], [], ['=1 = 1 or transfer 12 E.("casa").("EUR") from "cocina" to first ev.3'], ['ev.3'], ['transfer'], ['*'], ['x'], ['epoch 0'], ['first'], ['no']], ctx);
  assert.deepEqual([r.pasa, r.estado], [false, 'ERROR']);
  // Una regla que escribe solo coloca en A.2.1 (el P posicionado): el libro, por su cuenta, solo acuña hasta un nivel ahí.
  const w = evaluarEscritura([['writer'], [], ['=put 100 at (first ev.3).1.("E:casa/EUR")'], ['ev.3'], ['put'], ['*'], ['x'], ['epoch 0'], ['first'], ['no']], ctx);
  assert.deepEqual([w.estado, w.escrituras], ['ERROR', []]);
  assert.deepEqual(DESTINOS_DE_PUT, [[2, 1]]);
});

test('SEG-15 las plantillas construyen y firma quien mueve: un verbo que nombra lo ajeno se construye, pero lo rechaza la regla; lo que sale lo firma quien lanza la plantilla', async () => {
  const claves = { casa: await generarClaves(), cocina: await generarClaves(), huesped: await generarClaves() };
  const { eje, menu } = await ejemploCompra({ claves });
  const firmar = (ev) => firmarEvento(ev, claves.huesped.privada);
  // «anchor here» con una sentencia que mueve los euros de la cocina hacia quien lanza: la candidata se construye (la
  // plantilla propone), la firma la huésped, y la regla «nobody moves tokens of others» la rechaza.
  const ladrona = epocaCambiada({ plantilla: { nombre: 'anchor here', cuatro: ['=transfer 12 E.("casa").("EUR") from first it.3 to me'] } });
  const r = await A.transaccion(eje, 'anchor here', { X: menu.id, title: 'mía' }, 'huesped', { t: '2026-11-07T15:00:00Z', firmar, epoca: ladrona });
  assert.equal(r.ok, false);
  assert.deepEqual([r.evento.autor, r.evento.firmante, r.evento.movimientos[1]], ['huesped', 'huesped', { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 12, de: 'cocina', a: 'huesped' }]);
  assert.ok(r.motivos.some((m) => m.regla === 'nobody moves tokens of others'), JSON.stringify(r.motivos));
  await assert.rejects(eje.anadir(r.evento), /nobody moves tokens of others/);
  // Lo suyo, en cambio, pasa: la misma plantilla moviendo lo de quien la lanza (la firma la huésped, que es quien mueve).
  const propia = epocaCambiada({ plantilla: { nombre: 'anchor here', cuatro: ['=transfer 2 E.("casa").("EUR") from me to first it.3'] } });
  const ok = await A.transaccion(eje, 'anchor here', { X: menu.id, title: 'propina' }, 'huesped', { t: '2026-11-07T15:00:00Z', firmar, epoca: propia });
  assert.deepEqual([ok.ok, ok.evento.firmante, ok.evento.movimientos[1].de], [true, 'huesped', 'huesped'], JSON.stringify(ok.motivos));
  // Una serie escrita como texto no la fabrica una plantilla (SEG-09): ERROR al construir.
  const texto = epocaCambiada({ plantilla: { nombre: 'anchor here', cuatro: ['=transfer 2 "E:casa/EUR" from me to first it.3'] } });
  const t = await A.transaccion(eje, 'anchor here', { X: menu.id, title: 'texto' }, 'huesped', { t: '2026-11-07T15:00:00Z', epoca: texto });
  assert.equal(t.ok, false);
  assert.match(t.motivos[0].mensaje, /un texto no fabrica una serie/);
});

// ---------- primitivas de verificación (Core AGRAM 12-11, #67; docs/BQLM.md §12) ----------

/** Un contexto que revienta si se le pregunta algo: una primitiva con argumentos literales no lo toca. */
const SIN_LIBRO = new Proxy({}, { get: (_, k) => (k === 'then' ? undefined : () => { throw new Error('la primitiva leyó el contexto: ' + String(k)); }) });

test('SEG-16 ninguna primitiva firma: no hay sign ni claves privadas en el léxico, y src/cripto.js solo llama a schnorr.verify y, para el TapTweak (H20), a la aritmética pública de la curva', () => {
  for (const f of Object.keys(VERIFICACION)) assert.doesNotMatch(f, /^sign$|priv|secret|key|firm/i, f);
  assert.ok(Object.hasOwn(VERIFICACION, 'signed'), 'signed verifica: devuelve verdadero o falso');
  for (const e of ['sign(bytes("00"), bytes("00"))', 'schnorr(1)', 'getPublicKey(bytes("00"))']) assert.match(evaluar(e, SIN_LIBRO).motivo, /no es BQL mínimo/, e);
  const fuente = readFileSync(new URL('../src/cripto.js', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  assert.deepEqual([...fuente.matchAll(/schnorr\.(\w+(?:\.\w+)?)/g)].map((m) => m[1]), ['verify', 'utils.lift_x', 'Point.BASE'], 'verify; y lift_x y el generador, sin secretos, para el TapTweak');
  assert.doesNotMatch(fuente, /\.multiply\(|fromPrivateKey|taggedHash/, 'solo multiplyUnsafe del generador por un ajuste público');
  assert.doesNotMatch(fuente, /getPublicKey|randomSecretKey|\.sign\(|privad/);
});

test('SEG-17 ninguna primitiva lee fuera del libro: con argumentos literales no toca el contexto; src/cripto.js no importa nada más que la verificación ni hace E/S', () => {
  const casos = ['hex(bytes("00ff"))', 'hex(utf8("a"))', 'hex(hash("a"))', 'hex(hash("a", "t"))', 'hex(sha256(bytes("")))', 'hex(sha256d(bytes("")))', 'hex(cat(bytes("01"), bytes("02")))',
    'hex(slice(bytes("0102"), 0, 1))', 'hex(reverse(bytes("0102")))', 'le(bytes("01"))', 'below(bytes("00"), bytes("01"))', 'signed(bytes("' + '00'.repeat(64) + '"), bytes("' + '00'.repeat(32) + '"), bytes("' + '00'.repeat(32) + '"))'];
  for (const e of casos) assert.equal(evaluar(e, SIN_LIBRO).estado, 'RESUELTO', e + ': ' + evaluar(e, SIN_LIBRO).motivo);
  for (const e of casos) assert.deepEqual(queMueve('=' + e), { verbo: null, put: false }, e);
  const fuente = readFileSync(new URL('../src/cripto.js', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  assert.deepEqual([...fuente.matchAll(/^import .* from '(.*)';$/gm)].map((m) => m[1]), ['./vendor/noble-secp256k1.js']);
  assert.doesNotMatch(fuente, /fetch|XMLHttpRequest|globalThis|process\.|require\(|import\(|Date\.|Math\.random|localStorage|crypto\.subtle/);
});

test('SEG-18 el presupuesto corta una tx o un cat desmesurados antes de procesarlos; una tx de 100 KB cabe', () => {
  // Una transacción válida de ~100 KB (un scriptSig enorme): cabe en el presupuesto de una evaluación.
  const tx = (n) => '01000000' + '01' + 'aa'.repeat(32) + '00000000' + 'fe' + Buffer.from(Uint32Array.of(n).buffer).toString('hex') + '51'.repeat(n) + 'ffffffff' + '01' + '0000000000000000' + '00' + '00000000';
  const ctx = (h) => new ContextoEje(null, { epoch: [[h]] });
  const cien = evaluar('count (first tx(bytes(first epoch.0)).1)', ctx(tx(100000)));
  assert.equal(cien.estado, 'RESUELTO', cien.motivo);
  // Una de 1,2 MB: bytes(…) paga 1,2 MB y tx(…) pediría 2,4 MB más; se para con PENDIENTE POR LÍMITE.
  const t0 = Date.now();
  const enorme = evaluar('count (first tx(bytes(first epoch.0)).1)', ctx(tx(1200000)));
  assert.equal(enorme.subtipo, POR_LIMITE, enorme.motivo);
  assert.match(enorme.motivo, /bytes procesados/);
  assert.ok(Date.now() - t0 < 5000, 'se corta sin procesarla');
  // cat: con un tope de 1000 bytes, dos bytes(…) de 500 caben y el cat de los dos, no.
  const h = 'ab'.repeat(500);
  assert.equal(evaluar('count (bytes("' + h + '") = bytes("' + h + '"))', SIN_LIBRO, { limites: { bytes: 1000 } }).estado, 'RESUELTO');
  assert.equal(evaluar('hex(cat(bytes("' + h + '"), bytes("' + h + '")))', SIN_LIBRO, { limites: { bytes: 1000 } }).subtipo, POR_LIMITE);
  // Un cat que se repite en un where: el presupuesto es de toda la evaluación.
  const repetido = evaluar('count (epoch.0 where count cat(bytes(it), bytes(it), bytes(it), bytes(it)) = 1)', new ContextoEje(null, { epoch: [Array.from({ length: 200 }, (_, k) => 'ab'.repeat(2000) + k.toString(16).padStart(2, '0'))] }));
  assert.equal(repetido.subtipo, POR_LIMITE, repetido.motivo);
  // Las firmas pagan COSTE_FIRMA cada una: no se pueden verificar sin tope.
  assert.ok(LIMITES.bytes / COSTE_FIRMA < 100);
  const firma = 'signed(bytes("' + '00'.repeat(64) + '"), bytes("' + '00'.repeat(32) + '"), bytes("' + '00'.repeat(32) + '"))';
  const muchas = evaluar('count (epoch.0 where ' + firma + ')', new ContextoEje(null, { epoch: [Array.from({ length: 100 }, (_, k) => 'f' + k)] }));
  assert.equal(muchas.subtipo, POR_LIMITE, muchas.motivo);
});

test('SEG-19 la regla «sealed» no acepta un sello firmado por una clave fuera de la lista de la cuenta raíz, ni la que declara otro, ni una prueba copiada en el payload', async () => {
  const cuenta = await generarClaves();
  const eje = await Eje.genesis({ identidad: 'vg', foco: ['mi eje'], t: '2026-11-10T10:00:00Z', clave: cuenta.publica, privada: cuenta.privada, exigirFirmas: true });
  const declarada = await generarClaves();
  const intrusa = await generarClaves();
  await declararExterior(eje, { observadores: [declarada.publica], privada: cuenta.privada, t: '2026-11-10T10:01:00Z' });
  const ev = await eje.escribir({ autor: 'vg', sobre: eje.genesisId, t: '2026-11-10T10:02:00Z', movimientos: [pagaElCoste('vg')], payload: ['uno'] }, cuenta.privada);
  const sealed = (id) => evaluar('=first (first it.6).8.5', new ContextoEje(eje, { epoch: EPOCA_0_BTML }), { sujeto: id });
  // Una prueba completa y coherente, pero firmada por una clave que la cuenta raíz no declaró: falso.
  eje.marcarSello(ev.id, await selloCompleto(ev.id, { observador: intrusa }));
  assert.deepEqual(sealed(ev.id).valor, [false]);
  assert.equal(verificadoDe(eje, ev.id).sello, false);
  // La lista que cuenta es la de la cuenta RAÍZ: unos ajustes del exterior de otra identidad no la amplían.
  assert.deepEqual(evaluar('before.8.6', new ContextoEje(eje, { epoch: EPOCA_0_BTML })).valor, [declarada.publica]);
  // Una «prueba» escrita en el payload del propio registro (su 6.8.2) no se lee: el núcleo lee el 6 implícito (first it.6).
  const prueba = (await selloCompleto(eje.genesisId, { observador: declarada })).decupla;
  const falso = await eje.escribir({ autor: 'vg', sobre: eje.genesisId, t: '2026-11-10T10:03:00Z', movimientos: [pagaElCoste('vg')], payload: ['dos', '-', '-', '-', '-', '-', ['-', '-', '-', '-', '-', '-', '-', '-', ['-', '-', prueba]]] }, cuenta.privada);
  assert.equal(sealed(falso.id).estado, 'PENDIENTE', 'sin sello del eje, falta el dato; lo del payload no cuenta');
});

test('SEG-20 la regla «sealed» no acepta un anclaje Taproot manipulado: otra clave interna, un hermano Taproot cambiado o de más, otra salida, otra transacción (H20)', async () => {
  const cuenta = await generarClaves();
  const eje = await Eje.genesis({ identidad: 'vg', foco: ['mi eje'], t: '2026-11-10T10:00:00Z', clave: cuenta.publica, privada: cuenta.privada, exigirFirmas: true });
  const declarada = await generarClaves();
  await declararExterior(eje, { observadores: [declarada.publica], privada: cuenta.privada, t: '2026-11-10T10:01:00Z' });
  const sealed = (id) => evaluar('=first (first it.6).8.5', new ContextoEje(eje, { epoch: EPOCA_0_BTML }), { sujeto: id });
  let minuto = 2;
  const nuevo = async () => eje.escribir({ autor: 'vg', sobre: eje.genesisId, t: '2026-11-10T10:' + String(minuto++).padStart(2, '0') + ':00Z', movimientos: [pagaElCoste('vg')], payload: ['r' + minuto] }, cuenta.privada);
  // El de verdad, con otros lotes en el mismo anclaje: verdadero.
  const bueno = await nuevo();
  eje.marcarSello(bueno.id, await selloCompleto(bueno.id, { observador: declarada, otrosLotes: 3 }));
  assert.deepEqual(sealed(bueno.id).valor, [true]);
  // Otra clave interna que sí es un punto de la curva (la x del generador), un hermano cambiado o uno de más: la clave de
  // salida ya no es la de la transacción. Una transacción cambiada (otra salida, otro locktime): tampoco cuadra. Falso.
  const G = '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
  for (const [que, cambiar] of [
    ['otra interna', (x) => { x.prueba.taproot.interna = G; }],
    ['un hermano cambiado', (x) => { x.prueba.taproot.hermanos[1] = 'ab'.repeat(32); }],
    ['un hermano de más', (x) => { x.prueba.taproot.hermanos.push('ab'.repeat(32)); }],
    ['un hermano de menos', (x) => { x.prueba.taproot.hermanos.pop(); }],
    ['otra salida en la transacción', (x) => { x.prueba.taproot.tx = x.prueba.taproot.tx.replace(/22(5120[0-9a-f]{64})00000000$/, (m, sc) => '22' + sc.slice(0, -2) + (sc.endsWith('00') ? '01' : '00') + '00000000'); }],
    ['otro locktime (otro txid)', (x) => { x.prueba.taproot.tx = x.prueba.taproot.tx.slice(0, -8) + '01000000'; }],
  ]) {
    const ev = await nuevo();
    eje.marcarSello(ev.id, await selloCompleto(ev.id, { observador: declarada, otrosLotes: 3, cambiar }));
    assert.deepEqual(sealed(ev.id).valor, [false], que);
    assert.equal(verificadoDe(eje, ev.id).sello, false, que);
  }
});
