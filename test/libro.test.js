// El libro de transacciones (la capa cero; VG, 9-11): cinco primitivas, anclaje y memo, atomicidad, saldos y bloqueos
// por salida, sumas y condiciones enchufables. Sin reglas de negocio: solo aritmética.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Libro, PRIMITIVAS, acunar, transferir, bloquear, liberar, quemar, transaccion } from '../src/libro.js';

const tx = (movimientos, extra = {}) => transaccion({ movimientos, ancla: { sobre: 'r1', en: '0000000000' }, memo: ['memo'], autor: 'ana', t: '2026-11-09T10:00:00Z', ...extra });

async function conSaldo() {
  const libro = new Libro();
  const r = await libro.aplicar(tx([acunar('E:ana/EUR', 'ana', 100), acunar('P:x', 'ana', 10)]));
  assert.deepEqual(r, { ok: true, motivos: [] });
  return libro;
}

test('libro: las cinco primitivas, y nada más', () => {
  assert.deepEqual(PRIMITIVAS, ['acunar', 'transferir', 'bloquear', 'liberar', 'quemar']);
  assert.deepEqual(acunar('S', 'a', 1), { primitiva: 'acunar', serie: 'S', a: 'a', cantidad: 1 });
  assert.deepEqual(transferir('S', 'a', 'b', 2), { primitiva: 'transferir', serie: 'S', de: 'a', a: 'b', cantidad: 2 });
  assert.deepEqual(bloquear('S', 'a', 3, 'sal'), { primitiva: 'bloquear', serie: 'S', de: 'a', cantidad: 3, salida: 'sal' });
  assert.deepEqual(liberar('S', 'a', 3, 'sal'), { primitiva: 'liberar', serie: 'S', de: 'a', cantidad: 3, salida: 'sal' });
  assert.deepEqual(quemar('S', 'a', 4), { primitiva: 'quemar', serie: 'S', de: 'a', cantidad: 4 });
  const t = tx([]);
  assert.deepEqual([t.ancla, t.memo, t.autor, t.firma, t.abre], [{ sobre: 'r1', en: '0000000000' }, ['memo'], 'ana', null, []]);
});

test('libro: acuñar, transferir, bloquear, liberar y quemar mueven el disponible y el bloqueado por salida', async () => {
  const libro = await conSaldo();
  assert.equal(libro.saldo('ana', 'E:ana/EUR'), 100);
  assert.equal((await libro.aplicar(tx([transferir('E:ana/EUR', 'ana', 'bea', 30)]))).ok, true);
  assert.deepEqual([libro.saldo('ana', 'E:ana/EUR'), libro.saldo('bea', 'E:ana/EUR')], [70, 30]);
  assert.equal((await libro.aplicar(tx([bloquear('E:ana/EUR', 'ana', 20, 'reserva'), bloquear('E:ana/EUR', 'ana', 5, 'otra')]))).ok, true);
  assert.equal(libro.saldo('ana', 'E:ana/EUR'), 45);
  assert.deepEqual([libro.bloqueado('ana', 'E:ana/EUR'), libro.bloqueado('ana', 'E:ana/EUR', 'reserva'), libro.bloqueado('ana', 'E:ana/EUR', 'otra')], [25, 20, 5]);
  assert.deepEqual(libro.bloqueos('ana'), [{ serie: 'E:ana/EUR', salida: 'reserva', cantidad: 20 }, { serie: 'E:ana/EUR', salida: 'otra', cantidad: 5 }]);
  assert.equal(libro.bloqueadoPorSalida('reserva', 'E:ana/EUR'), 20);
  assert.deepEqual(libro.bloqueosCon('reserva'), [{ titular: 'ana', serie: 'E:ana/EUR', cantidad: 20 }]);
  assert.equal((await libro.aplicar(tx([liberar('E:ana/EUR', 'ana', 20, 'reserva'), quemar('E:ana/EUR', 'ana', 15)]))).ok, true);
  assert.deepEqual([libro.saldo('ana', 'E:ana/EUR'), libro.bloqueado('ana', 'E:ana/EUR', 'reserva')], [50, 0]);
  // La cartera por series: lo que será la posición 1 del alta.
  assert.deepEqual(libro.vista('ana'), { 'E:ana/EUR': { disponible: 50, bloqueado: { otra: 5 } }, 'P:x': { disponible: 10, bloqueado: {} } });
  assert.deepEqual(libro.vista('bea'), { 'E:ana/EUR': { disponible: 30, bloqueado: {} } });
  // Lo acuñado y lo quemado se suman por serie.
  assert.deepEqual([libro.sumas({ primitiva: 'acunar', serie: 'E:ana/EUR' }), libro.sumas({ primitiva: 'quemar', serie: 'E:ana/EUR' })], [100, 15]);
});

