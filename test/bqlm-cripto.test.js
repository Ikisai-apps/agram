// Las primitivas puras de verificación del BQL mínimo (Core AGRAM 12-11, #67; docs/BQLM.md §12), con vectores públicos:
// SHA-256 (FIPS 180-2), BIP-340 (test/bip340-vectores.csv), el bloque génesis de Bitcoin (cabecera y coinbase), el
// Merkle «bitcoin» (una tx y tres con duplicado), el Merkle «sip» contra el sellador de servidor/sim/stateark (SIP-0.md,
// normativo), OpenTimestamps con un camino sintético, una transacción con testigo hecha a mano, la firma de un evento
// real y las seis reglas del SIP 0 (InTheState/stateark/sip/reglas, solo lectura).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { evaluar, analizar, queMueve, esBytes, VERIFICACION } from '../src/bqlm.js';
import { sha256 as sha256Propio } from '../src/cripto.js';
import { schnorr } from '../src/vendor/noble-secp256k1.js';
import { ContextoEje } from '../src/contexto-eje.js';
import { crearEvento } from '../src/evento.js';
import { generarClaves, firmar } from '../src/autoridad.js';
import { Sellador } from '../servidor/sim/stateark/sello.js';

const sha = (b) => createHash('sha256').update(b).digest();
const shad = (b) => sha(sha(b));
const hx = (b) => Buffer.from(b).toString('hex');
const bx = (h) => Buffer.from(h, 'hex');
const rev = (h) => hx(bx(h).reverse());

/** Un contexto sin eje que lee `datos` como epoch: así los datos BTML (hex, caminos) entran como en una regla. */
const ctx = (datos = ['x']) => new ContextoEje(null, { epoch: datos });
function vale(src, c = ctx()) {
  const r = evaluar(src, c);
  assert.equal(r.estado, 'RESUELTO', src + ': ' + r.motivo);
  assert.equal(r.valor.length, 1, src);
  return r.valor[0];
}
const estado = (src, c = ctx(), opciones) => evaluar(src, c, opciones);

// ---------- SHA-256 ----------

