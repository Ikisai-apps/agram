import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Eje } from '../src/eje.js';
import { crearEvento } from '../src/evento.js';
import { generarClaves, firmar, verificar, exportarPrivada, importarPrivada, publicaDe, clavePublicaValida, firmarPosesion, verificarPosesion, huella } from '../src/autoridad.js';
import { schnorr } from '../src/vendor/noble-secp256k1.js';
import { entrarPorInvitacion } from '../ejemplos/ikisai/altas.mjs';

const T0 = '2026-11-06T20:00:00Z';
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

test('firmar y verificar un evento; el id no cambia con la firma', async () => {
  const { publica, privada } = await generarClaves();
  const ev = await crearEvento({ autor: 'ana', sobre: 'g', t: T0, movimientos: [gastaT('ana')], payload: 'hola' });
  const f = await firmar(ev, privada);
  assert.equal(f.id, ev.id);
  assert.equal(f.firmante, 'ana');
  assert.equal(await verificar(f, publica), true);
  const otra = await generarClaves();
  assert.equal(await verificar(f, otra.publica), false);
  assert.equal(await verificar(ev, publica), false);
});

test('génesis con clave: el autor debe firmar; sin firma se rechaza', async () => {
  const { publica, privada } = await generarClaves();
  const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [{ token: 'R', cantidad: 1 }, { token: 'E', denominacion: 'minuto', cantidad: 600 }], foco: 'g', t: T0, clave: publica, privada });
  assert.deepEqual(eje.clave('raiz'), publica);
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz')], payload: 'sin firma' }), /who has a key signs: raiz has a key/);
  const ev = await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz')], payload: 'firmado' }, privada);
  assert.equal(ev.firmante, 'raiz');
  const ajena = await generarClaves();
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz')], payload: 'otra clave' }, ajena.privada), /firma inválida/);
});

test('nadie mueve tokens ajenos', async () => {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [{ token: 'R', cantidad: 1 }, { token: 'E', denominacion: 'minuto', cantidad: 600 }], foco: 'g', t: T0 });
  await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz'), { token: 'E', emisor: 'raiz', denominacion: 'minuto', cantidad: 1, de: 'raiz', a: 'bea' }], payload: 'alta' });
  await assert.rejects(
    eje.escribir({ autor: 'bea', sobre: eje.genesisId, t: T0, movimientos: [gastaT('bea'), { token: 'E', emisor: 'raiz', denominacion: 'minuto', cantidad: 1, de: 'raiz', a: 'bea' }], payload: 'robo' }),
    /nobody moves tokens of others/,
  );
});

test('una persona nace con clave si la declara en su propia alta (B1), al aceptar la invitación, firmada con ella; luego debe firmar', async () => {
  const raiz = await generarClaves();
  const bea = await generarClaves();
  const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [{ token: 'R', cantidad: 1 }, { token: 'E', denominacion: 'minuto', cantidad: 600 }], foco: 'g', t: T0, clave: raiz.publica, privada: raiz.privada });
  // B1 (VG, 10-11): la persona escribe su propia alta, con su clave y firmada con ella (su prueba de posesión); desde el
  // encargo 3b, aceptando la invitación de raiz que nombra esa clave (mapa §16 [D] «El árbol mínimo es la invitación»).
  await entrarPorInvitacion(eje, { por: 'raiz', quien: 'bea', t: T0, clave: bea, privadaDe: () => raiz.privada });
  await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz'), { token: 'E', emisor: 'raiz', denominacion: 'minuto', cantidad: 2, de: 'raiz', a: 'bea' }], payload: 'minutos para bea' }, raiz.privada);
  assert.deepEqual(eje.clave('bea'), bea.publica);
  // Sobre su propia alta (sobre la de raiz, el génesis, pagaría el precio de su atención: revisión de seguridad, encargo 3b).
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: eje.alta('bea').id, t: T0, movimientos: [gastaT('bea')], payload: 'x' }), /who has a key signs: bea has a key/);
  const ok = await eje.escribir({ autor: 'bea', sobre: eje.alta('bea').id, t: T0, movimientos: [gastaT('bea')], payload: 'x' }, bea.privada);
  assert.equal(ok.autor, 'bea');
  // No se puede cambiar una clave ya registrada, ni declarar una clave sin dar tokens.
  const otra = await generarClaves();
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz')], payload: 'cambio', contexto: { claves: { bea: otra.publica } } }, raiz.privada), /a key is declared at its alta: bea already has an account/);
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz')], payload: 'sin tokens', contexto: { claves: { cris: otra.publica } } }, raiz.privada), /a key is declared at its alta/);
});