test('libro: una transacción se aplica entera o nada (una primitiva que falla y nada cambia)', async () => {
  const libro = await conSaldo();
  const antes = [libro.saldo('ana', 'E:ana/EUR'), libro.saldo('bea', 'E:ana/EUR'), libro.longitud, libro.titulares()];
  const r = await libro.aplicar(tx([transferir('E:ana/EUR', 'ana', 'bea', 60), transferir('E:ana/EUR', 'ana', 'bea', 60)]));
  assert.equal(r.ok, false);
  assert.equal(r.motivos.length, 1);
  assert.equal(r.motivos[0].paso, 1);
  assert.equal(r.motivos[0].fallo.falta, 'disponible');
  assert.deepEqual([libro.saldo('ana', 'E:ana/EUR'), libro.saldo('bea', 'E:ana/EUR'), libro.longitud, libro.titulares()], antes);
  // Liberar lo que no está bloqueado con esa salida, quemar lo que no hay, bloquear de más: fallan y no tocan nada.
  for (const p of [liberar('E:ana/EUR', 'ana', 1, 'nada'), quemar('E:ana/EUR', 'bea', 1), bloquear('E:ana/EUR', 'ana', 102, 's')]) {
    const x = await libro.aplicar(tx([acunar('E:ana/EUR', 'ana', 1), p]));
    assert.equal(x.ok, false, p.primitiva);
    assert.equal(libro.saldo('ana', 'E:ana/EUR'), 100);
  }
  // Lo acuñado en la transacción se puede mover en ella misma: los pasos se simulan en orden.
  assert.equal((await libro.aplicar(tx([acunar('R:ana', 'ana', 5), transferir('R:ana', 'ana', 'bea', 5)]))).ok, true);
  assert.equal(libro.saldo('bea', 'R:ana'), 5);
});

test('libro: un grupo de primitivas es un paso atómico dentro de la transacción', async () => {
  const libro = await conSaldo();
  const s = libro.simular();
  // El grupo falla en su segunda primitiva: la primera tampoco queda.
  const fallo = s.paso([acunar('T:hora', 'ana', 3), quemar('T:hora', 'ana', 5)], 0);
  assert.equal(fallo.paso, 0);
  assert.equal(fallo.primitiva, 'quemar');
  assert.equal(s.saldo('ana', 'T:hora'), 0);
  assert.equal(s.paso([acunar('T:hora', 'ana', 5), quemar('T:hora', 'ana', 5)], 1), null);
  assert.equal(s.saldo('ana', 'T:hora'), 0);
  assert.equal(libro.sumas({ primitiva: 'quemar', serie: 'T:hora' }), 0); // la simulación no toca el libro
});

test('libro: la acuñación programada (tope por clase y etiqueta) y las fuentes (reposición)', async () => {
  const libro = new Libro();
  const gasto = (n) => tx([[acunar('T:hora', 'ana', n, { clase: 'asignacion', etiqueta: 20401, tope: 24 }), quemar('T:hora', 'ana', n)]]);
  assert.equal((await libro.aplicar(gasto(20))).ok, true);
  assert.equal(libro.sumas({ primitiva: 'acunar', serie: 'T:hora', titular: 'ana', clase: 'asignacion', etiqueta: 20401 }), 20);
  // Quedan 4 del tope: 5 no alcanza y el grupo entero falla.
  assert.equal((await libro.aplicar(gasto(5))).ok, false);
  assert.equal((await libro.aplicar(gasto(4))).ok, true);
  // Otra etiqueta (otro día), otro tope.
  assert.equal((await libro.aplicar(tx([[acunar('T:hora', 'ana', 24, { clase: 'asignacion', etiqueta: 20402, tope: 24 }), quemar('T:hora', 'ana', 24)]]))).ok, true);
  assert.equal(libro.saldo('ana', 'T:hora'), 0);
  assert.equal(libro.sumas({ primitiva: 'acunar', serie: 'T:hora', clase: 'asignacion' }), 48);
  // Fuentes: transferir P:x tomando primero de P:x y después de P:genesis; lo que sale de otra serie es una reposición.
  await libro.aplicar(tx([acunar('P:x', 'ana', 2), acunar('P:genesis', 'ana', 10)]));
  assert.equal((await libro.aplicar(tx([transferir('P:x', 'ana', 'bea', 5, { fuentes: ['P:x', 'P:genesis'] })]))).ok, true);
  assert.deepEqual([libro.saldo('ana', 'P:x'), libro.saldo('ana', 'P:genesis'), libro.saldo('bea', 'P:x')], [0, 7, 5]);
  assert.deepEqual([libro.sumas({ primitiva: 'quemar', serie: 'P:genesis', clase: 'reposicion' }), libro.sumas({ primitiva: 'acunar', serie: 'P:x', clase: 'reposicion' })], [3, 3]);
  assert.equal(libro.sumas({ primitiva: 'acunar', serie: 'P:x', clase: 'emision' }), 2);
  assert.equal((await libro.aplicar(tx([quemar('P:x', 'ana', 8, { fuentes: ['P:x', 'P:genesis'] })]))).ok, false);
});

