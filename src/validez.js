// Validez: las cinco capas (V2, conservadas en V3 y V4; MAPA §2.8 [A]) como
// estados independientes de un registro. Sin efectos: no escribe en el eje ni
// toca el evento. Cada capa dice ok, pendiente o falla, con sus motivos; no
// hay veredicto global ni puntuación («no colapsarlos en una puntuación
// global inventada», contrato v0.2). Una firma no es veracidad: que la capa 3
// esté en ok no sube ninguna otra, y que falle no baja ninguna otra.
//
//   1 forma y época               validarForma, y el payload y `en` leídos bajo la época elegida
//   2 interpretación              cada fórmula del payload evaluada con BQL
//   3 criptografía y procedencia  id, firma, foco, autor, claves declaradas y referencias que resuelven
//   4 acreditación material       respaldo en el libro: series emitidas por su emisor, ningún saldo negativo
//   5 permiso y ejecución         quién mueve y quién emite; en la fábrica, el estado del motor y quién pudo autorizar
//
// PV5 inspecciona estas señales; no las garantiza. Lo que ninguna capa
// comprueba (que lo afirmado ocurrió en el mundo, que los efectos externos se
// confirmaron) es de AARPIA y de lo que venga fuera de AGRAM: docs/VALIDEZ.md.
//
// Las capas se leen en el lugar del registro: si el evento está en el eje, el
// libro (saldos, series, claves, tipos) es el de justo antes de él; si no
// está (un borrador, uno recibido, uno manipulado), el de ahora.

import { ARIDAD, esReferencia, esDireccion, direccion } from './btml.js';
import { RAIZ, validarForma, verificarId } from './evento.js';
import { verificar } from './autoridad.js';
import { claveToken, validarMovimiento, AMBITO_GENESIS, TIPOS, EMITEN } from './tokens.js';
import { EPOCA_0, leerDireccion } from './epocas.js';
import { evaluar, esFormula } from './bql.js';
import { seguir } from './encaje.js';
import { estadoDe, puedeAutorizar, autorizacionesValidas, FABRICA } from './motor.js';

/** Los tres estados de una capa. Nada más: ni «válido», ni una nota. */
export const ESTADOS_CAPA = Object.freeze(['ok', 'pendiente', 'falla']);

/** Las cinco capas, en el orden del corpus (V4 06: «1. Forma/época/estructura … 5. Permiso/transición autorizada/ejecución comprobada»). */
export const CAPAS = Object.freeze([
  Object.freeze({ capa: 1, clave: 'forma', nombre: 'forma y época' }),
  Object.freeze({ capa: 2, clave: 'interpretacion', nombre: 'interpretación' }),
  Object.freeze({ capa: 3, clave: 'criptografia', nombre: 'criptografía y procedencia' }),
  Object.freeze({ capa: 4, clave: 'acreditacion', nombre: 'acreditación material' }),
  Object.freeze({ capa: 5, clave: 'permiso', nombre: 'permiso y ejecución' }),
]);

/** Estado del motor → estado de la capa 5. Autorizado aún no es ejecutado: consolidar no es ejecutar. */
export const ESTADO_MOTOR = Object.freeze({
  'PENDIENTE DE AUTORIZACIÓN': 'pendiente',
  AUTORIZADO: 'pendiente',
  EJECUTADO: 'ok',
});

/**
 * Estado BQL → estado de la capa 2. RESUELTO es ok; todo lo que empieza por
 * PENDIENTE (también PENDIENTE POR LÍMITE o DE AUTORIZACIÓN) es pendiente:
 * «lo que falta no es falso»; INCOMPATIBLE, ERROR y cualquier otro, falla.
 */
export function estadoDeBql(estado) {
  if (estado === 'RESUELTO') return 'ok';
  if (typeof estado === 'string' && estado.startsWith('PENDIENTE')) return 'pendiente';
  return 'falla';
}

/** Lo que ninguna capa de AGRAM puede subir: queda dicho en la 4 y en la 5. */
export const SIN_ACREDITAR = 'sin acreditar: que ocurrió en el mundo no lo prueba el eje (fuera de AGRAM)';
export const SIN_CONFIRMAR = 'sin confirmar: los efectos fuera del eje son de AARPIA';