test('sha256 y sha256d: los vectores de FIPS 180-2, y el SHA-256 propio coincide con node:crypto en 0 a 300 bytes y con el etiquetado de noble', () => {
  assert.equal(vale('hex(sha256(utf8("abc")))'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(vale('hex(sha256(bytes("")))'), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(vale('hex(sha256(utf8("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")))'), '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  assert.equal(vale('hex(sha256d(utf8("abc")))'), hx(shad(Buffer.from('abc'))));
  for (let n = 0; n <= 300; n++) {
    const x = Uint8Array.from({ length: n }, (_, i) => (i * 31 + n * 7) & 255);
    assert.equal(hx(sha256Propio(x)), hx(sha(x)), n + ' bytes');
  }
  const m = Uint8Array.from({ length: 77 }, (_, i) => i);
  assert.equal(vale('hex(hash(bytes("' + hx(m) + '"), "BIP0340/challenge"))'), hx(schnorr.utils.taggedHash('BIP0340/challenge', m)));
});

test('bytes, hex y utf8: el tipo bytes es distinto del texto; hex en minúsculas; error claro si no es hex', () => {
  const b = vale('bytes("00FFa0")');
  assert.ok(esBytes(b));
  assert.equal(vale('hex(bytes("00FFa0"))'), '00ffa0');
  assert.equal(vale('bytes("00ff") = bytes("00FF")'), true);
  assert.equal(vale('bytes("00ff") = "00ff"'), false, 'bytes y texto no son iguales, como 1 y "1"');
  assert.equal(vale('hex(utf8("ñ"))'), 'c3b1');
  assert.match(estado('bytes("0g")').motivo, /no es hex/);
  assert.match(estado('bytes("abc")').motivo, /no es hex/);
  assert.match(estado('bytes(12)').motivo, /convierte un texto hex/);
  assert.match(estado('sha256("abc")').motivo, /son bytes, no «abc»/);
  assert.match(estado('bytes("00").1').motivo, /no tienen posiciones/);
  assert.match(estado('bytes("00") + 1').motivo, /espera un número/);
  assert.equal(estado('bytes(epoch.9)').estado, 'PENDIENTE', 'un argumento vacío falta');
});

test('hash(x): SHA-256 de la serialización canónica (la del id de evento); con bytes, de los bytes; con etiqueta, el de BIP-340', () => {
  assert.equal(vale('hex(hash("abc"))'), hx(sha(Buffer.from('"abc"'))));
  assert.equal(vale('hex(hash(12))'), hx(sha(Buffer.from('12'))));
  assert.equal(vale('hex(hash(bytes("0102")))'), hx(sha(bx('0102'))));
  const t = sha(Buffer.from('mi/etiqueta'));
  assert.equal(vale('hex(hash("abc", "mi/etiqueta"))'), hx(sha(Buffer.concat([t, t, Buffer.from('"abc"')]))));
  assert.equal(vale('hex(hash(bytes("0102"), "mi/etiqueta"))'), hx(sha(Buffer.concat([t, t, bx('0102')]))));
  assert.match(estado('hash(epoch)').motivo, /décupla no tiene valor/);
});

test('cat, slice, reverse, le y below', () => {
  assert.equal(vale('hex(cat(bytes("01"), bytes("0203"), bytes("")))'), '010203');
  assert.equal(vale('hex(slice(bytes("00112233"), 1, 3))'), '1122');
  assert.equal(vale('hex(slice(bytes("00112233"), 4, 4))'), '');
  assert.match(estado('slice(bytes("0011"), 1, 3)').motivo, /0 ≤ desde ≤ hasta ≤ 2/);
  assert.equal(vale('hex(reverse(bytes("010203")))'), '030201');
  assert.equal(vale('le(bytes("29ab5f49"))'), 1231006505);
  assert.equal(vale('le(bytes("00f2052a01000000"))'), 5000000000);
  assert.match(estado('le(bytes("000000000000000000"))').motivo, /de 1 a 8 bytes/);
  assert.equal(vale('below(bytes("00ff"), bytes("0100"))'), true);
  assert.equal(vale('below(bytes("0100"), bytes("0100"))'), false);
  assert.match(estado('below(bytes("00"), bytes("0000"))').motivo, /misma longitud/);
});

// ---------- Bitcoin: el bloque génesis ----------

const GENESIS = '0100000000000000000000000000000000000000000000000000000000000000000000003ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a29ab5f49ffff001d1dac2b7c';
const COINBASE = '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff4d04ffff001d0104455468652054696d65732030332f4a616e2f32303039204368616e63656c6c6f72206f6e206272696e6b206f66207365636f6e64206261696c6f757420666f722062616e6b73ffffffff0100f2052a01000000434104678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5fac00000000';
const HASH_GENESIS = '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f';
const RAIZ_GENESIS = '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b';

test('cabecera: el bloque génesis de Bitcoin (hash, raíz, hora, bits, nonce, objetivo) y su prueba de trabajo con below', () => {
  const c = ctx([[GENESIS]]);
  const de = (d) => vale('first cabecera(bytes(first epoch.0)).' + d, c);
  assert.equal(de(1), 1);
  assert.equal(hx(de(2).b), '0'.repeat(64));
  assert.equal(hx(de(3).b), rev(RAIZ_GENESIS), 'la raíz, en el orden interno');
  assert.equal(vale('hex(reverse(first cabecera(bytes(first epoch.0)).3))', c), RAIZ_GENESIS);
  assert.equal(de(4), 1231006505);
  assert.equal(de(5), 0x1d00ffff);
  assert.equal(de(6), 2083236893);
  assert.equal(vale('hex(reverse(first cabecera(bytes(first epoch.0)).7))', c), HASH_GENESIS);
  assert.equal(hx(de(8).b), '00000000ffff' + '0'.repeat(52), 'el objetivo desde los bits 1d00ffff');
  assert.equal(vale('below(reverse(first cabecera(bytes(first epoch.0)).7), first cabecera(bytes(first epoch.0)).8)', c), true, 'prueba de trabajo');
  // Un nonce cambiado: la cabecera ya no cumple el objetivo.
  const mala = GENESIS.slice(0, -8) + '1dac2b7d';
  assert.equal(vale('below(reverse(first cabecera(bytes(first epoch.0)).7), first cabecera(bytes(first epoch.0)).8)', ctx([[mala]])), false);
  assert.match(estado('cabecera(bytes("00"))').motivo, /80 bytes/);
});

test('tx: la coinbase del génesis (entradas, salidas, sin testigo, locktime, txid = la raíz de la cabecera)', () => {
  const c = ctx([[COINBASE], [GENESIS]]);
  const t = 'first tx(bytes(first epoch.0))';
  assert.equal(vale('count ' + t + '.1', c), 1);
  assert.equal(vale('hex(first (first ' + t + '.1).0)', c), '0'.repeat(64));
  assert.equal(vale('first (first ' + t + '.1).1', c), 4294967295);
  assert.match(vale('hex(first (first ' + t + '.1).2)', c), /5468652054696d6573/, 'el scriptSig con «The Times»');
  assert.equal(vale('count ' + t + '.2', c), 1);
  assert.equal(vale('first (first ' + t + '.2).0', c), 5000000000);
  assert.match(vale('hex(first (first ' + t + '.2).1)', c), /^4104678afdb0/);
  assert.equal(vale('count ' + t + '.3', c), 0);
  assert.equal(vale('first ' + t + '.4', c), 0);
  assert.equal(vale('hex(reverse(first ' + t + '.5))', c), RAIZ_GENESIS);
  assert.equal(vale('first ' + t + '.5 = first cabecera(bytes(first epoch.1)).3', c), true);
  assert.equal(vale('sha256d(bytes(first epoch.0)) = first ' + t + '.5', c), true);
  assert.match(estado('tx(bytes("' + COINBASE + '00"))').motivo, /sobran 1 bytes/);
  assert.match(estado('tx(bytes("' + COINBASE.slice(0, -10) + '"))').motivo, /se acaba antes de tiempo|no cabe en lo que queda/);
});

test('tx: una transacción con testigo (BIP-144) hecha a mano: el txid no cubre el testigo; los testigos se leen por entrada', () => {
  const entrada = 'aa'.repeat(32) + '01000000' + '00' + 'fdffffff';
  const salida = '1027000000000000' + '16' + '0014' + 'bb'.repeat(20);
  const testigo = '02' + '20' + 'cc'.repeat(32) + '01' + '51';
  const crudo = '02000000' + '0001' + '01' + entrada + '01' + salida + testigo + '00000000';
  const sinTestigo = '02000000' + '01' + entrada + '01' + salida + '00000000';
  const c = ctx([[crudo]]);
  const t = 'first tx(bytes(first epoch.0))';
  assert.equal(vale('hex(first ' + t + '.5)', c), hx(shad(bx(sinTestigo))));
  assert.equal(vale('first (first ' + t + '.2).0', c), 10000);
  assert.equal(vale('count ' + t + '.3', c), 1);
  assert.equal(vale('count (first ' + t + '.3).0', c), 2);
  assert.equal(vale('hex(first (first ' + t + '.3).0)', c), 'cc'.repeat(32));
  assert.equal(vale('hex(sha256(first (first ' + t + '.3).0))', c), hx(sha(bx('cc'.repeat(32)))), 'una preimagen del testigo, hasheada');
  assert.equal(vale('first (first ' + t + '.1).3', c), 0xfffffffd);
});

// ---------- Merkle ----------

test('merkle «bitcoin»: el árbol de una tx (la raíz es el txid, camino vacío) y uno de tres con el impar duplicado', () => {
  const c1 = ctx([[COINBASE], [GENESIS]]);
  assert.equal(vale('merkle(first tx(bytes(first epoch.0)).5, epoch.9, "bitcoin") = first cabecera(bytes(first epoch.1)).3', c1), true);
  const [a, b, d] = ['01', '02', '03'].map((x) => shad(bx(x)));
  const ab = shad(Buffer.concat([a, b]));
  const dd = shad(Buffer.concat([d, d]));
  const raiz = hx(shad(Buffer.concat([ab, dd])));
  // Los caminos como en SIP-0.md: una décupla de pares [lado, hermano] (hex), de la hoja a la raíz.
  const datos = [[hx(a), hx(b), hx(d)], [['d', hx(b)], ['d', hx(dd)]], [['d', hx(d)], ['i', hx(ab)]], [raiz]];
  const c = ctx(datos);
  assert.equal(vale('hex(merkle(bytes(nth 0 epoch.0), epoch.1, "bitcoin"))', c), raiz);
  assert.equal(vale('hex(merkle(bytes(nth 2 epoch.0), epoch.2, "bitcoin"))', c), raiz, 'el impar se duplica: su hermano es él mismo');
  assert.equal(vale('hex(merkle(bytes(nth 1 epoch.0), epoch.1, "bitcoin")) = first epoch.3', c), false, 'otra hoja con el mismo camino');
  // El camino también vale como lista plana (lado, hermano, lado, hermano…), sin el tope de diez de una décupla.
  assert.equal(vale('hex(merkle(bytes(nth 2 epoch.0), epoch.1, "bitcoin"))', ctx([[hx(a), hx(b), hx(d)], ['d', hx(d), 'i', hx(ab)]])), raiz);
  assert.match(estado('merkle(bytes(nth 0 epoch.0), epoch.1, "otro")', c).motivo, /«bitcoin» o «sip»/);
  assert.match(estado('merkle(bytes(nth 0 epoch.0), epoch.0, "sip")', c).motivo, /pares \[lado, hermano\]|lado de un paso/);
  assert.match(estado('merkle(bytes("00"), epoch.9, "sip")', c).motivo, /32 bytes/);
});

test('merkle «sip» (SIP-0.md, normativo): la misma raíz que el sellador de servidor/sim/stateark para cada id de lotes de 1, 2, 5 y 7', async () => {
  const sellador = await Sellador.crear({ inicio: '2026-11-12T00:00:00Z', reloj: () => Date.parse('2026-11-12T00:00:00Z') });
  for (const n of [1, 2, 5, 7]) {
    const ids = Array.from({ length: n }, (_, k) => hx(sha(Buffer.from('id ' + n + ' ' + k))));
    await sellador.sellar(ids);
    await sellador.minar();
    for (const id of ids) {
      const p = sellador.prueba(id);
      assert.ok(p && !p.pendiente);
      assert.equal((await sellador.verificar(id, p)).ok, true);
      // La prueba copiada en BTML, como el sello de tiempo de SIP-0.md: 3 la raíz del lote, 4 el camino, 5 la hoja.
      const c = ctx([['sello de tiempo'], [p.altura], [p.hash], [p.lote], p.prueba.camino, [id]]);
      assert.equal(vale('hex(merkle(bytes(first epoch.5), epoch.4, "sip")) = first epoch.3', c), true, n + ' ids, ' + id.slice(0, 8));
      assert.equal(vale('merkle(bytes(first epoch.5), epoch.4, "sip") = bytes(first epoch.3)', c), true);
      // A mano, la definición de SIP-0.md: hoja = SHA-256(0x00 ‖ id), nodo = SHA-256(0x01 ‖ izq ‖ der).
      let actual = sha(Buffer.concat([Buffer.of(0), bx(id)]));
      for (const [lado, h] of p.prueba.camino) actual = sha(Buffer.concat([Buffer.of(1), ...(lado === 'i' ? [bx(h), actual] : [actual, bx(h)])]));
      assert.equal(hx(actual), p.lote);
      // Otra hoja con ese camino no da la raíz; el esquema «bitcoin» tampoco.
      assert.equal(vale('hex(merkle(sha256(bytes(first epoch.5)), epoch.4, "sip")) = first epoch.3', c), false);
      assert.equal(vale('hex(merkle(bytes(first epoch.5), epoch.4, "bitcoin")) = first epoch.3', c), false);
    }
    if (n === 1) assert.equal(sellador.prueba(ids[0]).prueba.camino.length, 0, 'un lote de un id: camino vacío, la raíz es su hoja');
  }
});

// ---------- OpenTimestamps ----------

test('ots: un camino sintético de pasos prepend, append y sha256 da lo que llega a la cabecera', () => {
  const raiz = sha(Buffer.from('lote'));
  let x = Buffer.concat([bx('aabb'), raiz]);
  x = Buffer.concat([x, bx('cc')]);
  x = sha(x);
  x = sha(Buffer.concat([bx('dd'), x]));
  const pasos = [['prepend', 'aabb'], ['append', 'cc'], ['sha256'], ['prepend', 'dd'], ['sha256']];
  const c = ctx([[hx(raiz)], pasos, [hx(x)]]);
  assert.equal(vale('hex(ots(bytes(first epoch.0), epoch.1))', c), hx(x));
  assert.equal(vale('ots(bytes(first epoch.0), epoch.1) = bytes(first epoch.2)', c), true);
  assert.match(estado('ots(bytes(first epoch.0), epoch.0)', c).motivo, /paso desconocido/);
  assert.match(estado('ots(bytes(first epoch.0), epoch.9)', c).estado, /RESUELTO/, 'sin pasos, la raíz tal cual');
});

// ---------- BIP-340 ----------

function vectores() {
  const [, ...filas] = readFileSync(new URL('./bip340-vectores.csv', import.meta.url), 'utf8').trim().split(/\r?\n/);
  return filas.map((f) => {
    const [indice, , publica, , mensaje, firma, resultado, ...comentario] = f.split(',');
    return { indice: Number(indice), publica: publica.toLowerCase(), mensaje: mensaje.toLowerCase(), firma: firma.toLowerCase(), valida: resultado === 'TRUE', comentario: comentario.join(',') };
  });
}

test('signed: los vectores oficiales de BIP-340 de 32 bytes (válidos e inválidos)', () => {
  const de32 = vectores().filter((v) => v.mensaje.length === 64);
  assert.ok(de32.filter((v) => v.valida).length >= 3 && de32.filter((v) => !v.valida).length >= 2);
  for (const v of de32) {
    const r = estado('signed(bytes("' + v.firma + '"), bytes("' + v.mensaje + '"), bytes("' + v.publica + '"))');
    assert.equal(r.estado, 'RESUELTO', 'vector ' + v.indice + ': ' + r.motivo);
    assert.equal(r.valor[0], v.valida, 'vector ' + v.indice + ' ' + v.comentario);
  }
  // Longitudes que no son las de BIP-340: no es una firma válida.
  const v = de32[0];
  assert.equal(vale('signed(bytes("' + v.firma.slice(2) + '"), bytes("' + v.mensaje + '"), bytes("' + v.publica + '"))'), false);
  assert.match(estado('signed("' + v.firma + '", bytes("' + v.mensaje + '"), bytes("' + v.publica + '"))').motivo, /son bytes/);
});

test('signed sobre bytes(id) de un evento real firmado: el mensaje de un registro firmado es bytes(id)', async () => {
  const { publica, privada } = await generarClaves();
  const ev = await firmar(await crearEvento({ autor: 'ana', sobre: null, t: '2026-11-12T10:00:00Z', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'ana', a: null }], payload: ['firmado'] }), privada);
  const otro = await crearEvento({ autor: 'ana', sobre: null, t: '2026-11-12T10:01:00Z', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'ana', a: null }], payload: ['otro'] });
  const formula = (e) => 'signed(bytes("' + ev.firma + '"), bytes(first ev.5), bytes("' + publica + '"))';
  assert.equal(vale(formula(ev), new ContextoEje(null, { ev })), true);
  assert.equal(vale(formula(otro), new ContextoEje(null, { ev: otro })), false, 'la misma firma sobre otro id');
  const { publica: ajena } = await generarClaves();
  assert.equal(vale('signed(bytes("' + ev.firma + '"), bytes(first ev.5), bytes("' + ajena + '"))', new ContextoEje(null, { ev })), false, 'con otra clave');
});