test('libro: sumas por serie, registro, titular y tramo, y el diario', async () => {
  const libro = new Libro();
  const en = (sobre, movimientos) => libro.aplicar(tx(movimientos, { ancla: { sobre, en: '0000000000' } }));
  await en(null, [acunar('E:a/EUR', 'a', 10), acunar('E:a/EUR', 'b', 5)]);
  await en('r1', [quemar('E:a/EUR', 'a', 2)]);
  await en('r2', [quemar('E:a/EUR', 'a', 3), quemar('E:a/EUR', 'b', 1)]);
  await en('r1', [quemar('E:a/EUR', 'b', 4)]);
  assert.equal(libro.sumas({ primitiva: 'quemar', serie: 'E:a/EUR' }), 10);
  assert.equal(libro.sumas({ primitiva: 'quemar', serie: 'E:a/EUR', registro: 'r1' }), 6);
  assert.equal(libro.sumas({ primitiva: 'quemar', serie: 'E:a/EUR', registro: 'r2' }), 4);
  assert.equal(libro.sumas({ primitiva: 'quemar', serie: 'E:a/EUR', titular: 'b' }), 5);
  assert.equal(libro.sumas({ primitiva: 'quemar', serie: 'E:a/EUR', desde: 2, hasta: 4 }), 8);
  assert.equal(libro.sumas({ primitiva: 'quemar', serie: 'E:a/EUR', registro: 'r1', desde: 3 }), 4);
  assert.deepEqual(libro.sumas({ primitiva: 'acunar' }), { 'E:a/EUR': 15 });
  assert.deepEqual(libro.sumas({ registro: 'r2' }), { 'E:a/EUR': 4 });
  const diario = libro.asientos({ registro: 'r1' });
  assert.deepEqual(diario.map((a) => [a.n, a.primitiva, a.titular, a.cantidad]), [[1, 'quemar', 'a', 2], [3, 'quemar', 'b', 4]]);
  assert.equal(diario[0].tx.ancla.sobre, 'r1');
  assert.equal(libro.longitud, 4);
});

test('libro: las cuentas nacen con la primera transacción que da algo (o con abre), y esa es su alta', async () => {
  const libro = new Libro();
  const g = tx([], { abre: ['g'], id: 'g0' });
  await libro.aplicar(g);
  assert.deepEqual([libro.tiene('g'), libro.titulares(), libro.alta('g')], [true, ['g'], g]);
  const t1 = tx([acunar('R:g', 'g', 3), transferir('R:g', 'g', 'h', 1)], { id: 'e1' });
  await libro.aplicar(t1);
  assert.deepEqual(libro.titulares(), ['g', 'h']);
  assert.equal(libro.alta('h'), t1);
  assert.equal(libro.alta('nadie'), null);
});