const SIN_ID = '(sin id)';
const corto = (x) => String(x).slice(0, 8);
const peor = (estados) => (estados.includes('falla') ? 'falla' : estados.includes('pendiente') ? 'pendiente' : 'ok');
const esEoR = (m) => m.token === 'E' || m.token === 'R';
const lista = (x) => (Array.isArray(x) ? x : []);
const camino = (c) => (c.length ? c.join('.') : 'raíz');

/** Un parte de capa: estado, motivos (por qué no está en ok) y resumen, más su detalle. */
function parte(n, estado, motivos, resumen, detalle = {}) {
  return { ...CAPAS[n - 1], estado, motivos, resumen, ...detalle };
}

/** Recoge motivos con su gravedad y da el peor. */
function motivos() {
  const items = [];
  return {
    falla: (m) => items.push({ estado: 'falla', m }),
    pendiente: (m) => items.push({ estado: 'pendiente', m }),
    get estado() { return peor(items.map((x) => x.estado)); },
    get textos() { return items.map((x) => x.m); },
  };
}

/**
 * Recorre el payload: cada nodo con su camino de índices (la raíz es []).
 * Baja una profundidad más de diez, para ver lo que se pasa, y no recorre
 * más de diez posiciones por array (lo demás ya es un fallo de forma).
 */
function recorrer(payload, visitar, c = []) {
  visitar(payload, c);
  if (!Array.isArray(payload) || c.length > ARIDAD) return;
  for (let i = 0; i < Math.min(payload.length, ARIDAD); i++) recorrer(payload[i], visitar, [...c, i]);
}

// ---------- el libro: saldos, series, claves y tipos hasta un punto del eje ----------

const llave = (id, k) => JSON.stringify([id, k]);

/** Rehace el libro con los eventos del eje anteriores al índice `hasta`. Lee el eje; no lo toca. */
function libroAntes(eje, hasta) {
  const libro = { saldos: new Map(), series: new Map(), claves: new Map(), tipos: new Map(), identidades: new Set(), ids: new Set() };
  for (let k = 0; k < hasta; k++) aplicar(eje, libro, eje.obtener(eje.orden[k]));
  return libro;
}

const saldoEn = (libro, id, k) => libro.saldos.get(llave(id, k)) ?? 0;

/** Plan de débito de P como el del eje: del ámbito más concreto al más amplio; null si no alcanza. */
function planP(eje, ver, identidad, ambito, cantidad) {
  const plan = [];
  let resta = cantidad;
  for (const a of eje.ambitosQueCubren(ambito)) {
    const k = 'P:' + a;
    const hay = ver(identidad, k);
    if (hay <= 0) continue;
    const usa = Math.min(hay, resta);
    plan.push([k, -usa]);
    resta -= usa;
    if (resta <= 0) return plan;
  }
  return null;
}

function aplicar(eje, libro, ev) {
  libro.ids.add(ev.id);
  for (const [id, jwk] of Object.entries(ev.contexto?.claves ?? {})) libro.claves.set(id, jwk);
  for (const [id, tipo] of Object.entries(ev.contexto?.tipos ?? {})) libro.tipos.set(id, tipo);
  const ver = (id, k) => saldoEn(libro, id, k);
  const ajustar = (id, k, d) => { libro.identidades.add(id); libro.saldos.set(llave(id, k), ver(id, k) + d); };
  for (const m of ev.movimientos) {
    const k = claveToken(m);
    if (m.de === null) {
      const s = libro.series.get(k) ?? { emisor: esEoR(m) ? m.emisor : ev.autor, emitido: 0 };
      libro.series.set(k, { emisor: s.emisor, emitido: s.emitido + m.cantidad });
    } else if (m.token === 'P') {
      for (const [kp, d] of planP(eje, ver, m.de, m.ambito, m.cantidad) ?? [[k, -m.cantidad]]) ajustar(m.de, kp, d);
    } else {
      ajustar(m.de, k, -m.cantidad);
    }
    if (m.a !== null) ajustar(m.a, k, m.cantidad);
  }
}