// ---------- forma ----------

test('forma: las primitivas son llamadas con su número de argumentos; no son verbos (una regla que las usa solo lee)', () => {
  assert.deepEqual(Object.keys(VERIFICACION).sort(), ['below', 'bytes', 'cabecera', 'cat', 'hash', 'hex', 'le', 'merkle', 'ots', 'reverse', 'sha256', 'sha256d', 'signed', 'slice', 'tx', 'utf8']);
  assert.match(estado('hash').motivo, /se escribe con sus argumentos entre paréntesis/);
  assert.match(estado('slice(bytes("00"), 1)').motivo, /lleva 3 argumentos, no 2/);
  assert.match(estado('hash(1, "a", "b")').motivo, /lleva 1 o 2 argumentos, no 3/);
  assert.match(estado('cat()').motivo, /al menos 1/);
  assert.deepEqual(queMueve('=signed(bytes("00"), bytes("00"), bytes("00")) and hash("a") = hash("a")'), { verbo: null, put: false });
  assert.doesNotThrow(() => analizar('count (epoch.1 where below(bytes(it.0), bytes("ff"))) = 1'));
});

// ---------- las reglas del SIP 0 ----------

const SIP = 'C:/Users/acer/Documents/InTheState/stateark/sip/reglas';

// El SIP está vivo (Core StateArk lo reescribe con las formas de §12): la prueba lee las reglas que haya, sin fijar
// cuántas. Todas han de analizarse; la única diferencia de forma admitida es la de su primer borrador, merkle(hoja,
// camino) sin esquema, que AGRAM no acepta (el esquema decide la raíz) y que con el esquema se analiza.
test('SIP 0: analizar acepta las reglas con las primitivas, sin sustituciones (salvo merkle sin esquema, que se señala)', { skip: !existsSync(SIP) && 'sin InTheState/stateark/sip en esta máquina' }, () => {
  const reglas = readdirSync(SIP).filter((f) => f.endsWith('.json')).map((f) => ({ f, r: JSON.parse(readFileSync(SIP + '/' + f, 'utf8')) }));
  assert.ok(reglas.length >= 6);
  const resultado = {};
  for (const { f, r } of reglas) {
    const formula = r[2][r[2].length - 1];
    const sujeto = r[4].includes('read');
    try {
      analizar(formula, { sujeto });
      resultado[f] = 'ok';
    } catch (e) {
      resultado[f] = e.message;
      assert.match(e.message, /merkle\(hoja, camino, esquema\) lleva 3 argumentos, no 2/, f + ': ' + e.message);
      const conEsquema = formula.replace(/merkle\(((?:[^()]|\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\))*)\)/g, (_, a) => 'merkle(' + a + ', "sip")');
      assert.doesNotThrow(() => analizar(conEsquema, { sujeto }), f);
    }
  }
  for (const f of ['authorized-by-the-holder.json', 'in-firm.json', 'linked.json', 'the-lock-ends-before-the-e.json']) assert.equal(resultado[f], 'ok', f);
});

