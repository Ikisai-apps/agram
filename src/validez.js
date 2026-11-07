// Validez: las cinco capas (V2, conservadas en V3 y V4; MAPA §2.8 [A]) como
// estados independientes de un registro. Sin efectos: no escribe en el eje ni
// toca el evento. Cada capa dice ok, pendiente o falla, con sus motivos; no
// hay veredicto global ni puntuación («no colapsarlos en una puntuación
// global inventada», contrato v0.2). Una firma no es veracidad: que la capa 3
// esté en ok no sube ninguna otra, y que falle no baja ninguna otra.
//
//   1 forma y época               validarForma, y el payload y `en` leídos bajo la época elegida
//   2 interpretación              fórmulas (BQL), referencias (encaje) y posiciones: lo que se puede leer
//   3 criptografía y procedencia  id, firma, foco, autor y claves declaradas
//   4 acreditación material       respaldo en el libro: series emitidas por quien las respalda, ningún saldo negativo
//   5 permiso y ejecución         quién mueve y quién emite; en la fábrica, el estado del motor y quién pudo autorizar
//
// Las referencias van en la capa 2, escritas como { ref } o como =REF: el
// corpus pone en ella «contexto, referencias y posiciones» (V4 06 l.36) y la
// «resolución de referencias suficiente» (V2 05).
//
// PV5 inspecciona estas señales; no las garantiza. Lo que ninguna capa
// comprueba (que lo afirmado ocurrió en el mundo, que los efectos externos se
// confirmaron) es de AARPIA y de lo que venga fuera de AGRAM: docs/VALIDEZ.md.
//
// Las capas se leen en el lugar del registro: si el evento está en el eje (su
// id está y corresponde a su cuerpo), el libro (saldos, series, claves, tipos)
// y el motor son los de justo antes de él; si no está (un borrador, uno
// recibido, una copia manipulada con el mismo id), los de ahora.

import { ARIDAD, esReferencia, esDireccion, direccion } from './btml.js';
import { RAIZ, validarForma, verificarId } from './evento.js';
import { verificar } from './autoridad.js';
import { claveToken, validarMovimiento, AMBITO_GENESIS, TIPOS, EMITEN } from './tokens.js';
import { reglasDelCiclo, EMITEN_V2 } from './ciclo.js';
import { EPOCA_0, leerDireccion } from './epocas.js';
import { evaluar, esFormula } from './bql.js';
import { seguir } from './encaje.js';
import { estadoDe, puedeAutorizar, poderParaAutorizar, autorizacionesValidas, FABRICA, REGLA_AUTORIZAR, esConsolidacion } from './motor.js';

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
  const libro = {
    saldos: new Map(), bloqueados: new Map(), series: new Map(), claves: new Map(), tipos: new Map(),
    altas: new Map(), emitidoT: new Map(), identidades: new Set(), ids: new Set(),
    // Un registro guardado con la versión 2 se lee con las reglas de entonces (src/persistencia.js).
    reglas: hasta < (eje.eventosV2 ?? 0) ? 2 : 3,
  };
  for (let k = 0; k < hasta; k++) aplicar(eje, libro, eje.obtener(eje.orden[k]));
  return libro;
}

const saldoEn = (libro, id, k) => libro.saldos.get(llave(id, k)) ?? 0;
const bloqueadoEn = (libro, id, k, salida) => libro.bloqueados.get(JSON.stringify([id, k, salida])) ?? 0;