/** El eje visto con este evento dentro: lo que leen BQL y el encaje. Sin tocar el eje. */
function vistaCon(eje, ev, id) {
  if (eje.obtener(id) === ev) return eje;
  const orden = eje.orden.includes(id) ? eje.orden : [...eje.orden, id];
  return { obtener: (x) => (x === id ? ev : eje.obtener(x)), orden, sobre: (x, en) => eje.sobre(x, en) };
}

// ---------- 1 · forma y época ----------

function capaForma(ev, epoca) {
  const r = motivos();
  const errores = validarForma(ev);
  errores.forEach((e) => r.falla(e));
  let profundidad = 0;
  const hondos = [];
  const sinRegla = new Set();
  const leer = (p, d) => {
    if (p < ARIDAD && epoca.reglaCorta(p, d) === undefined) sinRegla.add(p + '.' + d);
  };
  recorrer(ev.payload, (nodo, c) => {
    profundidad = Math.max(profundidad, c.length);
    if (c.length > ARIDAD) hondos.push(c);
    c.forEach((d, p) => leer(p, d));
  });
  // BTML: hasta diez profundidades por foco; al agotarlas se cambia de foco, no se concatena un undécimo dígito (MAPA §2.1 [A]).
  if (hondos.length) r.falla('más de diez profundidades en ' + camino(hondos[0].slice(0, ARIDAD + 1)) + ': sin dirección posible; se cambia de foco');
  const en = esDireccion(ev.en) ? leerDireccion(ev.en, epoca) : [];
  en.forEach(({ profundidad: p, digito: d }) => leer(p, d));
  // La época está fuera del dato (MAPA §9 [D]): lo que no se lee bajo esta época no es un error del registro.
  for (const pd of sinRegla) r.pendiente('sin regla corta en ' + (epoca.nombre ?? 'la época') + ' para ' + pd + ': no legible bajo esta época');
  const nombre = epoca.nombre ?? 'la época elegida';
  const resumen = r.estado === 'ok'
    ? 'forma válida · legible bajo ' + nombre + ' (profundidad ' + profundidad + ')'
    : r.estado === 'pendiente' ? 'forma válida · no legible entera bajo ' + nombre : 'forma rota: ' + r.textos[0];
  return parte(1, r.estado, r.textos, resumen, { errores, epoca: nombre, profundidad, lectura: { en } });
}

// ---------- 2 · interpretación ----------

function capaInterpretacion(vista, ev, id) {
  const formulas = [];
  recorrer(ev.payload, (nodo, c) => {
    if (c.length > ARIDAD || !esFormula(nodo)) return;
    let r;
    try {
      r = evaluar(vista, id, c);
    } catch (e) {
      r = { estado: 'ERROR', texto: 'ERROR: ' + e.message };
    }
    formulas.push({ camino: c, dir: direccion(c), formula: nodo, estado: r.estado, texto: r.texto, capa: estadoDeBql(r.estado) });
  });
  const estado = peor(formulas.map((f) => f.capa));
  const textos = formulas.filter((f) => f.capa !== 'ok').map((f) => camino(f.camino) + ': ' + f.texto);
  const cuenta = (e) => formulas.filter((f) => f.capa === e).length;
  const resumen = formulas.length === 0
    ? 'sin fórmulas: literales y referencias'
    : (formulas.length === 1 ? '1 fórmula' : formulas.length + ' fórmulas') + ' · resueltas: ' + cuenta('ok') + ' · pendientes: ' + cuenta('pendiente') + ' · con error: ' + cuenta('falla');
  return parte(2, estado, textos, resumen, { formulas });
}

// ---------- 3 · criptografía y procedencia ----------