test('exigirFirmas: todo autor necesita clave; el génesis debe ir firmado', async () => {
  await assert.rejects(Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [], foco: 'g', t: T0, exigirFirmas: true }), /firmado/);
  const raiz = await generarClaves();
  const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [{ token: 'R', cantidad: 1 }, { token: 'E', denominacion: 'minuto', cantidad: 600 }], foco: 'g', t: T0, clave: raiz.publica, privada: raiz.privada, exigirFirmas: true });
  await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz'), { token: 'E', emisor: 'raiz', denominacion: 'minuto', cantidad: 1, de: 'raiz', a: 'bea' }], payload: 'alta sin clave' }, raiz.privada);
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: eje.genesisId, t: T0, movimientos: [gastaT('bea')], payload: 'x' }), /autor sin clave/);
});

test('la clave privada se guarda tal cual (hex) y se comprueba al leerla', async () => {
  const { publica, privada } = await generarClaves();
  const guardable = await exportarPrivada(privada);
  assert.equal(guardable, privada);
  const otraVez = await importarPrivada(guardable);
  const ev = await crearEvento({ autor: 'ana', sobre: 'g', t: T0, movimientos: [gastaT('ana')], payload: 'hola' });
  assert.equal(await verificar(await firmar(ev, otraVez), publica), true);
  await assert.rejects(importarPrivada(JSON.stringify({ kty: 'EC', crv: 'P-256', d: 'abc' })), /clave privada inválida/);
});

// ---------- BIP-340: formato, vectores oficiales y la librería vendorizada ----------

/** El sha256 del archivo vendorizado (src/vendor/LEEME.md); la función de borde lleva una copia idéntica. */
const SHA256_VENDOR = '75335671f06a2a71b38c663cda8938f5478037e953632e5a3dbe866841f04a64';
const N = 'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141'; // el orden de secp256k1
const P = 'fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f'; // el primo del cuerpo

test('la librería vendorizada es la del LEEME (sha256) y la función de borde lleva la misma, byte a byte', () => {
  const sha = (ruta) => createHash('sha256').update(readFileSync(new URL(ruta, import.meta.url))).digest('hex');
  assert.equal(sha('../src/vendor/noble-secp256k1.js'), SHA256_VENDOR);
  assert.equal(sha('../servidor/supabase/funciones/eventos/noble-secp256k1.js'), SHA256_VENDOR);
  assert.ok(readFileSync(new URL('../src/vendor/LEEME.md', import.meta.url), 'utf8').includes(SHA256_VENDOR), 'el LEEME dice el sha256');
});

/** Los vectores oficiales de BIP-340 (test/bip340-vectores.csv: bip-0340/test-vectors.csv del repositorio bitcoin/bips). */
function vectores() {
  const [cabecera, ...filas] = readFileSync(new URL('./bip340-vectores.csv', import.meta.url), 'utf8').trim().split(/\r?\n/);
  assert.equal(cabecera, 'index,secret key,public key,aux_rand,message,signature,verification result,comment');
  return filas.map((f) => {
    const [indice, privada, publica, aux, mensaje, firma, resultado, ...comentario] = f.split(',');
    return { indice: Number(indice), privada: privada.toLowerCase(), publica: publica.toLowerCase(), aux: aux.toLowerCase(), mensaje: mensaje.toLowerCase(), firma: firma.toLowerCase(), valida: resultado === 'TRUE', comentario: comentario.join(',') };
  });
}
const bytes = (h) => Uint8Array.from(h.match(/.{2}/g) ?? [], (x) => parseInt(x, 16));
const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

