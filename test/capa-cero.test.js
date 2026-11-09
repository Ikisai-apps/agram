// La capa cero (VG, 9-11): el eje como envoltura del libro de transacciones, sin cambiar de comportamiento. Para los
// ejemplos de Ikisai, lo que el eje lee del libro (saldos, bloqueos, lo emitido y consumido de cada serie, el T gastado
// del día, el T sobre cada registro, las altas) es lo mismo que daba la aritmética de antes, que aquí se rehace a mano
// desde la lista de eventos, sin el libro (la copia de la que tenía src/validez.js antes de este cambio).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ejemploCompra, ejemploCuenta, ejemploComprasVecinas } from '../ejemplos/ikisai/compra-food.mjs';
import { ejemploComprasHermanas, escribirBasesDelEjemplo } from '../ejemplos/ikisai/compras-hermanas.mjs';
import { ejemploLente } from '../ejemplos/ikisai/lente-booking.mjs';
import { ejemploReserva } from '../ejemplos/ikisai/reserva-booking.mjs';
import { ejemploTarea } from '../ejemplos/ikisai/tarea-tasks.mjs';
import { claveToken, asignacionT, ESCALAS_REALES, ESCALAS_INFORMATIVAS } from '../src/tokens.js';
import { gastaAsignacion, esInformativoT, repartirGastoT } from '../src/ciclo.js';
import { esConsumoT } from '../src/evento.js';
import { serializar, restaurar } from '../src/persistencia.js';
import { CONDICIONES, catalogo } from '../src/condiciones/index.js';
import { Libro } from '../src/libro.js';
import { EPOCA_0_BTML } from '../src/epocas.js';

/** La aritmética de antes, evento a evento y sin libro: saldos, bloqueos, series, altas, T gastado y T sobre cada registro. */
function referencia(eje) {
  const saldos = new Map(); // identidad → Map(clave → cantidad), en orden de primer toque
  const bloq = new Map(); // JSON [id, clave, salida] → cantidad
  const series = new Map(); // clave → { emitido, consumido }
  const altas = new Map();
  const gastadoT = new Map();
  const tiempoSobre = new Map(); // id → Map(escala → T)
  const ver = (id, k) => saldos.get(id)?.get(k) ?? 0;
  const ajustar = (id, k, d) => { if (!saldos.has(id)) saldos.set(id, new Map()); saldos.get(id).set(k, ver(id, k) + d); };
  const plan = (id, ambito, cantidad) => {
    const r = [];
    let resta = cantidad;
    for (const a of eje.ambitosQueCubren(ambito)) {
      const k = 'P:' + a;
      const hay = ver(id, k);
      if (hay <= 0) continue;
      const usa = Math.min(hay, resta);
      r.push([k, -usa]);
      resta -= usa;
      if (resta <= 0) return r;
    }
    return null;
  };
  for (const id of eje.orden) {
    const ev = eje.obtener(id);
    // B1 (VG, 10-11): persona = quien escribió su propia alta; quien aún no tiene alta y escribe, escribe la suya.
    const personaAutor = altas.has(ev.autor) ? eje.obtener(altas.get(ev.autor)).autor === ev.autor : true;
    const conAsignacion = !eje.esDeV2(ev.id) && personaAutor;
    if (ev.contexto?.genesis === true) { altas.set(ev.autor, ev.id); if (!saldos.has(ev.autor)) saldos.set(ev.autor, new Map()); }
    // Su propia alta: la cuenta nace con lo que acuña de su asignación del día al gastarla.
    if (conAsignacion && !altas.has(ev.autor) && ev.movimientos.some((m) => gastaAsignacion(m, ev.autor, true))) { altas.set(ev.autor, ev.id); if (!saldos.has(ev.autor)) saldos.set(ev.autor, new Map()); }
    for (const m of ev.movimientos) {
      const k = claveToken(m);
      if (m.a !== null && !altas.has(m.a)) altas.set(m.a, ev.id);
      if (m.estado) {
        const d = m.estado === 'bloqueo' ? m.cantidad : -m.cantidad;
        ajustar(m.de, k, -d);
        const kb = JSON.stringify([m.de, k, m.salida]);
        bloq.set(kb, (bloq.get(kb) ?? 0) + d);
        continue;
      }
      const s = series.get(k) ?? { emitido: 0, consumido: 0 };
      series.set(k, s);
      if (m.de === null) s.emitido += m.cantidad;
      else if (m.token === 'P') for (const [kp, d] of plan(m.de, m.ambito, m.cantidad)) ajustar(m.de, kp, d);
      else if (esInformativoT(m)) { s.consumido += m.cantidad; continue; }
      else if (conAsignacion && gastaAsignacion(m, ev.autor, true)) {
        const a = asignacionT(ev.t, m.escala);
        const kg = JSON.stringify([ev.autor, m.escala, a.periodo]);
        const { asignacion, explicito } = repartirGastoT(a.cantidad - (gastadoT.get(kg) ?? 0), m.cantidad);
        gastadoT.set(kg, (gastadoT.get(kg) ?? 0) + asignacion);
        ajustar(m.de, k, -explicito);
      } else ajustar(m.de, k, -m.cantidad);
      if (m.de !== null && m.a === null && (m.token === 'E' || esConsumoT(m, ev.autor))) s.consumido += m.cantidad;
      if (m.token === 'T' && esConsumoT(m, ev.autor) && !ESCALAS_INFORMATIVAS.includes(m.escala)) {
        if (!tiempoSobre.has(ev.sobre)) tiempoSobre.set(ev.sobre, new Map());
        tiempoSobre.get(ev.sobre).set(m.escala, (tiempoSobre.get(ev.sobre).get(m.escala) ?? 0) + m.cantidad);
      }
      if (m.a !== null) ajustar(m.a, k, m.cantidad);
    }
  }
  return { saldos, bloq, series, altas, gastadoT, tiempoSobre };
}