async function capaCriptografia(eje, vista, ev, id, libro, enEje) {
  const r = motivos();
  const esGenesis = ev.contexto?.genesis === true;

  // El id es el hash del cuerpo canónico: si no corresponde, el registro no es el que dice ser.
  let idCorrecto = false;
  if (id === SIN_ID) r.falla('sin id');
  else {
    try { idCorrecto = await verificarId(ev); } catch { idCorrecto = false; }
    if (!idCorrecto) r.falla('el id no corresponde al cuerpo: el registro no es el que dice ser');
  }

  // Firma: verificada si el autor tiene clave; sin clave, sin firma (salvo que el eje exija firmas).
  const clave = esGenesis ? ev.contexto?.claves?.[ev.autor] : libro.claves.get(ev.autor);
  let firma;
  if (clave) {
    if (!ev.firma) { firma = 'ausente'; r.falla('firma ausente de ' + ev.autor + ': tiene clave'); }
    else if (ev.firmante !== ev.autor) { firma = 'de otro'; r.falla('firmado por ' + ev.firmante + ', no por el autor ' + ev.autor); }
    else if (!(await verificar(ev, clave))) { firma = 'inválida'; r.falla('firma inválida de ' + ev.autor); }
    else firma = 'verificada';
  } else if (ev.firma) {
    firma = 'sin verificar';
    r.pendiente('firmado, pero ' + ev.autor + ' no tiene clave registrada contra la que verificar');
  } else if (eje.exigirFirmas) {
    firma = 'ausente';
    r.falla('el eje exige firmas y ' + ev.autor + ' no tiene clave');
  } else {
    firma = 'sin firma';
  }

  // Procedencia del registro: su foco (el hilo hasta el génesis) y su autor.
  if (esGenesis) {
    if (ev.sobre !== null) r.falla('el génesis no tiene foco');
    if (eje.genesisId && eje.genesisId !== id) r.falla('ya hay génesis: solo el primero carece de foco');
  } else if (ev.sobre === null || ev.sobre === undefined) {
    r.falla('solo el génesis carece de foco');
  } else if (!libro.ids.has(ev.sobre)) {
    // Referencia o contexto ausente → PENDIENTE (corpus V4 02): puede llegar.
    r.pendiente('foco ausente del eje: ' + corto(ev.sobre));
  }
  if (!esGenesis && !libro.identidades.has(ev.autor)) r.pendiente('autor sin alta en el eje (no ha recibido tokens): ' + ev.autor);

  // Claves declaradas en un alta: solo de identidades nuevas que reciben tokens en ese evento.
  const clavesDeclaradas = [];
  if (!esGenesis) {
    for (const [nueva, jwk] of Object.entries(ev.contexto?.claves ?? {})) {
      clavesDeclaradas.push({ identidad: nueva, por: ev.autor, posesion: 'sin probar' });
      if (libro.claves.has(nueva) || libro.identidades.has(nueva)) r.falla('no se puede cambiar la clave de ' + nueva);
      else if (!lista(ev.movimientos).some((m) => m?.a === nueva)) r.falla('clave declarada para ' + nueva + ' sin darle tokens');
      else if (!(jwk && jwk.kty === 'EC' && jwk.crv === 'P-256' && jwk.x && jwk.y)) r.falla('clave inválida para ' + nueva);
    }
  }

  // Referencias: las del payload se siguen con el encaje; las del contexto (fuentes, evidencia) se buscan.
  const referencias = [];
  recorrer(ev.payload, (nodo, c) => {
    if (c.length > ARIDAD || !esReferencia(nodo)) return;
    const s = seguir(vista, nodo);
    const ref = { desde: 'payload', camino: c, ref: nodo.ref, dir: nodo.dir ?? RAIZ, procedencia: s.procedencia };
    if (s.rota && !vista.obtener(s.evento)) {
      ref.estado = 'pendiente';
      r.pendiente(camino(c) + ': referencia a un evento ausente del eje: ' + corto(s.evento));
    } else if (s.rota) {
      ref.estado = 'falla';
      r.falla(camino(c) + ': cadena de referencias sin fin desde ' + corto(nodo.ref));
    } else if (s.contenido === undefined) {
      ref.estado = 'pendiente';
      r.pendiente(camino(c) + ': posición sin desarrollar en ' + corto(s.evento) + ':' + s.dir);
    } else {
      ref.estado = 'ok';
    }
    referencias.push(ref);
  });
  for (const campo of ['fuentes', 'evidencia']) {
    for (const x of lista(ev.contexto?.[campo])) {
      const hay = typeof x === 'string' && Boolean(eje.obtener(x));
      referencias.push({ desde: 'contexto.' + campo, ref: x, estado: hay ? 'ok' : 'pendiente' });
      if (!hay) r.pendiente(campo + ': ' + corto(x) + ' ausente del eje');
    }
  }

  const resueltas = referencias.filter((x) => x.estado === 'ok').length;
  const textoFirma = firma === 'verificada' ? 'firma verificada de ' + ev.autor : firma === 'sin firma' ? 'sin firma (' + ev.autor + ' no tiene clave)' : 'firma ' + firma;
  const resumen = [
    idCorrecto ? 'id correcto' : 'id incorrecto',
    textoFirma,
    esGenesis ? 'génesis' : 'foco ' + (libro.ids.has(ev.sobre) ? 'en el eje' : 'ausente'),
    referencias.length ? resueltas + ' de ' + referencias.length + ' referencias resuelven' : 'sin referencias',
  ].join(' · ');
  return parte(3, r.estado, r.textos, resumen, { idCorrecto, firma, firmante: ev.firmante ?? null, clavesDeclaradas, referencias, enEje });
}