test('BIP-340: los 19 vectores oficiales con la librería (clave pública, firma con su aux_rand y verificación)', () => {
  const vs = vectores();
  assert.equal(vs.length, 19);
  for (const v of vs) {
    const caso = 'vector ' + v.indice + ' ' + v.comentario;
    if (v.privada) {
      assert.equal(hex(schnorr.getPublicKey(bytes(v.privada))), v.publica, caso);
      assert.equal(hex(schnorr.sign(bytes(v.mensaje), bytes(v.privada), bytes(v.aux))), v.firma, caso);
    }
    assert.equal(schnorr.verify(bytes(v.firma), bytes(v.mensaje), bytes(v.publica)), v.valida, caso);
  }
});

test('BIP-340: los vectores de 32 bytes por src/autoridad.js (publicaDe, verificar, posesión, clavePublicaValida); los inválidos, rechazados', async () => {
  const de32 = vectores().filter((v) => v.mensaje.length === 64);
  assert.equal(de32.length, 15);
  for (const v of de32) {
    const caso = 'vector ' + v.indice + ' ' + v.comentario;
    if (v.privada) assert.equal(publicaDe(v.privada), v.publica, caso);
    // El id de un evento es el mensaje (los 32 bytes del SHA-256 del cuerpo): verificar es BIP-340 sobre él.
    assert.equal(await verificar({ id: v.mensaje, firma: v.firma }, v.publica), v.valida, caso);
    assert.equal(await verificarPosesion({ id: v.mensaje, posesion: { x: v.firma } }, 'x', v.publica), v.valida, caso);
  }
  // Vector 5: la x no es de ningún punto; vector 14: la x se sale del cuerpo. No son claves declarables.
  assert.equal(clavePublicaValida(de32.find((v) => v.indice === 5).publica), false);
  assert.equal(clavePublicaValida(de32.find((v) => v.indice === 14).publica), false);
  for (const v of de32.filter((x) => x.indice !== 5 && x.indice !== 14)) assert.equal(clavePublicaValida(v.publica), true, 'vector ' + v.indice);
});

test('BIP-340: firmar con autoridad da firmas que verifican (aux_rand al azar: dos firmas del mismo id difieren y valen las dos)', async () => {
  const v = vectores().find((x) => x.indice === 1);
  const ev = Object.freeze({ autor: 'ana', id: v.mensaje });
  const a = await firmar(ev, v.privada);
  const b = await firmar(ev, v.privada);
  assert.match(a.firma, /^[0-9a-f]{128}$/);
  assert.notEqual(a.firma, b.firma);
  assert.equal(await verificar(a, v.publica), true);
  assert.equal(await verificar(b, v.publica), true);
  // Con el aux_rand del vector, la librería da la firma del vector: autoridad solo pone el azar auxiliar.
  assert.equal(hex(schnorr.sign(bytes(v.mensaje), bytes(v.privada), bytes(v.aux))), v.firma);
});