async function ejemplos() {
  const c = await ejemploCompra();
  await ejemploCuenta(c.eje, c.compra);
  await ejemploComprasVecinas(c.eje, c);
  const h = await ejemploComprasHermanas();
  await escribirBasesDelEjemplo(h);
  return { compra: c.eje, hermanas: h.eje, lente: (await ejemploLente()).eje, reserva: (await ejemploReserva()).eje, tarea: (await ejemploTarea()).eje };
}

test('capa cero: para los ejemplos de Ikisai, el libro da los mismos saldos, bloqueos, series, altas y T que la aritmética de antes', async () => {
  for (const [nombre, eje] of Object.entries(await ejemplos())) {
    const ref = referencia(eje);
    assert.deepEqual(eje.identidades(), [...ref.saldos.keys()], nombre + ': identidades');
    for (const [id, porClave] of ref.saldos) {
      for (const [k, v] of porClave) assert.equal(eje.saldo(id, k), v, nombre + ': saldo ' + id + ' ' + k);
      assert.deepEqual(eje.libro.disponibles(id).map(([k]) => k), [...porClave.keys()], nombre + ': orden de las series de ' + id);
      assert.equal(eje.alta(id).id, ref.altas.get(id), nombre + ': alta de ' + id);
    }
    for (const [kb, v] of ref.bloq) {
      const [id, k, salida] = JSON.parse(kb);
      assert.equal(eje.bloqueado(id, k, salida), v, nombre + ': bloqueado ' + kb);
    }
    for (const s of eje.series()) {
      assert.equal(s.emitido, ref.series.get(s.clave).emitido, nombre + ': emitido ' + s.clave);
      if (s.token === 'E' || s.token === 'T') assert.equal(s.consumido, ref.series.get(s.clave).consumido, nombre + ': consumido ' + s.clave);
    }
    for (const [kg, v] of ref.gastadoT) {
      const [id, escala, periodo] = JSON.parse(kg);
      assert.equal(eje.gastadoT(id, escala, periodo), v, nombre + ': T gastado ' + kg);
    }
    for (const id of eje.orden) {
      const esperado = Object.fromEntries(ESCALAS_REALES.filter((e) => ref.tiempoSobre.get(id)?.get(e)).map((e) => [e, ref.tiempoSobre.get(id).get(e)]));
      assert.deepEqual(eje.tiempoSobre(id), esperado, nombre + ': T sobre ' + id.slice(0, 8));
    }
    // La cartera por series que da el libro casa con saldo y bloqueado.
    for (const id of eje.identidades()) {
      for (const [k, { disponible, bloqueado }] of Object.entries(eje.libro.vista(id))) {
        assert.equal(disponible, eje.saldo(id, k));
        for (const [salida, v] of Object.entries(bloqueado)) assert.equal(v, eje.bloqueado(id, k, salida));
      }
    }
  }
});