// ---------- 4 · acreditación material (el respaldo en el libro) ----------

function capaAcreditacion(eje, ev, libro) {
  const r = motivos();
  const vista = new Map();
  const ver = (id, k) => (vista.has(llave(id, k)) ? vista.get(llave(id, k)) : saldoEn(libro, id, k));
  const poner = (id, k, v) => vista.set(llave(id, k), v);
  const emitido = new Map();
  const serie = (k) => emitido.get(k) ?? libro.series.get(k);
  const movimientos = [];
  const movs = lista(ev.movimientos);
  if (!movs.length) r.pendiente('sin movimientos que respaldar (capa 1)');
  movs.forEach((m, i) => {
    const fila = { i, clave: null, de: m?.de ?? null, a: m?.a ?? null, cantidad: m?.cantidad, estado: 'ok' };
    movimientos.push(fila);
    const mal = (estado, texto) => { fila.estado = estado; fila.motivo = texto; r[estado]('movimiento ' + i + ': ' + texto); };
    if (validarMovimiento(m).length) return mal('pendiente', 'mal formado (capa 1): su respaldo no se comprueba');
    const k = claveToken(m);
    fila.clave = k;
    if (m.de === null) {
      // Emisión: la respalda su emisor. En E y R el emisor va en la serie; en T y P, la serie es de quien la inició.
      const s = serie(k);
      const emisor = esEoR(m) ? m.emisor : s?.emisor ?? ev.autor;
      if (emisor !== ev.autor) return mal('falla', 'la serie ' + k + ' es de ' + emisor + ' y la emite ' + ev.autor + ': nadie la respalda en nombre de otro');
      const total = (s?.emitido ?? 0) + m.cantidad;
      if (!Number.isFinite(total)) return mal('falla', 'la serie ' + k + ' no admite tanto');
      emitido.set(k, { emisor: s?.emisor ?? emisor, emitido: total });
    } else if (m.token === 'P') {
      // P no se emite fuera del génesis: lo respalda el poder de los ámbitos que cubren el suyo.
      if (m.ambito !== AMBITO_GENESIS && !libro.ids.has(m.ambito)) return mal('falla', 'P sobre un ámbito que no existe: ' + corto(m.ambito));
      const plan = planP(eje, ver, m.de, m.ambito, m.cantidad);
      if (!plan) return mal('falla', 'P insuficiente en ' + m.de + ' sobre ' + (m.ambito === AMBITO_GENESIS ? 'el eje' : corto(m.ambito)) + ' para mover ' + m.cantidad);
      for (const [kp, d] of plan) poner(m.de, kp, ver(m.de, kp) + d);
    } else {
      const s = serie(k);
      if (!s || !(s.emitido > 0)) return mal('falla', 'la serie ' + k + ' no se ha emitido: nada respalda estos tokens');
      if (esEoR(m) && s.emisor !== m.emisor) return mal('falla', 'la serie ' + k + ' es de ' + s.emisor + ', no de ' + m.emisor);
      const queda = ver(m.de, k) - m.cantidad;
      if (queda < 0) return mal('falla', 'saldo de ' + k + ' en ' + m.de + ': tiene ' + ver(m.de, k) + ', mueve ' + m.cantidad + ' (quedaría en ' + queda + ')');
      poner(m.de, k, queda);
    }
    if (m.a !== null) poner(m.a, k, ver(m.a, k) + m.cantidad);
  });
  const resumen = r.estado === 'ok'
    ? movs.length + (movs.length === 1 ? ' movimiento respaldado' : ' movimientos respaldados') + ' por series de su emisor, ningún saldo negativo · externa: sin acreditar'
    : r.textos[0] + ' · externa: sin acreditar';
  return parte(4, r.estado, r.textos, resumen, { movimientos, externa: SIN_ACREDITAR });
}