test('formato: claves y firmas en hex en minúsculas, una sola escritura; lo demás no vale', async () => {
  const { publica, privada } = await generarClaves();
  assert.match(publica, /^[0-9a-f]{64}$/);
  assert.match(privada, /^[0-9a-f]{64}$/);
  assert.equal(publicaDe(privada), publica);
  assert.equal(huella(publica), publica.slice(0, 8));
  const ev = await firmar(await crearEvento({ autor: 'ana', sobre: 'g', t: T0, movimientos: [gastaT('ana')], payload: 'hola' }), privada);
  assert.equal(await verificar(ev, publica), true);
  // La misma firma o la misma clave en mayúsculas, con un prefijo o con otro largo no valen: una sola escritura.
  assert.equal(await verificar({ ...ev, firma: ev.firma.toUpperCase() }, publica), false);
  assert.equal(await verificar(ev, publica.toUpperCase()), false);
  assert.equal(await verificar(ev, '02' + publica), false);
  assert.equal(await verificar({ ...ev, firma: ev.firma + '00' }, publica), false);
  assert.equal(await verificar({ ...ev, firma: ev.firma.slice(0, 126) }, publica), false);
  assert.equal(await verificar({ ...ev, firma: undefined }, publica), false);
  assert.equal(await verificar(ev, { kty: 'EC', crv: 'P-256', x: 'AAAA', y: 'BBBB' }), false);
  // Claves públicas inválidas.
  for (const mala of [publica.toUpperCase(), '02' + publica, publica.slice(2), '', null, undefined, 42, { x: publica }, 'z'.repeat(64), P, 'f'.repeat(64)]) {
    assert.equal(clavePublicaValida(mala), false, JSON.stringify(mala));
  }
  // Claves privadas inválidas: cero, el orden n o más, mayúsculas, otro largo, otra forma.
  for (const mala of ['0'.repeat(64), N, 'f'.repeat(64), privada.toUpperCase(), privada.slice(2), '', null, { d: privada }]) {
    assert.throws(() => publicaDe(mala), undefined, JSON.stringify(mala));
    await assert.rejects(firmar(ev, mala), undefined, JSON.stringify(mala));
  }
});

test('posesión: la clave nueva firma el id del alta; otra clave o una firma tocada no la prueban', async () => {
  const nueva = await generarClaves();
  const otra = await generarClaves();
  const ev = await crearEvento({ autor: 'raiz', sobre: 'g', t: T0, movimientos: [gastaT('raiz')], payload: 'alta', contexto: { claves: { bea: nueva.publica } } });
  const conPrueba = await firmarPosesion(ev, 'bea', nueva.privada);
  assert.equal(conPrueba.id, ev.id);
  assert.match(conPrueba.posesion.bea, /^[0-9a-f]{128}$/);
  assert.equal(await verificarPosesion(conPrueba, 'bea', nueva.publica), true);
  assert.equal(await verificarPosesion(conPrueba, 'bea', otra.publica), false);
  assert.equal(await verificarPosesion(conPrueba, 'cris', nueva.publica), false);
  const tocada = conPrueba.posesion.bea.slice(0, -1) + (conPrueba.posesion.bea.endsWith('0') ? '1' : '0');
  assert.equal(await verificarPosesion({ ...conPrueba, posesion: { bea: tocada } }, 'bea', nueva.publica), false);
});

test('un eje real: génesis con clave, alta por invitación que nombra la clave entera, y la firma ajena se rechaza', async () => {
  const raiz = await generarClaves();
  const bea = await generarClaves();
  const eje = await Eje.genesis({ identidad: 'raiz', foco: ['p'], t: T0, clave: raiz.publica, privada: raiz.privada, exigirFirmas: true });
  const g = eje.obtener(eje.genesisId);
  assert.equal(g.contexto.claves.raiz, raiz.publica);
  assert.match(g.firma, /^[0-9a-f]{128}$/);
  assert.equal(await verificar(g, raiz.publica), true);
  await entrarPorInvitacion(eje, { por: 'raiz', quien: 'bea', t: T0, clave: bea, privadaDe: () => raiz.privada });
  assert.equal(eje.clave('bea'), bea.publica);
  // La invitación nombra la clave de bea en su 3.5: el hex entero.
  const inv = eje.obtener(eje.obtener(eje.alta('bea').id).sobre);
  assert.deepEqual(inv.payload[3][5], [bea.publica]);
  const ev = await eje.escribir({ autor: 'bea', sobre: eje.alta('bea').id, t: T0, movimientos: [gastaT('bea')], payload: 'firmado' }, bea.privada);
  assert.equal(await verificar(ev, bea.publica), true);
  const ajeno = await firmar(await crearEvento({ autor: 'bea', sobre: eje.alta('bea').id, t: T0, movimientos: [gastaT('bea')], payload: 'ajeno' }), raiz.privada);
  assert.deepEqual(await eje.validar(ajeno), ['firma inválida de bea']);
});
