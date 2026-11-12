// Las transacciones del carril de pagos, SERIALIZADAS COMO BITCOIN, para que AGRAM las lea con su `tx(b)`
// y la regla «paid» las compruebe sin fiarse de nadie (Core AGRAM, 13-11).
//
// El carril sigue razonando con su modelo JSON (`stateark-sim/tx@1`); de él sale la transacción cruda:
//   versión 2 · entradas · salidas · locktime 0; con testigo (BIP-144) solo si alguna entrada lo lleva.
//   txid = doble SHA-256 de la serialización SIN testigo, en orden interno de bytes (el que va en las entradas
//   y en el Merkle del bloque; un explorador lo enseña al revés).
//
// Los scripts de salida (lo que el recibo llama «destino»):
//   simbc1<40 hex>      → 0014<20 bytes>          (forma P2WPKH; la simulación no tiene claves de gasto)
//   simhtlc1… con política Miniscript → 5120<Q>   (P2TR de verdad: TapTweak(NUMS, raíz de las dos hojas))
//   simhtlc1<40 hex> sin política → 0014<20 bytes>
//   puntero «agram:<id>» → 6a46<los 70 bytes del texto>  (OP_RETURN)
// Entradas: el grifo es una entrada de tipo coinbase (txid cero, vout ffffffff, scriptSig con 32 bytes al
// azar); el resto, txid:vout sin scriptSig. El cobro de un candado lleva la preimagen como único testigo.

import { sha256d, leHex } from './hash.js';
import { claveDeSalida } from './taproot.js';

const CERO = '00'.repeat(32);

function compacto(n) {
  if (n < 0xfd) return n.toString(16).padStart(2, '0');
  if (n <= 0xffff) return 'fd' + leHex(n, 2);
  return 'fe' + leHex(n, 4);
}

const utf8Hex = (t) => [...new TextEncoder().encode(t)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** El script de una salida del modelo JSON. */
export async function scriptDe(salida) {
  if (salida.op_return !== undefined) {
    const datos = utf8Hex(salida.op_return);
    if (datos.length / 2 > 75) throw new TypeError('OP_RETURN de más de 75 bytes: fuera del subconjunto de la simulación');
    return '6a' + compacto(datos.length / 2) + datos;
  }
  if (salida.candado?.politica) return '5120' + (await claveDeSalida(salida.candado.politica.interna, salida.candado.politica.raiz));
  const m = /^sim(?:bc|htlc)1([0-9a-f]{40})$/.exec(salida.direccion ?? '');
  if (!m) throw new TypeError(`no sé el script de «${salida.direccion}»`);
  return '0014' + m[1];
}

function entrada(e) {
  return e.txid + leHex(e.vout, 4) + '00' + 'fdffffff';
}

function testigo(e) {
  return e.preimagen ? '01' + '20' + e.preimagen : '00';
}

/** La transacción cruda: { cruda (hex, con testigo si lo hay), txid (orden interno), scripts por vout }. */
export async function serializar(tx) {
  const entradas = tx.entradas.length
    ? tx.entradas.map(entrada)
    : [CERO + 'ffffffff' + '20' + tx.grifo + 'ffffffff']; // el grifo: una entrada coinbase
  const scripts = await Promise.all(tx.salidas.map(scriptDe));
  const salidas = tx.salidas.map((s, i) => leHex(s.sat, 8) + compacto(scripts[i].length / 2) + scripts[i]);
  const cuerpo = compacto(entradas.length) + entradas.join('') + compacto(salidas.length) + salidas.join('');
  const sinTestigo = '02000000' + cuerpo + '00000000';
  const conTestigo = tx.entradas.some((e) => e.preimagen);
  const cruda = conTestigo ? '02000000' + '0001' + cuerpo + tx.entradas.map(testigo).join('') + '00000000' : sinTestigo;
  return { cruda, txid: await sha256d(sinTestigo), scripts };
}