// ---------- 5 · permiso y ejecución ----------

function permisoDelLibro(ev, libro) {
  const r = motivos();
  const esGenesis = ev.contexto?.genesis === true;
  lista(ev.movimientos).forEach((m, i) => {
    if (validarMovimiento(m).length) return; // capa 1
    if (m.de === null) {
      if (esGenesis) {
        if (m.a !== ev.autor) r.falla('movimiento ' + i + ': el génesis solo emite a su autor');
      } else if (m.token === 'T' || m.token === 'P') {
        r.falla('movimiento ' + i + ': solo el génesis emite ' + m.token);
      } else {
        const tipo = libro.tipos.get(ev.autor);
        if (!EMITEN.includes(tipo)) r.falla('movimiento ' + i + ': solo personas y grupos emiten: ' + ev.autor + (tipo ? ' es ' + tipo : ' no declaró tipo en su alta'));
      }
    } else if (m.de !== ev.autor) {
      r.falla('movimiento ' + i + ': nadie mueve tokens ajenos: ' + m.de + ' no es el autor');
    }
  });
  // El tipo se declara en el alta, como la clave, y solo sirve para saber quién emite.
  for (const [id, tipo] of Object.entries(ev.contexto?.tipos ?? {})) {
    if (!TIPOS.includes(tipo)) r.falla('tipo inválido para ' + id + ': ' + tipo);
    else if (esGenesis) {
      if (id !== ev.autor) r.falla('el génesis solo declara el tipo de su autor');
      else if (!EMITEN.includes(tipo)) r.falla('el génesis emite: su autor es persona o grupo, no ' + tipo);
    } else if (libro.tipos.has(id) || libro.identidades.has(id)) r.falla('no se puede cambiar el tipo de ' + id);
    else if (!lista(ev.movimientos).some((m) => m?.a === id)) r.falla('tipo declarado para ' + id + ' sin darle tokens');
  }
  return r;
}

/** Quién puede autorizar hoy una consolidación (regla V0 del motor). Para una que aún no está en el eje, con el poder sobre su foco. */
function quienesPuedenAutorizar(eje, ev, id, enEje) {
  return eje.identidades().filter((x) => (enEje
    ? puedeAutorizar(eje, x, id)
    : x !== ev.autor && Boolean(eje.obtener(ev.sobre)) && eje.poderSobre(x, ev.sobre) > 0));
}

/** Por qué una autorización no cuenta; vacío si cuenta. */
function faltasDeAutorizacion(eje, ev) {
  const c = eje.obtener(ev.sobre);
  if (!c || c.contexto?.fase !== 'consolidado') return [['falla', 'no es sobre una consolidación: no autoriza nada']];
  if (ev.en !== FABRICA) return [['falla', 'no está anclada en la fábrica (' + FABRICA + '): no cuenta']];
  if (ev.autor === c.autor) return [['falla', 'el autor no se autoriza a sí mismo']];
  if (!puedeAutorizar(eje, ev.autor, c.id)) return [['falla', ev.autor + ' no tiene poder (P) sobre este registro: el escrito existe, pero no cuenta']];
  return [];
}

