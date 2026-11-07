// Consola: imprime la décupla de la compra en Pointed, las hileras en
// Sequenced y los saldos. `node ejemplos/ikisai/correr.mjs`.

import { ejemploCompra, ejemploCuenta } from './compra-food.mjs';
import { decupla, render } from '../../src/pointed.js';
import { secuencia, render as renderSecuencia } from '../../src/sequenced.js';
import { evaluar } from '../../src/bql.js';
import { ejemploLente, valoresParaLaCasa, valorEnBql } from './lente-booking.mjs';
import { detalleValor } from '../../src/lente.js';

const { eje, compra } = await ejemploCompra();
const cuenta = await ejemploCuenta(eje, compra);
console.log(render(decupla(compra)));
console.log('\ncuenta · 1:', evaluar(eje, cuenta.id, [1]).texto, '· 2:', evaluar(eje, cuenta.id, [2]).texto, '· 3:', evaluar(eje, cuenta.id, [3]).texto);
console.log('\n' + renderSecuencia(secuencia(eje, compra.id)));
console.log('\n' + renderSecuencia(secuencia(eje, eje.genesisId, { sentido: 'hijos' })));
console.log('saldos · cocina EUR:', eje.saldo('cocina', 'E:casa/EUR'), '· huesped EUR:', eje.saldo('huesped', 'E:casa/EUR'), '· huesped T:', eje.tiempos('huesped').map((x) => x.cantidad + ' ' + x.escala).join(', '));
console.log('series · ' + eje.series().map((s) => s.clave + ' ' + s.emitido + ' de ' + s.emisor).join(' · '));

// La lente de R (R6): la casa de Booking valora la R de su huésped solo con la lente que ha firmado.
const lente = await ejemploLente();
console.log('\nlente de R · valor para la casa:', JSON.stringify(valoresParaLaCasa(lente.eje)));
console.log('lente de R · detalle de la huésped:', JSON.stringify(detalleValor(lente.eje, 'casa', 'huesped').porEmisor));
console.log('lente de R · BQL de la casa:', valorEnBql(lente.eje, lente.reserva).texto);
console.log('lente de R · BQL de recepción (sin lente):', valorEnBql(lente.eje, lente.reserva, 'recepcion').texto);
