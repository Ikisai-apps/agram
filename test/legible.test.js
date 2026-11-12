// La carta en español y con valores legibles (etapa 1 del roadmap, parte mecánica): la traducción de las plantillas por
// datos (epoch.9.4, contrato.texto), los valores legibles por tipo (contrato.legible) y su inversa mínima para editar
// (contrato.desdeLegible). Nada hardcodeado en la carta: lo que decide algo viene de la época o del núcleo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/contrato.js';
import * as A from '../src/acciones.js';
import { arbol, formulario, preferencias, NIVEL, LATERALES } from '../carta/carta.js';
import { html } from '../carta/dom.js';
import { EPOCA_0_BTML } from '../src/epocas.js';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { ejemploReserva } from '../ejemplos/ikisai/reserva-booking.mjs';
import { pagaElCoste } from './ayudas-coste.js';

const T1 = '2026-11-08T10:00:00Z';
const minuto = (de) => pagaElCoste(de);
const huecos = (s) => [...String(s).matchAll(/\{([^{}]+)\}/g)].map((m) => m[1]).sort();
const fecha = (iso, idioma, conHora = true) => new Intl.DateTimeFormat(idioma, conHora ? { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' } : { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(iso));

const { eje, compra, menu } = await ejemploCompra();
const cuenta = await ejemploCuenta(eje, compra);
const es = { idioma: 'es' };

test('texto: la traducción por clave del registro del idioma (epoch.9.4); si falta, la del registro canónico (en), el original, o null', () => {
  assert.equal(C.texto(eje, 'template apply a resource', 'es'), 'aplicar un recurso');
  assert.equal(C.texto(eje, 'template apply a resource param quantity label', 'es'), 'cantidad');
  assert.equal(C.texto(eje, 'template apply a resource param quantity help', 'es'), 'cuántas unidades');
  assert.equal(C.texto(eje, 'level seed', 'es'), 'semilla');
  assert.equal(C.texto(eje, 'order newest', 'es'), 'lo último primero');
  assert.equal(C.texto(eje, 'size card', 'es'), 'tarjeta');
  // Sin el idioma, el inglés que se pasa como original; los formatos de legible tienen su canónico en el registro «en».
  assert.equal(C.texto(eje, 'template apply a resource', 'fr', { original: 'apply a resource' }), 'apply a resource');
  assert.equal(C.texto(eje, 'template apply a resource', 'en', { original: 'apply a resource' }), 'apply a resource');
  assert.equal(C.texto(eje, 'legible price', 'fr'), '{amount} {series} per unit', 'el canónico del registro en');
  assert.equal(C.texto(eje, 'legible price', 'es'), '{amount} {series} por unidad');
  assert.equal(C.texto(eje, 'no existe', 'es'), null);
  assert.equal(C.texto(eje, 'no existe', 'es', { original: 'x' }), 'x');
  assert.deepEqual(C.idiomas(), ['en', 'es'], 'el registro en de los formatos no repite el idioma canónico');
  assert.equal(C.claves.parametro('purchase', 'order', 'label'), 'template purchase param order label');
});

test('las 44 plantillas de transacción tienen en es su nombre, la etiqueta y la ayuda de cada parámetro y su mensaje (con los mismos huecos); también las de datos, los niveles, los órdenes y los tamaños', () => {
  const plantillas = A.plantillasDeTransaccion();
  assert.equal(plantillas.length, 44);
  const tiene = (clave, original) => {
    const t = C.texto(null, clave, 'es');
    assert.ok(t !== null && t !== '', 'falta en es: «' + clave + '»');
    if (original !== undefined) assert.notEqual(t, original, 'sin traducir: «' + clave + '»');
    return t;
  };
  for (const { nombre, plantilla } of plantillas) {
    tiene(C.claves.plantilla(nombre), nombre);
    for (const p of A.parametros(plantilla)) {
      tiene(C.claves.parametro(nombre, p.nombre, 'label')); // una etiqueta puede coincidir («token»): basta con que esté
      tiene(C.claves.parametro(nombre, p.nombre, 'help'), p.ayuda);
      assert.ok(!tiene(C.claves.parametro(nombre, p.nombre, 'help')).startsWith('[['), nombre + ' · ' + p.nombre + ': la ayuda no empieza por [[');
    }
    const original = plantilla[9][plantilla[9].length - 1];
    const mensaje = tiene(C.claves.mensaje(nombre), original);
    assert.ok(mensaje.startsWith(nombre + ': '), nombre + ': el mensaje traducido empieza por el nombre canónico');
    assert.deepEqual(huecos(mensaje), huecos(original), nombre + ': los mismos huecos');
  }
  // Las plantillas de datos (purchase, booking, preferences): cada posición descrita, con su etiqueta y su ayuda.
  for (const { nombre, registro } of C.plantillas(eje)) {
    tiene(C.claves.plantilla(nombre), nombre);
    for (const d of registro) {
      if (!Array.isArray(d) || !Array.isArray(d[0])) continue;
      tiene(C.claves.parametro(nombre, d[0][0], 'label'));
      tiene(C.claves.parametro(nombre, d[0][0], 'help'));
    }
  }
  for (const n of C.niveles()) tiene(C.claves.nivel(n), n);
  for (const n of EPOCA_0_BTML.registro[9][2][2][8][8]) tiene(C.claves.nivel(n), n); // los cinco de «booking»
  for (const o of C.ordenes()) tiene(C.claves.orden(o.nombre), o.nombre);
  for (const t of C.tamanos()) tiene(C.claves.tamano(t.nombre), t.nombre);
  assert.deepEqual(C.niveles(es).slice(0, 2), ['semilla', 'brote']);
});

test('legible: precio, serie, instante, identidad, referencia, décupla, lista, cantidad de token, nombre de acción y de nivel, en el idioma', () => {
  const L = (v, t, o = es) => C.legible(eje, v, t, o);
  // Un precio [[en qué], [cuánto]]: «1 E por unidad»; con una serie, su denominación.
  assert.equal(L([['E'], [1]], 'tenfold').texto, '1 E por unidad');
  assert.equal(L([['E'], [1]], 'tenfold', { idioma: 'en' }).texto, '1 E per unit');
  assert.equal(L([['E'], [1]], 'tenfold', { idioma: 'fr' }).texto, '1 E per unit', 'sin el idioma, el canónico');
  const precio = L([['E:casa/EUR'], [12]], 'tenfold');
  assert.equal(precio.texto, '12 EUR por unidad');
  assert.deepEqual([precio.partes.precio.cuanto, precio.partes.precio.serie.denominacion, precio.partes.precio.serie.registroTexto], [12, 'EUR', 'Casa de ejemplo']);
  // Una lista de precios.
  assert.equal(L([[['E:casa/EUR'], [12]], [['T'], [1]]]).texto, '12 EUR por unidad · 1 T por unidad');
  // Una serie: E por su denominación con su registro; T por su escala (el nombre de epoch.1.3); P por su registro; R por su emisor.
  const serie = L('E:casa/EUR');
  assert.equal(serie.texto, 'EUR');
  assert.equal(serie.partes.registro, eje.genesisId);
  assert.equal(serie.partes.registroTexto, 'Casa de ejemplo');
  assert.equal(L('T:hora').texto, 'hora');
  assert.equal(L('T:dia').texto, EPOCA_0_BTML.registro[1][3][1][3][0][0]);
  assert.equal(L('P:' + menu.id + '/casa').texto, 'P sobre Menú del día');
  assert.equal(L('P:' + menu.id + '.1/casa').texto, 'P sobre Menú del día, mirada 1');
  assert.equal(L('P:' + menu.id + '/casa', null, { idioma: 'en' }).texto, 'P on Menú del día');
  assert.equal(L('R:casa').texto, 'R de casa');
  // Un instante: fecha y hora legibles en el idioma (en UTC); un día, solo la fecha.
  assert.equal(L('2026-11-07T13:30:00Z').texto, fecha('2026-11-07T13:30:00Z', 'es'));
  assert.equal(L('2026-11-07T13:30:00Z', 'instant', { idioma: 'en' }).texto, fecha('2026-11-07T13:30:00Z', 'en'));
  assert.notEqual(L('2026-11-07T13:30:00Z').texto, '2026-11-07T13:30:00Z');
  assert.equal(L('2026-11-20', 'instant').texto, fecha('2026-11-20T00:00:00Z', 'es', false));
  assert.equal(L('2026-11-07T13:30:00Z').partes.instante, '2026-11-07T13:30:00Z');
  // Una identidad: su nombre es el 0 de su alta.
  assert.equal(L('huesped', 'identity').texto, 'Alta de huesped');
  assert.equal(L('casa').texto, 'Casa de ejemplo');
  assert.equal(L('nadie', 'identity').texto, 'nadie', 'sin alta, el nombre');
  // Una referencia (o el id): el 0 del registro; con dirección, la etiqueta de la posición.
  assert.equal(L({ ref: menu.id }).texto, 'Menú del día');
  assert.equal(L(menu.id, 'ref').texto, 'Menú del día');
  assert.equal(L({ ref: menu.id, dir: '1000000000' }).texto, 'Menú del día · ' + C.etiqueta(eje, menu.id, 1, es));
  assert.equal(L({ ref: cuenta.id }).partes.X, cuenta.id);
  // Una décupla: su 0; sin él, «registro de N posiciones»; sus posiciones, en las partes.
  const pedido = L(compra.payload[1], 'tenfold');
  assert.equal(pedido.texto, 'Menú del día · ' + C.etiqueta(eje, menu.id, 1, es));
  assert.deepEqual(pedido.partes.posiciones.map((p) => p.texto), ['Menú del día · ' + C.etiqueta(eje, menu.id, 1, es), '1', 'EUR 12']);
  assert.equal(L([undefined, [1], ['x']], 'tenfold').texto, 'registro de 2 posiciones');
  assert.equal(L([undefined, [1], ['x']], 'tenfold', { idioma: 'en' }).texto, 'record of 2 positions');
  // Una lista: sus ocupantes, legibles.
  assert.equal(L(['huesped', 'cocina'], 'identity').texto, 'Alta de huesped · Altas del fin de semana');
  assert.equal(L(['pagar', 'servir']).texto, 'pagar · servir');
  // Una cantidad de token (un asiento): cuánto y la serie.
  assert.equal(L({ primitiva: 'transferir', serie: 'E:casa/EUR', cantidad: 12 }).texto, '12 EUR');
  assert.equal(L({ serie: 'T:hora', cantidad: 1 }).texto, '1 hora');
  // Un nombre de acción, de plantilla de datos o de nivel: su traducción; un número, él; nada, vacío.
  assert.equal(L('apply a resource').texto, 'aplicar un recurso');
  assert.equal(L('apply a resource').partes.id, A.plantillasDeTransaccion().find((p) => p.nombre === 'apply a resource').id);
  assert.equal(L('purchase').texto, 'compra');
  assert.equal(L('seed', 'level').texto, 'semilla');
  assert.equal(L(12, 'number').texto, '12');
  assert.deepEqual(L(null), { texto: '', partes: { vacio: true } });
  assert.equal(L('hola').texto, 'hola');
});

test('desdeLegible: la inversa mínima para los tipos simples, con motivos en el idioma; esTipoSimple lee los tipos genéricos de la época', () => {
  const D = (s, t) => C.desdeLegible(s, t, { eje, idioma: 'es' });
  assert.deepEqual(D('12,5', 'number'), { valor: 12.5 });
  assert.deepEqual(D('3', 'number'), { valor: 3 });
  assert.deepEqual(D('x', 'number'), { motivo: 'no es un número: x' });
  assert.deepEqual(C.desdeLegible('x', 'number', { eje, idioma: 'en' }), { motivo: 'not a number: x' });
  assert.deepEqual(D('2026-11-20', 'instant'), { valor: '2026-11-20T00:00:00Z' });
  assert.deepEqual(D('2026-11-20T10:30', 'instant'), { valor: '2026-11-20T10:30:00Z' });
  assert.deepEqual(D('2026-11-20T10:30:00+01:00', 'instant'), { valor: '2026-11-20T10:30:00+01:00' });
  assert.match(D('ayer', 'instant').motivo, /^no es una fecha/);
  assert.deepEqual(D('huesped', 'identity'), { valor: 'huesped' });
  assert.deepEqual(D('Alta de huesped', 'identity'), { valor: 'huesped' }, 'por el 0 de su alta');
  assert.deepEqual(D('nadie', 'identity'), { motivo: 'ninguna identidad conocida se llama nadie' });
  assert.deepEqual(D(menu.id, 'ref'), { valor: menu.id });
  assert.deepEqual(D('Menú del día', 'ref'), { valor: menu.id }, 'por el 0 del registro');
  assert.match(D('no está', 'ref').motivo, /^ningún registro/);
  assert.deepEqual(D('aplicar un recurso', 'text'), { valor: 'apply a resource' }, 'el nombre traducido de una acción vuelve al canónico');
  assert.deepEqual(D('compra', 'text'), { valor: 'purchase' });
  assert.deepEqual(D('semilla', 'level'), { valor: 'seed' });
  assert.deepEqual(D('hola', 'text'), { valor: 'hola' });
  assert.deepEqual(D('', 'number'), { valor: undefined });
  assert.deepEqual(['text', 'number', 'identity', 'ref', 'instant', 'level', 'tenfold', ['tenfold']].map((t) => C.esTipoSimple(t)), [true, true, true, true, true, true, false, false]);
});

test('etiqueta, ayuda, marcador, madurez, validar y los parámetros del aro hablan el idioma que se les pide; sin idioma, el inglés de siempre', async () => {
  assert.equal(C.etiqueta(eje, compra.id, 1, es), 'pedido');
  assert.equal(C.etiqueta(eje, compra.id, 1), 'order');
  assert.equal(C.etiqueta(eje, compra.id, 7, es), C.etiqueta(eje, compra.id, 7), 'la regla corta de la época, tal cual');
  assert.match(C.ayuda(eje, compra.id, 1, es), /^qué se compra/);
  assert.deepEqual(C.marcador(eje, compra.id, 1, es), ['menú · 1 · EUR 12']);
  assert.deepEqual(C.marcador(eje, compra.id, 1), ['[[menu], [1], ["EUR 12"]]']);
  assert.deepEqual([C.madurez(eje, compra.id, es).nombre, C.madurez(eje, compra.id, es).clave], ['lista', 'list']);
  // Una compra que no valida: el motivo con la etiqueta y la ayuda en el idioma.
  const mala = await eje.escribir({ autor: 'huesped', sobre: menu.id, t: T1, movimientos: [minuto('huesped')], payload: ['Compra vacía', [[{ ref: menu.id, dir: '1000000000' }], [0], ['EUR 12']], ['nada'], ['huesped'], ['pagar'], ['purchase']] });
  const motivos = C.validar(eje, mala.id, es).map((m) => m.motivo);
  assert.ok(motivos.some((m) => m.startsWith('pedido: qué se compra')), JSON.stringify(motivos));
  assert.ok(C.validar(eje, mala.id).some((m) => m.motivo.startsWith('order: what is bought')));
  // Los parámetros del aro y las acciones: etiqueta y ayuda traducidas, el nombre canónico y el id aparte.
  const p = A.parametros(A.plantillaDeTransaccion('apply a resource'), es).find((x) => x.nombre === 'quantity');
  assert.deepEqual([p.etiqueta, p.ayuda], ['cantidad', 'cuántas unidades']);
  const [aplica] = A.acciones(eje, menu.id, 1, 'huesped', es);
  assert.deepEqual([aplica.nombre, aplica.etiqueta, typeof aplica.id], ['apply a resource', 'aplicar un recurso', 'string']);
  assert.equal(aplica.parametros.find((x) => x.nombre === 'price').etiqueta, 'precio');
  // Un parámetro que falla, en el idioma de la configuración de quien lanza.
  const r = await A.transaccion(eje, 'apply a resource', { X: menu.id, quantity: 0, price: [['E:casa/EUR'], [12]] }, 'huesped', { t: T1, idioma: 'es' });
  assert.deepEqual(r.motivos.map((m) => m.mensaje), ['cantidad: cuántas unidades']);
  // El mensaje de una lectura y de un paso del camino, en el idioma; el 0 del registro escrito sigue en inglés (dato canónico).
  const lectura = await A.transaccion(eje, 'view thread', { X: menu.id }, 'huesped', { t: T1, idioma: 'es' });
  assert.equal(lectura.lectura.mensaje, 'view thread: el hilo de Menú del día hasta el génesis');
  const bien = await A.transaccion(eje, 'apply a resource', { X: menu.id, quantity: 1, price: [['E:casa/EUR'], [12]] }, 'huesped', { t: T1, idioma: 'es' });
  assert.ok(bien.ok, JSON.stringify(bien.motivos));
  assert.match(bien.evento.payload[0], /^apply a resource: huesped gives 12 E:casa\/EUR to /);
});

test('el árbol de la carta para la compra en es no lleva ninguna cadena que empiece por [[ ni ningún nombre de acción en inglés; el formulario enseña valores legibles y lanza por id', async () => {
  const { eje: b, compra: X, menu: m } = await ejemploCompra();
  await ejemploCuenta(b, X);
  const pref = preferencias(b, 'huesped', { language: 'es' });
  await b.escribir({ autor: 'huesped', sobre: pref.sobre, en: pref.en, t: T1, movimientos: [minuto('huesped')], payload: pref.payload });
  assert.equal(C.configuracion(b, 'huesped').language, 'es');
  const a = await arbol({ foco: { X: X.id, pv: 0 }, niveles: Object.fromEntries(LATERALES.map((pv) => [pv, NIVEL.bloque])), aro: { X: X.id, pv: 1 }, formulario: { X: m.id, accion: 'apply a resource', valores: {} } }, b, 'huesped', { ancho: 400, alto: 700 });
  assert.equal(a.idioma, 'es');
  // Todas las cadenas del árbol, salvo los valores en crudo (`valor`: el BTML que el formulario enseña en «ver en BTML»).
  const cadenas = [];
  (function anda(v) {
    if (typeof v === 'string') cadenas.push(v);
    else if (Array.isArray(v)) v.forEach(anda);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== 'valor') anda(x);
  })(a);
  const nombresEn = A.plantillasDeTransaccion().map((p) => p.nombre);
  assert.deepEqual(cadenas.filter((s) => s.startsWith('[[')), []);
  assert.deepEqual(cadenas.filter((s) => nombresEn.includes(s)), []);
  // Lo que se enseña: etiquetas, nombres de acciones, madurez, plantilla y valores en español y legibles.
  assert.equal(a.centro.campos.find((c) => c.pv === 1).etiqueta, 'pedido');
  assert.equal(a.centro.campos.find((c) => c.pv === 1).valor, 'Menú del día · ' + C.etiqueta(b, m.id, 1, es));
  assert.deepEqual(a.centro.campos.find((c) => c.pv === 1).marcador, ['menú · 1 · EUR 12']);
  assert.deepEqual([a.centro.madurez.nombre, a.centro.plantilla], ['lista', 'compra']);
  const hueco = a.aro.huecos.find((h) => h.pv === 1);
  assert.equal(hueco.accion.nombre, 'emitir E atada a X');
  assert.equal(hueco.accion.id, A.plantillasDeTransaccion().find((p) => p.nombre === 'issue E tied to X').id);
  assert.deepEqual(hueco.accion.faltan, ['denominación']);
  assert.ok(hueco.otras.some((o) => o.nombre === 'bloquear E como puja por una cuota'));
  const seis = a.laterales.find((n) => n.pv === 6);
  const laCompra = seis.diario.entradas.find((e) => e.id === X.id); // el diario del 6, lo más reciente arriba (#18): la compra, por su id
  assert.ok(laCompra.movimientos.some((x) => x === 'transferir 12 EUR'), JSON.stringify(laCompra.movimientos));
  // El formulario: el nombre traducido, la acción por id, cada campo con su etiqueta, su legible y si es simple.
  const f = a.formulario;
  assert.equal(f.nombre, 'aplicar un recurso');
  assert.equal(f.accion, A.plantillasDeTransaccion().find((p) => p.nombre === 'apply a resource').id);
  const campo = (n) => f.campos.find((c) => c.nombre === n);
  assert.deepEqual([campo('what').etiqueta, campo('what').legible, campo('what').simple], ['qué', 'Menú del día', true]);
  assert.deepEqual([campo('price').etiqueta, campo('price').simple], ['precio', false]);
  assert.deepEqual([campo('who').legible, campo('actions').legible, campo('type').legible], ['Alta de huesped · Altas del fin de semana', 'aplicar un recurso', 'compra']);
  assert.equal(campo('quantity').ayuda, 'cuántas unidades');
  // El HTML: sin nombres de acciones en inglés ni [[, el crudo en «ver en BTML» y los textos de la interfaz en español.
  const h = html(a);
  assert.doesNotMatch(h, /\[\[/);
  for (const n of nombresEn) assert.ok(!h.includes('>' + n + '<'), 'el HTML enseña «' + n + '»');
  assert.match(h, /<details class="btml"><summary>ver en BTML<\/summary><code>\{&quot;ref&quot;:/);
  assert.match(h, /data-lanzar="[0-9a-f]{64}"/);
  assert.match(h, /data-legible="Menú del día"/);
  assert.match(h, /guardar este rato|configuración/);
  // En inglés (pedido), lo mismo de siempre: los nombres canónicos; sin preferencia, el idioma de la época es el español.
  const en = await arbol({ foco: { X: X.id, pv: 0 }, aro: { X: X.id, pv: null } }, eje, 'cocina', { ancho: 400, alto: 700 }, { idioma: 'en' });
  assert.equal(en.idioma, 'en');
  assert.equal(en.centro.campos.find((c) => c.pv === 1).etiqueta, 'order');
  // La reserva, en es: las fechas del 7 legibles y los niveles de «booking» traducidos.
  const { eje: r, reserva } = await ejemploReserva();
  const prefR = preferencias(r, 'huesped', { language: 'es' });
  await r.escribir({ autor: 'huesped', sobre: prefR.sobre, en: prefR.en, t: T1, movimientos: [minuto('huesped')], payload: prefR.payload });
  const ar = await arbol({ foco: { X: reserva.id, pv: 0 }, niveles: { 7: NIVEL.bloque } }, r, 'huesped', { ancho: 400, alto: 700 });
  assert.equal(ar.centro.madurez.nombre, 'liquidada');
  assert.equal(ar.laterales.find((n) => n.pv === 7).ocupantes.lista[0].texto, fecha('2026-11-20T00:00:00Z', 'es', false));
  assert.equal(formulario(r, reserva.id, 'commit time', 'huesped', { until: '2026-11-21T12:00:00Z' }).campos.find((c) => c.nombre === 'until').legible, fecha('2026-11-21T12:00:00Z', 'es'));
});
