// Consola: imprime la décupla de la compra en Pointed, las hileras en
// Sequenced y los saldos. `node ejemplos/ikisai/correr.mjs`.

import { ejemploCompra } from './compra-food.mjs';
import { decupla, render } from '../../src/pointed.js';
import { secuencia, render as renderSecuencia } from '../../src/sequenced.js';

const { eje, compra } = await ejemploCompra();
console.log(render(decupla(compra)));
console.log('\n' + renderSecuencia(secuencia(eje, compra.id)));
console.log('\n' + renderSecuencia(secuencia(eje, eje.genesisId, { sentido: 'hijos' })));
console.log('saldos · cocina EUR:', eje.saldo('cocina', 'E:EUR'), '· huesped EUR:', eje.saldo('huesped', 'E:EUR'), '· huesped horas:', eje.saldoT('huesped', 'hora'));