/** Lo que leen las reglas del ciclo (src/ciclo.js), desde el libro de justo antes del registro. */
function contextoCiclo(eje, libro) {
  return {
    tipo: (id) => libro.tipos.get(id) ?? null,
    alta: (id) => libro.altas.get(id) ?? null,
    emitidoT: (id, escala) => libro.emitidoT.get(JSON.stringify([id, escala])) ?? 0,
    serie: (k) => libro.series.get(k) ?? null,
    registro: (id) => (libro.ids.has(id) ? eje.obtener(id) : undefined),
    ambitosQueCubren: (ambito) => eje.ambitosQueCubren(ambito),
    saldo: (id, k) => saldoEn(libro, id, k),
    reglas: libro.reglas,
  };
}

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
    if (m.a !== null && !libro.altas.has(m.a)) libro.altas.set(m.a, { id: ev.id, t: ev.t });
    if (m.estado === 'bloqueo' || m.estado === 'liberacion') {
      const d = m.estado === 'bloqueo' ? m.cantidad : -m.cantidad;
      ajustar(m.de, k, -d);
      const kb = JSON.stringify([m.de, k, m.salida]);
      libro.bloqueados.set(kb, (libro.bloqueados.get(kb) ?? 0) + d);
      continue;
    }
    if (m.de === null) {
      const s = libro.series.get(k) ?? { emisor: esEoR(m) ? m.emisor : ev.autor, emitido: 0, ...(m.token === 'E' ? { caduca: m.caduca ?? null } : {}) };
      libro.series.set(k, { ...s, emitido: s.emitido + m.cantidad });
      if (m.token === 'T' && ev.contexto?.genesis !== true) {
        const kt = JSON.stringify([ev.autor, m.escala]);
        libro.emitidoT.set(kt, (libro.emitidoT.get(kt) ?? 0) + m.cantidad);
      }
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
  const sinRegla = new Set();
  const leer = (p, d) => {
    if (p < ARIDAD && epoca.reglaCorta(p, d) === undefined) sinRegla.add(p + '.' + d);
  };
  recorrer(ev.payload, (nodo, c) => {
    profundidad = Math.max(profundidad, c.length);
    c.forEach((d, p) => leer(p, d));
  });
  // Pasar de diez profundidades no es un fallo de forma: el límite es de
  // posicionamiento por foco (docs/notas/AUDITORIA_AJUSTE.md l.299). Lo dice la capa 2.
  const en = esDireccion(ev.en) ? leerDireccion(ev.en, epoca) : [];
  en.forEach(({ profundidad: p, digito: d }) => leer(p, d));
  // La época está fuera del dato (MAPA §9 [D]): lo que no se lee bajo esta época
  // no es un error del registro. Que quede pendiente es provisional: [X] docs/VALIDEZ.md §8.
  for (const pd of sinRegla) r.pendiente('sin regla corta en ' + (epoca.nombre ?? 'la época') + ' para ' + pd + ': no legible bajo esta época');
  const nombre = epoca.nombre ?? 'la época elegida';
  const resumen = r.estado === 'ok'
    ? 'forma válida · legible bajo ' + nombre + ' (profundidad ' + profundidad + ')'
    : r.estado === 'pendiente' ? 'forma válida · no legible entera bajo ' + nombre : 'forma rota: ' + r.textos[0];
  return parte(1, r.estado, r.textos, resumen, { errores, epoca: nombre, profundidad, lectura: { en } });
}

// ---------- 2 · interpretación: fórmulas, referencias y posiciones ----------

/**
 * Una referencia BTML seguida con el encaje. Ausente o sin desarrollar →
 * pendiente: puede llegar (corpus V4 02 l.49: «Referencia/contexto ausente →
 * PENDIENTE»). Cadena sin fin → falla.
 */
function leerReferencia(vista, nodo) {
  const s = seguir(vista, nodo);
  if (s.rota && !vista.obtener(s.evento)) return { s, estado: 'pendiente', texto: 'referencia a un evento ausente del eje: ' + corto(s.evento) };
  if (s.rota) return { s, estado: 'falla', texto: 'cadena de referencias sin fin desde ' + corto(nodo.ref) };
  if (s.contenido === undefined) return { s, estado: 'pendiente', texto: 'posición sin desarrollar en ' + corto(s.evento) + ':' + s.dir };
  return { s, estado: 'ok', texto: null };
}