test('capa cero: cada evento es una transacción (acuñar, transferir, bloquear, liberar, quemar; anclaje y memo)', async () => {
  const vistas = new Set();
  for (const eje of Object.values(await ejemplos())) for (const id of eje.orden) {
    const ev = eje.obtener(id);
    const tx = eje.antes(eje.orden.indexOf(id)).transaccion(ev);
    assert.deepEqual(tx.ancla, { sobre: ev.sobre, en: ev.en });
    assert.equal(tx.memo, ev.payload);
    assert.deepEqual([tx.id, tx.autor, tx.t], [ev.id, ev.autor, ev.t]);
    assert.equal(tx.movimientos.length, ev.movimientos.length);
    ev.movimientos.forEach((m, i) => {
      const paso = tx.movimientos[i];
      const principal = paso[paso.length - 1];
      const esperada = m.de === null ? 'acunar' : m.estado === 'bloqueo' ? 'bloquear' : m.estado === 'liberacion' ? 'liberar' : m.a === null ? 'quemar' : 'transferir';
      assert.equal(principal.primitiva, esperada, JSON.stringify(m));
      assert.equal(principal.serie, claveToken(m));
      vistas.add(esperada);
    });
  }
  assert.deepEqual([...vistas].sort(), ['acunar', 'bloquear', 'liberar', 'quemar', 'transferir']);
});

test('capa cero: el libro se reconstruye aplicando las transacciones de los eventos (y al restaurar)', async () => {
  const { hermanas: eje } = await ejemplos();
  const libro = new Libro();
  eje.orden.forEach((id, k) => libro.asentar(eje.antes(k).transaccion(eje.obtener(id))));
  for (const id of eje.identidades()) assert.deepEqual(libro.vista(id), eje.libro.vista(id));
  const restaurado = await restaurar(JSON.parse(JSON.stringify(serializar(eje))));
  for (const id of eje.identidades()) assert.deepEqual(restaurado.libro.vista(id), eje.libro.vista(id));
  assert.deepEqual(restaurado.series(), eje.series());
});

test('capa cero: cada condición cita filas que están en el inventario, y van en el orden de siempre', () => {
  const inventario = readFileSync(new URL('../docs/notas/INVENTARIO_REGLAS.md', import.meta.url), 'utf8');
  const filas = new Set([...inventario.matchAll(/^\| ([A-Z]{2}-\d+) \|/gm)].map((m) => m[1]));
  assert.ok(filas.size >= 130);
  for (const c of catalogo()) for (const f of c.filas) assert.ok(filas.has(f), c.nombre + ' cita ' + f);
  assert.deepEqual(CONDICIONES.map((c) => c.nombre), [
    'EV-1', 'suelo:id', 'suelo:nuevo', 'suelo:un-genesis', 'suelo:referencias', 'ID-1', 'suelo:firma', 'suelo:claves', 'ID-3',
    // Encargo 3a, paso 9: las reglas de la época, conectadas, en el orden de su 8.
    ...EPOCA_0_BTML.condiciones.map((r) => r[0][0]),
    'VA-3', 'PP-2', 'PP-5', 'ES-1',
    'VA-3', 'EE-1', 'EE-8', 'EE-10', 'EE-5',
    'RR-3', 'RR-4', 'RR-5',
  ]);
});