/** Por qué una ejecución no cuenta; vacío si cuenta. Exige en su evidencia una autorización válida (docs/MOTOR.md §13.2). */
function faltasDeEjecucion(eje, ev) {
  const c = eje.obtener(ev.sobre);
  if (!c || c.contexto?.fase !== 'consolidado') return [['falla', 'no es sobre una consolidación: no ejecuta nada']];
  if (ev.en !== FABRICA) return [['falla', 'no está anclada en la fábrica (' + FABRICA + '): no cuenta']];
  if (ev.autor !== c.autor) return [['falla', 'ejecuta el autor de la consolidación (' + c.autor + '), no ' + ev.autor]];
  const evidencia = lista(ev.contexto?.evidencia);
  const validas = new Set(autorizacionesValidas(eje, c.id).map((a) => a.id));
  const faltas = [];
  if (!evidencia.some((x) => validas.has(x))) faltas.push(['falla', 'su evidencia no incluye una autorización válida: ejecutar exige autorización']);
  const ausentes = evidencia.filter((x) => !eje.obtener(x));
  if (ausentes.length) faltas.push(['pendiente', 'evidencia ausente del eje: ' + ausentes.map(corto).join(', ')]);
  return faltas;
}

function permisoDelMotor(eje, ev, id, enEje) {
  const fase = ev.contexto?.fase;
  const r = motivos();
  if (fase === 'consolidado') {
    const estadoMotor = enEje ? estadoDe(eje, id) : 'PENDIENTE DE AUTORIZACIÓN';
    const puedenAutorizar = quienesPuedenAutorizar(eje, ev, id, enEje);
    const enFabrica = enEje ? eje.sobre(id, FABRICA) : [];
    const validas = enEje ? autorizacionesValidas(eje, id) : [];
    const noCuentan = enFabrica.filter((e) => e.contexto?.fase === 'autorizado' && !validas.includes(e));
    const ejecuciones = enFabrica.filter((e) => e.contexto?.fase === 'ejecutado');
    const queCuentan = ejecuciones.filter((e) => faltasDeEjecucion(eje, e).length === 0);
    const quienes = puedenAutorizar.length ? 'pueden autorizar: ' + puedenAutorizar.join(', ') : 'nadie puede autorizar hoy';
    const porQuien = 'por ' + validas.map((a) => a.autor).join(', ');
    let texto = estadoMotor;
    if (!ESTADO_MOTOR[estadoMotor]) r.pendiente('estado del motor sin traducir a esta capa: ' + estadoMotor);
    else if (estadoMotor === 'PENDIENTE DE AUTORIZACIÓN') {
      texto += ' · ' + quienes;
      r.pendiente(estadoMotor + (enEje ? '' : ' (aún no está en el eje)') + ' · ' + quienes + ' (regla V0)');
      // Lo escrito por quien no puede explica por qué sigue pendiente; no cambia el estado.
      for (const e of noCuentan) r.pendiente('«autorizado» de ' + e.autor + ' que no cuenta: ' + faltasDeAutorizacion(eje, e).map(([, t]) => t).join('; '));
    } else if (estadoMotor === 'AUTORIZADO') {
      texto += ' ' + porQuien + ' · falta ejecutar';
      r.pendiente('AUTORIZADO ' + porQuien + ' · falta ejecutar: consolidar no es ejecutar');
    } else if (estadoMotor === 'EJECUTADO' && !queCuentan.length) {
      r.falla('el motor da EJECUTADO, pero ninguna ejecución lleva en su evidencia una autorización válida (docs/MOTOR.md §13.2)');
    }
    return {
      r,
      motor: {
        fase, estadoMotor, puedenAutorizar,
        autorizaciones: validas.map((a) => ({ id: a.id, autor: a.autor })),
        noCuentan: noCuentan.map((a) => ({ id: a.id, autor: a.autor })),
        ejecuciones: ejecuciones.map((e) => ({ id: e.id, autor: e.autor, cuenta: queCuentan.includes(e) })),
      },
      texto,
    };
  }
  if (fase === 'autorizado' || fase === 'ejecutado') {
    const faltas = fase === 'autorizado' ? faltasDeAutorizacion(eje, ev) : faltasDeEjecucion(eje, ev);
    for (const [estado, texto] of faltas) r[estado](texto);
    const c = eje.obtener(ev.sobre);
    const estadoConsolidacion = c?.contexto?.fase === 'consolidado' ? estadoDe(eje, c.id) : null;
    const texto = (faltas.length ? fase + ' que no cuenta' : fase === 'autorizado' ? 'autorización que cuenta (regla V0)' : 'ejecución con evidencia de su autorización')
      + (estadoConsolidacion ? ' · consolidación ' + estadoConsolidacion : '');
    return { r, motor: { fase, consolidacion: c?.id ?? null, estadoConsolidacion, cuenta: faltas.length === 0 }, texto };
  }
  return { r, motor: null, texto: 'no es consolidación, autorización ni ejecución' };
}