function capaInterpretacion(eje, vista, ev, id) {
  const r = motivos();
  const formulas = [];
  const referencias = [];
  let hondo = null;
  recorrer(ev.payload, (nodo, c) => {
    if (c.length > ARIDAD) {
      if (!hondo) hondo = c;
      return;
    }
    if (esFormula(nodo)) {
      // Una fórmula, con BQL en su celda. =REF a un evento ausente da PENDIENTE, igual que { ref }.
      let x;
      try {
        x = evaluar(vista, id, c);
      } catch (e) {
        x = { estado: 'ERROR', texto: 'ERROR: ' + e.message };
      }
      const f = { camino: c, dir: direccion(c), formula: nodo, estado: x.estado, texto: x.texto, capa: estadoDeBql(x.estado) };
      formulas.push(f);
      if (f.capa !== 'ok') r[f.capa](camino(c) + ': ' + f.texto);
    } else if (esReferencia(nodo)) {
      const { s, estado, texto } = leerReferencia(vista, nodo);
      referencias.push({ desde: 'payload', camino: c, ref: nodo.ref, dir: nodo.dir ?? RAIZ, estado, procedencia: s.procedencia });
      if (estado !== 'ok') r[estado](camino(c) + ': ' + texto);
    }
  });
  // Más de diez profundidades: ninguna dirección llega ahí en este foco. Mismo
  // estado y texto que BQL en main (integración del 7-11, sin revisar): [X] docs/VALIDEZ.md §8.
  if (hondo) r.pendiente('más de diez profundidades en ' + camino(hondo.slice(0, ARIDAD + 1)) + ': posición sin desarrollar (falta el cambio de foco)');
  // Las referencias del contexto (fuentes de una consolidación, evidencia de una ejecución) son ids del eje.
  for (const campo of ['fuentes', 'evidencia']) {
    for (const x of lista(ev.contexto?.[campo])) {
      if (typeof x !== 'string') {
        referencias.push({ desde: 'contexto.' + campo, ref: x, estado: 'falla' });
        r.falla('contexto.' + campo + ': ' + JSON.stringify(x) + ' no es un id');
        continue;
      }
      const hay = Boolean(eje.obtener(x));
      referencias.push({ desde: 'contexto.' + campo, ref: x, estado: hay ? 'ok' : 'pendiente' });
      if (!hay) r.pendiente('contexto.' + campo + ': ' + corto(x) + ' ausente del eje');
    }
  }
  const cuenta = (e) => formulas.filter((f) => f.capa === e).length;
  const resueltas = referencias.filter((x) => x.estado === 'ok').length;
  const resumen = [
    formulas.length === 0
      ? 'sin fórmulas'
      : (formulas.length === 1 ? '1 fórmula' : formulas.length + ' fórmulas') + ' · resueltas: ' + cuenta('ok') + ' · pendientes: ' + cuenta('pendiente') + ' · con error: ' + cuenta('falla'),
    referencias.length ? resueltas + ' de ' + referencias.length + ' referencias resuelven' : 'sin referencias',
    ...(hondo ? ['más de diez profundidades'] : []),
  ].join(' · ');
  return parte(2, r.estado, r.textos, resumen, { formulas, referencias });
}

// ---------- 3 · criptografía y procedencia ----------

