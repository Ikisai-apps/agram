// Ejemplo transversal con datos inventados: una compra de comida en una casa
// de eventos. Muestra el eje de punta a punta: génesis, identidades que nacen
// al recibir tokens, un evento de compra con payload BTML y su décupla en
// Pointed. Nada de esto es real.

import { Eje } from '../../src/eje.js';
import { decupla, render } from '../../src/pointed.js';
import { pathToFileURL } from 'node:url';

export async function ejemploCompra() {
  const t = '2026-11-07T09:00:00Z';
  const eje = await Eje.genesis({
    identidad: 'casa',
    emision: [
      { token: 'T', escala: 'hora', cantidad: 1000 },
      { token: 'E', denominacion: 'EUR', cantidad: 500 },
      { token: 'P', cantidad: 10 },
    ],
    foco: 'Casa de ejemplo',
    t,
  });

  // La casa da de alta a cocina y a una persona huésped: existen al recibir tokens.
  const alta = await eje.escribir({
    autor: 'casa',
    sobre: eje.genesisId,
    t,
    movimientos: [
      { token: 'T', escala: 'minuto', cantidad: 1, de: 'casa', a: null },
      { token: 'T', escala: 'hora', cantidad: 40, de: 'casa', a: 'cocina' },
      { token: 'E', denominacion: 'EUR', cantidad: 60, de: 'casa', a: 'huesped' },
      { token: 'T', escala: 'hora', cantidad: 24, de: 'casa', a: 'huesped' },
    ],
    payload: ['Altas del fin de semana', ['cocina', 'huesped']],
  });

  // Cocina publica el menú del día sobre las altas.
  const menu = await eje.escribir({
    autor: 'cocina',
    sobre: alta.id,
    t,
    movimientos: [{ token: 'T', escala: 'hora', cantidad: 2, de: 'cocina', a: null }],
    payload: ['Menú del día', ['ensalada', 'guiso', 'fruta'], ['sin gluten', 'vegetariano']],
  });

  // La persona huésped compra el menú: paga E a cocina y gasta su tiempo.
  const compra = await eje.escribir({
    autor: 'huesped',
    sobre: menu.id,
    t: '2026-11-07T13:30:00Z',
    movimientos: [
      { token: 'T', escala: 'hora', cantidad: 1, de: 'huesped', a: null },
      { token: 'E', denominacion: 'EUR', cantidad: 12, de: 'huesped', a: 'cocina' },
    ],
    payload: [
      'Compra del menú del día',
      [{ ref: menu.id, dir: '1000000000' }, 1, 'EUR 12'], // 1 recursos: qué, cuánto, a qué precio
      [{ ref: menu.id, dir: '2000000000' }], // 2 criterios: los del menú
      ['huesped', 'cocina'], // 3 comunicación: quién habla con quién
      ['pagar', 'servir'], // 4 fábrica: la acción que se registra
    ],
  });

  return { eje, alta, menu, compra };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { eje, compra } = await ejemploCompra();
  console.log(render(decupla(compra)));
  console.log('\nhilo:', eje.hilo(compra.id).map((e) => (Array.isArray(e.payload) ? e.payload[0] : e.payload)).join(' ← '));
  console.log('saldos · cocina EUR:', eje.saldo('cocina', 'E:EUR'), '· huesped EUR:', eje.saldo('huesped', 'E:EUR'), '· huesped horas:', eje.saldoT('huesped', 'hora'));
}