// ---------- el candado §8 en Taproot (vector de rust-miniscript) ----------

// Copiado de InTheState/stateark/sim/test/vectores/miniscript.json (commit 7e1dae0, «candado»; rust-miniscript 12.3.7,
// 12-11-2026): las dos hojas Tapscript, su raíz y el scriptPubKey de la salida (clave de salida tras el ajuste).
const CANDADO = {
  hojas: [
    { script: '20f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9ad82012088a82053ada8e6de01c26ff43040887ba7b22bddce19f8658fd1ba00716ed79d15cd5e87', hoja: '610c3bb3ddccd47f975be55cc33fafe5b7840f953ac6bfde0b24be03c5b457ce' },
    { script: '20dff1d77f2a671c5f36183726db2341be58feae1da2deced843240f7b502ba659ad0300350cb1', hoja: '486c2838732af84245e815261f66fe421975ddc26756a248e6eeb55b7cffddf9' },
  ],
  raiz: '9fc59d5459419e447bd4a9f6fe44490569e7a0ff78fca3f03fee2e84d7c57c9b',
  scriptPubKey: '512082987f1522fde699327e97d9f0164bd4fccd88808f8b62c746ab4c5919aac1eb',
};

test('el candado §8 en Taproot: tx(b) saca la salida que paga a su scriptPubKey; las hojas y la raíz Tapscript salen con hash etiquetado', () => {
  // Una transacción sintética: una entrada cualquiera, una salida de 50 000 sat al candado y otra de cambio.
  const salidaCandado = '50c3000000000000' + '22' + CANDADO.scriptPubKey;
  const cambio = 'e803000000000000' + '16' + '0014' + 'bb'.repeat(20);
  const crudo = '02000000' + '01' + 'aa'.repeat(32) + '00000000' + '00' + 'ffffffff' + '02' + salidaCandado + cambio + '00000000';
  const c = ctx([[crudo], [CANDADO.scriptPubKey], [CANDADO.raiz], ...CANDADO.hojas.map((h) => [h.script, h.hoja])]);
  const t = 'first tx(bytes(first epoch.0))';
  assert.equal(vale('count (' + t + '.2 where first it.1 = bytes(first epoch.1) and first it.0 = 50000)', c), 1);
  assert.equal(vale('hex(first (first ' + t + '.2).1)', c), CANDADO.scriptPubKey);
  assert.equal(vale('hex(slice(first (first ' + t + '.2).1, 2, 34))', c), CANDADO.scriptPubKey.slice(4), 'la clave de salida x-only, tras OP_1 y el empuje de 32');
  // TapLeaf: hash etiquetado de 0xc0 ‖ longitud ‖ script; TapBranch: de las dos hojas, la menor primero.
  for (const k of [0, 1]) {
    const s = CANDADO.hojas[k].script;
    assert.equal(vale('hex(hash(cat(bytes("c0"), bytes("' + (s.length / 2).toString(16).padStart(2, '0') + '"), bytes(nth 0 epoch.' + (3 + k) + ')), "TapLeaf")) = nth 1 epoch.' + (3 + k), c), true, 'hoja ' + k);
  }
  const [a, b] = CANDADO.hojas.map((h) => 'bytes("' + h.hoja + '")');
  assert.equal(vale('below(' + b + ', ' + a + ')', c), true);
  assert.equal(vale('hex(hash(cat(' + b + ', ' + a + '), "TapBranch")) = first epoch.2', c), true);
});