async function capaCriptografia(eje, ev, id, libro, enEje, idCorrecto) {
  const r = motivos();
  const esGenesis = ev.contexto?.genesis === true;

  // El id es el hash del cuerpo canónico: si no corresponde, el registro no es el que dice ser.
  if (id === SIN_ID) r.falla('sin id');
  else if (!idCorrecto) r.falla('el id no corresponde al cuerpo: el registro no es el que dice ser');

  // Firma: verificada si el autor tiene clave; sin clave, sin firma (salvo que el eje exija firmas).
  const clave = esGenesis ? ev.contexto?.claves?.[ev.autor] : libro.claves.get(ev.autor);
  const conAlta = esGenesis || libro.identidades.has(ev.autor);
  let firma;
  if (clave) {
    if (!ev.firma) { firma = 'ausente'; r.falla('firma ausente de ' + ev.autor + ': tiene clave'); }
    else if (ev.firmante !== ev.autor) { firma = 'de otro'; r.falla('firmado por ' + ev.firmante + ', no por el autor ' + ev.autor); }
    else if (!(await verificar(ev, clave))) { firma = 'inválida'; r.falla('firma inválida de ' + ev.autor); }
    else firma = 'verificada';
  } else if (ev.firma && !conAlta) {
    // La clave puede llegar con el alta del autor; entonces se podrá verificar.
    firma = 'sin verificar';
    r.pendiente('firmado, pero ' + ev.autor + ' aún no tiene alta: su clave puede llegar con ella');
  } else if (eje.exigirFirmas) {
    firma = ev.firma ? 'sin verificar' : 'ausente';
    r.falla('el eje exige firmas y ' + ev.autor + ' no tiene clave');
  } else {
    // G1 ([X] docs/VALIDEZ.md §8): sin clave no se exige firma. Una firma que
    // nunca podrá verificarse (el autor ya tiene alta y su clave no se puede
    // añadir) no prueba nada: cuenta como sin firma.
    firma = ev.firma ? 'sin verificar' : 'sin firma';
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

  const textoFirma = firma === 'verificada' ? 'firma verificada de ' + ev.autor
    : firma === 'sin firma' ? 'sin firma (' + ev.autor + ' no tiene clave)'
      : firma === 'sin verificar' ? 'firma sin verificar (' + ev.autor + ' no tiene clave)'
        : 'firma ' + firma;
  const resumen = [
    idCorrecto ? 'id correcto' : 'id incorrecto',
    textoFirma,
    esGenesis ? 'génesis' : 'foco ' + (libro.ids.has(ev.sobre) ? 'en el eje' : 'ausente'),
  ].join(' · ');
  return parte(3, r.estado, r.textos, resumen, { idCorrecto, firma, firmante: ev.firmante ?? null, clavesDeclaradas, enEje });
}

// ---------- 4 · acreditación material (el respaldo en el libro) ----------

function capaAcreditacion(eje, ev, libro) {
  const r = motivos();
  const esGenesis = ev.contexto?.genesis === true;
  const vista = new Map();
  const ver = (id, k) => (vista.has(llave(id, k)) ? vista.get(llave(id, k)) : saldoEn(libro, id, k));
  const poner = (id, k, v) => vista.set(llave(id, k), v);
  const emitido = new Map();
  const serie = (k) => emitido.get(k) ?? libro.series.get(k);
  const vistaB = new Map();
  const verB = (id, k, salida) => (vistaB.has(JSON.stringify([id, k, salida])) ? vistaB.get(JSON.stringify([id, k, salida])) : bloqueadoEn(libro, id, k, salida));
  const ponerB = (id, k, salida, v) => vistaB.set(JSON.stringify([id, k, salida]), v);
  // El respaldo de las emisiones según el ciclo (src/ciclo.js): el tope del reloj en T, un registro existente en P, la caducidad de la serie en E.
  // Lo que es del evento entero (el t, anterior al de su foco o al alta de su autor) falla aquí mismo.
  const delCiclo = new Map();
  for (const e of reglasDelCiclo(ev, contextoCiclo(eje, libro))) {
    if (e.capa !== 4) continue;
    if (e.i === null) r.falla(e.texto);
    else if (!delCiclo.has(e.i)) delCiclo.set(e.i, e.texto);
  }
  const movimientos = [];
  const movs = lista(ev.movimientos);
  // Un evento no cambia: lo que no se puede comprobar ahora no se podrá nunca, así que falla (no pendiente).
  if (!movs.length) r.falla('sin movimientos: no hay respaldo que comprobar (todo evento mueve T; capa 1)');
  movs.forEach((m, i) => {
    const fila = { i, clave: null, de: m?.de ?? null, a: m?.a ?? null, cantidad: m?.cantidad, estado: 'ok' };
    movimientos.push(fila);
    const mal = (estado, texto) => { fila.estado = estado; fila.motivo = texto; r[estado]('movimiento ' + i + ': ' + texto); };
    if (validarMovimiento(m).length) return mal('falla', 'mal formado (capa 1): su respaldo no se puede comprobar');
    const k = claveToken(m);
    fila.clave = k;
    if (m.de === null) {
      // Emisión (VG, 7-11 noche). La respalda la persona que la emite: T, con
      // el tope del reloj; P, sobre un registro que existe; E y R, a su nombre o
      // al de un grupo (si la persona tiene P sobre él lo dice la capa 5).
      if (!esGenesis && delCiclo.has(i)) return mal('falla', delCiclo.get(i));
      const s = serie(k);
      const emisor = esEoR(m) ? m.emisor : ev.autor;
      if (emisor !== ev.autor && !(esEoR(m) && !esGenesis && libro.tipos.get(emisor) === 'grupo')) {
        return mal('falla', 'la serie ' + k + ' es de ' + emisor + ' y la emite ' + ev.autor + ': nadie la respalda en nombre de otro');
      }
      const total = (s?.emitido ?? 0) + m.cantidad;
      if (!Number.isFinite(total)) return mal('falla', 'la serie ' + k + ' no admite tanto');
      emitido.set(k, { ...(s ?? {}), emisor: s?.emisor ?? emisor, emitido: total });
    } else if (m.estado === 'bloqueo') {
      // Bloquear: sale del disponible, de la clave exacta.
      if (ver(m.de, k) < m.cantidad) return mal('falla', 'saldo disponible de ' + k + ' en ' + m.de + ': tiene ' + ver(m.de, k) + ', bloquea ' + m.cantidad);
      poner(m.de, k, ver(m.de, k) - m.cantidad);
      ponerB(m.de, k, m.salida, verB(m.de, k, m.salida) + m.cantidad);
      return undefined;
    } else if (m.estado === 'liberacion') {
      // Liberar: sale de lo bloqueado con esa misma salida.
      if (verB(m.de, k, m.salida) < m.cantidad) return mal('falla', 'bloqueado de ' + k + ' en ' + m.de + ' con la salida «' + m.salida + '»: hay ' + verB(m.de, k, m.salida) + ', libera ' + m.cantidad);
      ponerB(m.de, k, m.salida, verB(m.de, k, m.salida) - m.cantidad);
      poner(m.de, k, ver(m.de, k) + m.cantidad);
      return undefined;
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

function permisoDelLibro(eje, ev, libro) {
  const r = motivos();
  const esGenesis = ev.contexto?.genesis === true;
  lista(ev.movimientos).forEach((m, i) => {
    if (validarMovimiento(m).length) return; // capa 1
    if (m.de === null) {
      if (esGenesis && m.a !== ev.autor) r.falla('movimiento ' + i + ': el génesis solo emite a su autor');
    } else if (m.de !== ev.autor) {
      r.falla('movimiento ' + i + ': nadie mueve tokens ajenos: ' + m.de + ' no es el autor');
    }
  });
  // Quién emite y en qué orden (VG, 7-11 noche): solo personas, T para sí mismas,
  // a nombre de un grupo con P sobre él, escalonado T → R → P → E (src/ciclo.js).
  // MAPA §12 [D]: «Nadie emite denominación ajena; solo el emisor amplía su serie».
  for (const e of reglasDelCiclo(ev, contextoCiclo(eje, libro))) {
    if (e.capa === 5) r.falla((e.i === null ? '' : 'movimiento ' + e.i + ': ') + e.texto);
  }
  // El tipo se declara en el alta, como la clave, y solo sirve para saber quién emite.
  for (const [id, tipo] of Object.entries(ev.contexto?.tipos ?? {})) {
    if (!TIPOS.includes(tipo)) r.falla('tipo inválido para ' + id + ': ' + tipo);
    else if (esGenesis) {
      if (id !== ev.autor) r.falla('el génesis solo declara el tipo de su autor');
      else if (!(libro.reglas === 2 ? EMITEN_V2 : EMITEN).includes(tipo)) r.falla('el génesis lo emite una persona: su autor no puede ser ' + tipo);
    } else if (libro.tipos.has(id) || libro.identidades.has(id)) r.falla('no se puede cambiar el tipo de ' + id);
    else if (!lista(ev.movimientos).some((m) => m?.a === id)) r.falla('tipo declarado para ' + id + ' sin darle tokens');
  }
  return r;
}

/** Quién puede autorizar hoy una consolidación (regla V0 del motor). Para una que aún no está en el eje, con el poder sobre su foco. */
function quienesPuedenAutorizar(eje, ev, id, enEje) {
  return eje.identidades().filter((x) => (enEje
    ? puedeAutorizar(eje, x, id)
    : x !== ev.autor && poderParaAutorizar(eje, x, ev.sobre, ev.autor).reduce((s, p) => s + p.cantidad, 0) > 0));
}

/** Por qué una autorización no cuenta; vacío si cuenta. */
function faltasDeAutorizacion(eje, ev) {
  const c = eje.obtener(ev.sobre);
  if (!esConsolidacion(c)) return [['falla', 'no es sobre una consolidación: no autoriza nada']];
  if (ev.en !== FABRICA) return [['falla', 'no está anclada en la fábrica (' + FABRICA + '): no cuenta']];
  if (ev.autor === c.autor) return [['falla', 'el autor no se autoriza a sí mismo']];
  if (!puedeAutorizar(eje, ev.autor, c.id)) return [['falla', ev.autor + ' no tiene poder (P) sobre este registro que cuente para autorizar a ' + c.autor + ' (solo cuenta el P sobre un registro del hilo que ' + c.autor + ' no escribió): el escrito existe, pero no cuenta']];
  return [];
}

/** Por qué una ejecución no cuenta; vacío si cuenta. Exige en su evidencia una autorización válida (docs/MOTOR.md §13.2). */
function faltasDeEjecucion(eje, ev) {
  const c = eje.obtener(ev.sobre);
  if (!esConsolidacion(c)) return [['falla', 'no es sobre una consolidación: no ejecuta nada']];
  if (ev.en !== FABRICA) return [['falla', 'no está anclada en la fábrica (' + FABRICA + '): no cuenta']];
  if (ev.autor !== c.autor) return [['falla', 'ejecuta el autor de la consolidación (' + c.autor + '), no ' + ev.autor]];
  const evidencia = lista(ev.contexto?.evidencia);
  const validas = new Set(autorizacionesValidas(eje, c.id).map((a) => a.id));
  const faltas = [];
  if (!evidencia.some((x) => validas.has(x))) faltas.push(['falla', 'su evidencia no incluye una autorización válida: ejecutar exige autorización']);
  // Si un id de la evidencia no está en el eje, lo dice la capa 2 (referencias del contexto).
  return faltas;
}

/**
 * La fábrica vista desde este registro. Con `enEje` (el registro del eje con
 * ese id, no una copia manipulada), el estado del motor es el del eje; si no,
 * se lee como un borrador: lo que diría el motor si entrara.
 */
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
      const comoBorrador = enEje ? '' : ' (no está en el eje: se lee como borrador)';
      texto += comoBorrador + ' · ' + quienes;
      r.pendiente(estadoMotor + comoBorrador + ' · ' + quienes + ' (regla V0)');
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
    const estadoConsolidacion = esConsolidacion(c) ? estadoDe(eje, c.id) : null;
    const texto = (faltas.length ? fase + ' que no cuenta' : fase === 'autorizado' ? 'autorización que cuenta (regla V0)' : 'ejecución con evidencia de su autorización')
      + (estadoConsolidacion ? ' · consolidación ' + estadoConsolidacion : '');
    return { r, motor: { fase, consolidacion: c?.id ?? null, estadoConsolidacion, cuenta: faltas.length === 0 }, texto };
  }
  return { r, motor: null, texto: 'no es consolidación, autorización ni ejecución' };
}

function capaPermiso(eje, ev, libro, id, enEje) {
  const delLibro = permisoDelLibro(eje, ev, libro);
  const { r: delMotor, motor, texto } = permisoDelMotor(eje, ev, id, enEje);
  const estado = peor([delLibro.estado, delMotor.estado]);
  const textoLibro = delLibro.estado === 'ok' ? (ev.contexto?.genesis === true ? 'génesis: emite por convención' : 'mueve lo suyo') : delLibro.textos[0];
  const resumen = textoLibro + ' · ' + texto + (motor?.estadoMotor === 'EJECUTADO' || (motor?.fase === 'ejecutado' && motor.cuenta) ? ' · externa: sin confirmar' : '');
  return parte(5, estado, [...delLibro.textos, ...delMotor.textos], resumen, {
    libro: { estado: delLibro.estado, motivos: delLibro.textos },
    motor,
    regla: REGLA_AUTORIZAR,
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
 * `enEje` dice si el registro es el del eje: su id está en el eje y
 * corresponde a su cuerpo. Una copia con el mismo id y otro cuerpo no lo es:
 * se lee como un borrador, con el libro y el motor de ahora.
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
  let idCorrecto = false;
  if (id !== SIN_ID) {
    try { idCorrecto = await verificarId(ev); } catch { idCorrecto = false; }
  }
  const indice = idCorrecto ? eje.orden.indexOf(id) : -1;
  const enEje = indice >= 0;
  const libro = libroAntes(eje, enEje ? indice : eje.orden.length);
  const vista = vistaCon(eje, ev, id);
  const capas = [
    await protegida(1, () => capaForma(ev, epoca)),
    await protegida(2, () => capaInterpretacion(eje, vista, ev, id)),
    await protegida(3, () => capaCriptografia(eje, ev, id, libro, enEje, idCorrecto)),
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