function capaPermiso(eje, ev, libro, id, enEje) {
  const delLibro = permisoDelLibro(ev, libro);
  const { r: delMotor, motor, texto } = permisoDelMotor(eje, ev, id, enEje);
  const estado = peor([delLibro.estado, delMotor.estado]);
  const textoLibro = delLibro.estado === 'ok' ? (ev.contexto?.genesis === true ? 'génesis: emite por convención' : 'mueve lo suyo') : delLibro.textos[0];
  const resumen = textoLibro + ' · ' + texto + (motor?.estadoMotor === 'EJECUTADO' || (motor?.fase === 'ejecutado' && motor.cuenta) ? ' · externa: sin confirmar' : '');
  return parte(5, estado, [...delLibro.textos, ...delMotor.textos], resumen, {
    libro: { estado: delLibro.estado, motivos: delLibro.textos },
    motor,
    regla: 'V0 provisional hasta AARPIA: autoriza quien tiene P > 0 sobre el registro y no es su autor; ejecuta el autor',
    externa: SIN_CONFIRMAR,
  });
}

// ---------- la entrada ----------

/** Ejecuta una capa sin dejar que un registro malformado la tumbe: lo que no se puede comprobar, falla. */
async function protegida(n, fn) {
  try {
    return await fn();
  } catch (e) {
    return parte(n, 'falla', ['no se pudo comprobar: ' + e.message], 'no se pudo comprobar');
  }
}

/**
 * Las cinco capas de validez de un registro, cada una con su estado
 * ('ok' | 'pendiente' | 'falla'), sus motivos y un resumen, sin veredicto
 * global. `evento` es un id del eje o un evento (esté o no en el eje: un
 * borrador, uno recibido, uno manipulado). `epoca` es la época bajo la que se
 * lee (la época 0 por defecto): la época está fuera del dato. No escribe
 * nada ni toca el evento.
 *
 * Devuelve { id, enEje, epoca, capas: [5 partes], forma, interpretacion,
 * criptografia, acreditacion, permiso, resumen }.
 */
export async function validez(eje, evento, { epoca = EPOCA_0 } = {}) {
  if (!eje || typeof eje.obtener !== 'function') throw new TypeError('validez: falta el eje');
  if (!epoca || typeof epoca.reglaCorta !== 'function') throw new TypeError('validez: una época necesita su regla corta');
  const ev = typeof evento === 'string' ? eje.obtener(evento) : evento;
  if (!ev || typeof ev !== 'object') throw new Error('registro desconocido: ' + corto(evento));
  const id = typeof ev.id === 'string' && ev.id ? ev.id : SIN_ID;
  const indice = eje.orden.indexOf(id);
  const enEje = indice >= 0;
  const libro = libroAntes(eje, enEje ? indice : eje.orden.length);
  const vista = vistaCon(eje, ev, id);
  const capas = [
    await protegida(1, () => capaForma(ev, epoca)),
    await protegida(2, () => capaInterpretacion(vista, ev, id)),
    await protegida(3, () => capaCriptografia(eje, vista, ev, id, libro, enEje)),
    await protegida(4, () => capaAcreditacion(eje, ev, libro)),
    await protegida(5, () => capaPermiso(eje, ev, libro, id, enEje)),
  ];
  const [forma, interpretacion, criptografia, acreditacion, permiso] = capas;
  return {
    id,
    enEje,
    epoca: epoca.nombre ?? '(sin nombre)',
    capas,
    forma,
    interpretacion,
    criptografia,
    acreditacion,
    permiso,
    resumen: capas.map((c) => c.capa + ' ' + c.nombre + ': ' + c.estado + ' · ' + c.resumen).join('\n'),
  };
}