test('libro: condiciones enchufables, en orden, sobre el libro de antes; con motivo, nada cambia', async () => {
  const libro = await conSaldo();
  const vistos = [];
  const tope50 = { nombre: 'TOPE', evaluar: (t, antes) => { vistos.push(antes.saldo('bea', 'E:ana/EUR')); return t.movimientos.some((p) => p.cantidad > 50) ? 'más de 50' : null; } };
  const autor = { nombre: 'AUTOR', evaluar: async (t) => (t.autor === 'ana' ? null : [{ texto: 'no es ana' }, 'tampoco']) };
  const r = await libro.aplicar(tx([transferir('E:ana/EUR', 'ana', 'bea', 60)], { autor: 'zoe' }), [tope50, autor]);
  assert.equal(r.ok, false);
  assert.deepEqual(r.motivos.map((m) => [m.condicion, m.texto]), [['TOPE', 'más de 50'], ['AUTOR', 'no es ana'], ['AUTOR', 'tampoco']]);
  assert.deepEqual(vistos, [0]); // leyó el libro de antes
  assert.equal(libro.saldo('bea', 'E:ana/EUR'), 0);
  // Una función sola también es una condición; pasa con null.
  assert.equal((await libro.aplicar(tx([transferir('E:ana/EUR', 'ana', 'bea', 40)]), [() => null, tope50, autor])).ok, true);
  assert.equal(libro.saldo('bea', 'E:ana/EUR'), 40);
  // Un motivo de paso deja fuera ese paso de la simulación y va en su sitio, entre los fallos de la aritmética.
  const pasos = await libro.probar(tx([quemar('E:ana/EUR', 'ana', 1000), transferir('E:ana/EUR', 'ana', 'bea', 1), quemar('E:ana/EUR', 'bea', 1000)]),
    [{ nombre: 'P1', evaluar: () => ({ paso: 1, texto: 'el paso 1 no' }) }, { nombre: 'TX', evaluar: () => 'la transacción no' }]);
  assert.deepEqual(pasos.motivos.map((m) => [m.paso ?? null, m.texto.slice(0, 18)]), [[null, 'la transacción no'], [0, 'saldo disponible i'], [1, 'el paso 1 no'], [2, 'saldo disponible i']]);
  // soloSiValida: se salta si ya hay algún motivo.
  const caro = { nombre: 'CARO', soloSiValida: true, evaluar: () => 'no debería verse' };
  assert.deepEqual((await libro.evaluar(tx([]), ['ya hay', caro].map((x) => (typeof x === 'string' ? () => x : x)))).map((m) => m.texto), ['ya hay']);
});

test('libro: asentar sin condiciones reconstruye; si la aritmética falla, lanza y nada cambia', async () => {
  const libro = new Libro();
  libro.asentar(tx([acunar('E:a/EUR', 'a', 3)]));
  assert.throws(() => libro.asentar(tx([quemar('E:a/EUR', 'a', 4)])), /transacción rechazada por el libro: paso 0/);
  assert.equal(libro.saldo('a', 'E:a/EUR'), 3);
  // Con la simulación de probar, si el libro no ha cambiado, no se vuelve a simular; si ha cambiado, sí.
  const { simulacion } = await libro.probar(tx([quemar('E:a/EUR', 'a', 3)]));
  libro.asentar(tx([acunar('E:a/EUR', 'a', 1)]));
  assert.throws(() => libro.asentar(tx([quemar('E:a/EUR', 'a', 5)]), simulacion), /paso 0/);
  libro.asentar(tx([quemar('E:a/EUR', 'a', 4)]), simulacion);
  assert.equal(libro.saldo('a', 'E:a/EUR'), 0);
  // Una primitiva sin forma no se simula.
  const r = await libro.aplicar(tx([{ primitiva: 'regalar', serie: 'E:a/EUR', cantidad: 1 }, acunar('', 'a', 1), acunar('S', 'a', -1)]));
  assert.deepEqual(r.motivos.map((m) => m.fallo.falta), ['forma', 'forma', 'forma']);
});

test('libro: las llaves no confunden partes con caracteres de control ni números con textos', async () => {
  const libro = new Libro();
  await libro.aplicar(tx([acunar('S', 'a\u0001b', 1, { clase: 'c', etiqueta: 1 }), acunar('S', 'a', 2, { clase: 'b\u0001c', etiqueta: '1' })]));
  assert.equal(libro.sumas({ primitiva: 'acunar', serie: 'S', titular: 'a\u0001b', clase: 'c', etiqueta: 1 }), 1);
  assert.equal(libro.sumas({ primitiva: 'acunar', serie: 'S', titular: 'a', clase: 'b\u0001c', etiqueta: '1' }), 2);
  assert.equal(libro.sumas({ primitiva: 'acunar', serie: 'S', titular: 'a', clase: 'b\u0001c', etiqueta: 1 }), 0);
});
