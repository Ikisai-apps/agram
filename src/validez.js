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
//   5 permiso y ejecución         quién mueve y quién emite; y el ciclo leído: si lo que el registro anuncia ya pasó (cerrado)
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

import { ARIDAD, esReferencia, esDireccion, esLista, direccion } from './btml.js';
import { RAIZ, validarForma, verificarId, esPresente } from './evento.js';
import { verificar, verificarPosesion } from './autoridad.js';
import { claveToken, validarMovimiento, asignacionT, AMBITO_GENESIS } from './tokens.js';
import { EMITEN_V2, motivoTipo, motivoAjenos, gastaAsignacion, esInformativoT, repartirGastoT, T_NO_SE_EMITE, SIN_TIPO } from './ciclo.js';
import { incongruenciaDe } from './tiempo.js';
import { EPOCA_0, EPOCA_0_BTML, leerDireccion } from './epocas.js';
import { evaluar, consultar, esFormula } from './bql.js';
import { seguir } from './encaje.js';
import { cerrado } from './motor.js';
import { motivosDe, CONDICIONES_DEL_CICLO } from './condiciones/index.js';
import { motivosDeReglas } from './condiciones/reglas.js';

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

/**
 * La regla del ciclo que lee la capa 5 (encargo 3b; VG, 8-11, mapa §15 [D] «Una sola operación: registrar»): cada uno
 * mueve lo suyo, nadie autoriza lo ajeno, y si un proceso está cerrado lo dice la plantilla de cerrado de su dueño.
 */
export const REGLA_DEL_CICLO = 'cada uno mueve lo suyo y nadie autoriza lo ajeno; si un proceso está cerrado lo dice la plantilla de cerrado que su dueño nombra en su 2 (por defecto, «all announced movements happened»)';

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
 * más de diez posiciones por décupla (lo demás ya es un fallo de forma).
 * Por hojas (VG, 7-11 noche): una lista (fuera de la raíz, solo hojas) no
 * añade profundidad: cada elemento se visita con el camino de su posición y
 * su índice en la lista, `visitar(elemento, camino, k)`, todos, aunque pasen
 * de diez.
 */
function recorrer(payload, visitar, c = []) {
  visitar(payload, c);
  if (!Array.isArray(payload) || c.length > ARIDAD) return;
  if (c.length > 0 && esLista(payload)) {
    payload.forEach((x, k) => visitar(x, c, k));
    return;
  }
  for (let i = 0; i < Math.min(payload.length, ARIDAD); i++) recorrer(payload[i], visitar, [...c, i]);
}

// ---------- el libro: saldos, series, claves y tipos hasta un punto del eje ----------

const llave = (id, k) => JSON.stringify([id, k]);

/**
 * El eje de justo antes del registro número `hasta` (eje.antes): su libro de
 * transacciones (src/libro.js), sus series, claves, tipos y altas, tal como
 * los leyó el eje al validarlo (VG, 9-11: la capa cero). Lee el eje; no lo
 * toca. `reglas` es 2 si el registro se guardó con la versión 2
 * (src/persistencia.js) y se lee con las reglas de entonces.
 */
function libroAntes(eje, hasta) {
  return { eje: eje.antes(hasta), reglas: hasta < (eje.eventosV2 ?? 0) ? 2 : 3 };
}

const saldoEn = (libro, id, k) => libro.eje.saldo(id, k);
const bloqueadoEn = (libro, id, k, salida) => libro.eje.bloqueado(id, k, salida);
const conCuenta = (libro, id) => libro.eje.libro.tiene(id);
const enLibro = (libro, id) => libro.eje.eventos.has(id);

/**
 * Los motivos de las reglas de la época (src/condiciones/reglas.js) y de las
 * condiciones del ciclo y de R que quedan en JS (src/condiciones/) para `ev`,
 * sobre el libro de justo antes del registro: lo mismo que evalúa el eje al
 * validar, con su contexto (eje.contexto). Una sola verdad. Cada motivo lleva
 * `i` (el movimiento, o null), `capa`, `texto` y, si es de una regla que no
 * se resolvió, `pendiente`.
 */
function condicionesDe(libro, ev) {
  if (!libro.motivos) {
    const ctx = libro.eje.contexto(ev);
    // El génesis no pasa por las reglas de la época (encargo 3b: es la época 0 en el eje), como en Eje.genesis y al
    // restaurar; solo por el suelo.
    const genesis = ev.contexto?.genesis === true && libro.reglas !== 2;
    libro.motivos = [
      ...(genesis ? [] : motivosDeReglas(ctx)),
      ...motivosDe(CONDICIONES_DEL_CICLO, libro.eje.transaccion(ev), libro.eje.libro, ctx),
    ];
  }
  return libro.motivos;
}

/** Pone en la capa `r` los motivos de las reglas de la época de la capa `capa` (salvo las de `salvo`). */
function deLasReglas(r, libro, ev, capa, salvo = []) {
  for (const e of condicionesDe(libro, ev)) {
    if (e.capa === capa && e.i === null && e.pendiente !== undefined && !salvo.includes(e.condicion)) r[e.pendiente ? 'pendiente' : 'falla'](e.texto);
  }
}

/**
 * Plan de débito de P como el del eje: del P posicionado en su registro y de su origen, sin más (encargo 3b: ya no
 * hay P que cubra lo de debajo ni P del génesis; mapa §15; encargo 3b-bis: la serie es la del registro y el origen).
 * null si no alcanza.
 */
function planP(eje, ver, identidad, m) {
  const k = claveToken(m);
  const cantidad = m.cantidad;
  return ver(identidad, k) >= cantidad ? [[k, -cantidad]] : null;
}

/** El eje visto con este evento dentro: lo que leen BQL y el encaje. Sin tocar el eje. */
function vistaCon(eje, ev, id) {
  if (eje.obtener(id) === ev) return eje;
  const orden = eje.orden.includes(id) ? eje.orden : [...eje.orden, id];
  return { obtener: (x) => (x === id ? ev : eje.obtener(x)), orden, sobre: (x, en) => eje.sobre(x, en) };
}

// ---------- 1 · forma y época ----------

function capaForma(ev, epoca, { tLaxo = false } = {}) {
  const r = motivos();
  const errores = validarForma(ev, { tLaxo }); // el t laxo, solo en un registro guardado con la versión 2
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
  // La época 0 y los registros de sus reglas se resuelven siempre (encargo 3b: una invitación referencia la época en
  // su 2), como en el eje (src/condiciones/evento.js, referenciasAusentes).
  if (nodo.ref === EPOCA_0_BTML.id || EPOCA_0_BTML.registros.has(nodo.ref)) return { s: { evento: nodo.ref, procedencia: 'época 0' }, estado: 'ok', texto: null };
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
  recorrer(ev.payload, (nodo, c, k) => {
    if (c.length > ARIDAD) {
      if (!hondo) hondo = c;
      return;
    }
    // Un elemento de una lista va por el camino de su posición y su índice en ella: «1[2]» (por hojas).
    const donde = camino(c) + (k === undefined ? '' : '[' + k + ']');
    const enLista = k === undefined ? {} : { lista: k };
    if (esFormula(nodo)) {
      // Una fórmula, con BQL en su celda. =REF a un evento ausente da PENDIENTE, igual que { ref }.
      // Dentro de una lista no tiene dirección propia: se evalúa desde la posición de la lista, como la lee BQL.
      let x;
      try {
        x = k === undefined ? evaluar(vista, id, c) : consultar(vista, id, c, nodo);
      } catch (e) {
        x = { estado: 'ERROR', texto: 'ERROR: ' + e.message };
      }
      const f = { camino: c, ...enLista, dir: direccion(c), formula: nodo, estado: x.estado, texto: x.texto, capa: estadoDeBql(x.estado) };
      formulas.push(f);
      if (f.capa !== 'ok') r[f.capa](donde + ': ' + f.texto);
    } else if (esReferencia(nodo)) {
      const { s, estado, texto } = leerReferencia(vista, nodo);
      referencias.push({ desde: 'payload', camino: c, ...enLista, ref: nodo.ref, dir: nodo.dir ?? RAIZ, estado, procedencia: s.procedencia });
      if (estado !== 'ok') r[estado](donde + ': ' + texto);
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
  // La escala del T gastado frente al tamaño de lo emitido (VG, 7-11 noche): se enseña, nunca falla.
  return parte(2, r.estado, r.textos, resumen, { formulas, referencias, incongruenciaT: incongruenciaDe(ev) });
}

// ---------- 3 · criptografía y procedencia ----------

async function capaCriptografia(eje, ev, id, libro, enEje, idCorrecto) {
  const r = motivos();
  const esGenesis = ev.contexto?.genesis === true;

  // El id es el hash del cuerpo canónico: si no corresponde, el registro no es el que dice ser.
  if (id === SIN_ID) r.falla('sin id');
  else if (!idCorrecto) r.falla('el id no corresponde al cuerpo: el registro no es el que dice ser');

  // Firma: verificada si el autor tiene clave; sin clave, sin firma (salvo que el eje exija firmas). Quien aún no
  // tiene cuenta escribe su propia alta (B1, como el génesis): su clave es la que declara en ella para sí.
  const propia = esGenesis || !conCuenta(libro, ev.autor);
  const clave = propia ? ev.contexto?.claves?.[ev.autor] : libro.eje.clave(ev.autor);
  // R9: fuera de un eje de demostración (lo marca su génesis) y del prefijo de la versión 2, sin clave no se actúa.
  // La demostración la da solo la bandera del génesis (SEG-02); el prefijo v2 lo exime libro.reglas.
  const demostracion = esGenesis ? ev.contexto?.demostracion === true : eje.demostracion !== false;
  const exigeClave = !demostracion && libro.reglas !== 2;
  // Quién firma y que sin clave no se actúa son reglas de la época (B4: «who has a key signs», «without a key nobody
  // acts»; encargo 3a, paso 9): sus motivos llegan con los de las demás reglas de esta capa (deLasReglas). Aquí, lo
  // criptográfico (la firma verifica) y, en el prefijo de la versión 2, las reglas de entonces.
  const v2 = libro.reglas === 2;
  let firma;
  if (clave) {
    if (!ev.firma) { firma = 'ausente'; if (v2) r.falla('firma ausente de ' + ev.autor + ': tiene clave'); }
    else if (ev.firmante !== ev.autor) { firma = 'de otro'; if (v2) r.falla('firmado por ' + ev.firmante + ', no por el autor ' + ev.autor); }
    else if (!(await verificar(ev, clave))) { firma = 'inválida'; r.falla('firma inválida de ' + ev.autor); }
    else firma = 'verificada';
  } else if (eje.exigirFirmas) {
    firma = ev.firma ? 'sin verificar' : 'ausente';
    r.falla('el eje exige firmas y ' + ev.autor + ' no tiene clave');
  } else if (exigeClave) {
    // R9: sin clave no se actúa (fuera de un eje de demostración): lo dice la regla.
    firma = ev.firma ? 'sin verificar' : 'ausente';
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
  } else if (!enLibro(libro, ev.sobre)) {
    // Referencia o contexto ausente → PENDIENTE (corpus V4 02): puede llegar.
    r.pendiente('foco ausente del eje: ' + corto(ev.sobre));
  }
  // Claves declaradas en un alta: la del autor que escribe su propia alta (su firma es la prueba de posesión), y las
  // de identidades nuevas que reciben tokens en ese evento.
  const clavesDeclaradas = [];
  if (!esGenesis) {
    const declaradas = ev.contexto?.claves ?? {};
    for (const [nueva, jwk] of Object.entries(declaradas)) {
      const suya = nueva === ev.autor && propia;
      // La prueba de posesión (R9): la clave nueva firma el id del alta (`posesion`, src/autoridad.js); la del autor
      // de su propia alta, su firma (B1).
      const conPrueba = Boolean(ev.posesion) && typeof ev.posesion === 'object' && Object.hasOwn(ev.posesion, nueva);
      const posesion = suya && !conPrueba ? (firma === 'verificada' ? 'probada' : 'sin probar') : !conPrueba ? 'sin probar' : (await verificarPosesion(ev, nueva, jwk)) ? 'probada' : 'falla';
      clavesDeclaradas.push({ identidad: nueva, por: ev.autor, posesion });
      // Dónde se declara una clave y que llegue con su prueba son reglas de la época (B4); aquí, lo criptográfico.
      if (v2 && (libro.eje.claves.has(nueva) || conCuenta(libro, nueva))) r.falla('no se puede cambiar la clave de ' + nueva);
      else if (v2 && !suya && !lista(ev.movimientos).some((m) => m?.a === nueva)) r.falla('clave declarada para ' + nueva + ' sin darle tokens');
      else if (!(jwk && jwk.kty === 'EC' && jwk.crv === 'P-256' && jwk.x && jwk.y)) r.falla('clave inválida para ' + nueva);
      else if (posesion === 'falla') r.falla('prueba de posesión inválida para ' + nueva + ': no la firma la clave que se declara');
    }
    for (const otra of Object.keys(ev.posesion && typeof ev.posesion === 'object' ? ev.posesion : {})) {
      if (!Object.hasOwn(declaradas, otra)) r.falla('prueba de posesión de ' + otra + ' sin clave declarada para él en este evento');
    }
  }

  // Las reglas de esta capa (la clave, el firmante, el foco): las mismas que aplica el eje. Un foco que no está en el
  // eje ya lo dice arriba, pendiente (puede llegar; el eje local lo rechaza: «every record hangs on a record of the
  // ledger»).
  const focoAusente = !esGenesis && ev.sobre !== null && ev.sobre !== undefined && !enLibro(libro, ev.sobre);
  deLasReglas(r, libro, ev, 3, focoAusente ? ['every record hangs on a record of the ledger'] : []);
  const textoFirma = firma === 'verificada' ? 'firma verificada de ' + ev.autor
    : firma === 'sin firma' ? 'sin firma (' + ev.autor + ' no tiene clave)'
      : firma === 'sin verificar' ? 'firma sin verificar (' + ev.autor + ' no tiene clave)'
        : 'firma ' + firma;
  const resumen = [
    idCorrecto ? 'id correcto' : 'id incorrecto',
    textoFirma,
    esGenesis ? 'génesis' : 'foco ' + (enLibro(libro, ev.sobre) ? 'en el eje' : 'ausente'),
  ].join(' · ');
  return parte(3, r.estado, r.textos, resumen, { idCorrecto, firma, firmante: ev.firmante ?? null, clavesDeclaradas, enEje, demostracion });
}

// ---------- 4 · acreditación material (el respaldo en el libro) ----------

/** Si `m` (una transferencia con salida desde otro titular) es `ev.autor` aceptando una invitación de `m.de` que lo nombra. */
function aceptaSuInvitacion(eje, ev, m, conAlta) {
  if (conAlta || m.a !== ev.autor || m.salida !== ev.autor || typeof ev.sobre !== 'string') return false;
  const inv = eje.obtener(ev.sobre);
  const p = inv?.payload;
  return Boolean(inv) && inv.autor === m.de && Array.isArray(p) && [p[0]].flat().includes('invitation') && [p[3]?.[1]].flat().includes(ev.autor);
}

function capaAcreditacion(eje, ev, libro) {
  const r = motivos();
  const esGenesis = ev.contexto?.genesis === true;
  const vista = new Map();
  const ver = (id, k) => (vista.has(llave(id, k)) ? vista.get(llave(id, k)) : saldoEn(libro, id, k));
  const poner = (id, k, v) => vista.set(llave(id, k), v);
  const emitido = new Map();
  const serie = (k) => emitido.get(k) ?? (libro.eje.serie(k).emisor !== null ? libro.eje.serie(k) : undefined);
  const vistaB = new Map();
  const verB = (id, k, salida) => (vistaB.has(JSON.stringify([id, k, salida])) ? vistaB.get(JSON.stringify([id, k, salida])) : bloqueadoEn(libro, id, k, salida));
  const ponerB = (id, k, salida, v) => vistaB.set(JSON.stringify([id, k, salida]), v);
  // El respaldo según el ciclo (src/ciclo.js): el T del día, un registro existente en P, la caducidad de la serie en E.
  // Lo que es del evento entero (el t, anterior al de su foco o al alta de su autor) falla aquí mismo.
  const delCiclo = new Map();
  // B1: la asignación es de las personas: de quien escribió su alta, o de quien la escribe ahora (aún sin cuenta).
  const personaAutor = libro.eje.esPersona(ev.autor);
  const conAsignacion = libro.reglas !== 2 && !esGenesis && (personaAutor === true || (personaAutor === null && typeof ev.autor === 'string' && ev.autor.length > 0));
  const conAlta = libro.eje.alta(ev.autor) !== null;
  const quedaA = new Map(); // escala → lo que queda de la asignación del autor, durante el evento
  const verA = (e) => {
    if (!quedaA.has(e)) { const a = asignacionT(ev.t, e); quedaA.set(e, Math.max(0, a.cantidad - (conAlta ? libro.eje.gastadoT(ev.autor, e, a.periodo) : 0))); }
    return quedaA.get(e);
  };
  for (const e of condicionesDe(libro, ev)) {
    if (e.capa !== 4) continue;
    if (e.i === null) r[e.pendiente ? 'pendiente' : 'falla'](e.texto);
    else if (!delCiclo.has(e.i)) delCiclo.set(e.i, e.texto);
  }
  const movimientos = [];
  const movs = lista(ev.movimientos);
  // Un evento no cambia: lo que no se puede comprobar ahora no se podrá nunca, así que falla (no pendiente).
  // El génesis no mueve nada (encargo 3b: es la época 0 en el eje); cualquier otro evento mueve T.
  if (!movs.length && !(esGenesis && libro.reglas !== 2)) r.falla('sin movimientos: no hay respaldo que comprobar (todo evento mueve T; capa 1)');
  movs.forEach((m, i) => {
    const fila = { i, clave: null, de: m?.de ?? null, a: m?.a ?? null, cantidad: m?.cantidad, estado: 'ok' };
    movimientos.push(fila);
    const mal = (estado, texto) => { fila.estado = estado; fila.motivo = texto; r[estado]('movimiento ' + i + ': ' + texto); };
    if (validarMovimiento(m).length) return mal('falla', 'mal formado (capa 1): su respaldo no se puede comprobar');
    const k = claveToken(m);
    fila.clave = k;
    if (m.de === null) {
      // Emisión (VG, 7-11 noche). La respalda la persona que la emite: T, con
      // su asignación diaria (fuera del génesis no se emite); P, sobre un registro que existe; E y R, a su nombre
      // (no hay grupos que emitan: VG, 8-11).
      if (!esGenesis && delCiclo.has(i)) return mal('falla', delCiclo.get(i));
      const s = serie(k);
      const emisor = esEoR(m) ? m.emisor : ev.autor;
      if (emisor !== ev.autor) {
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
      // Liberar: sale de lo bloqueado con esa misma salida. El colateral de R no baja de su mínimo (R6).
      if (delCiclo.has(i)) return mal('falla', delCiclo.get(i));
      if (verB(m.de, k, m.salida) < m.cantidad) return mal('falla', 'bloqueado de ' + k + ' en ' + m.de + ' con la salida «' + m.salida + '»: hay ' + verB(m.de, k, m.salida) + ', libera ' + m.cantidad);
      ponerB(m.de, k, m.salida, verB(m.de, k, m.salida) - m.cantidad);
      poner(m.de, k, ver(m.de, k) + m.cantidad);
      return undefined;
    } else if (m.salida !== undefined) {
      // Transferir con salida (encargo 3b: delegar, recoger lo que guarda una invitación): sale de lo bloqueado con
      // esa salida y llega bloqueado con ella, o libre si la salida nombra a quien lo recibe. Desde otro titular, solo
      // aceptando la propia invitación (el suelo de «nobody moves tokens of others»): quien escribe no tiene alta,
      // ancla sobre una invitación de `de` que lo nombra en su 3.1 y lo recoge para sí, con la salida = él.
      if (m.de !== ev.autor && !aceptaSuInvitacion(libro.eje, ev, m, conAlta)) return mal('falla', 'nadie mueve lo ajeno: ' + ev.autor + ' saca lo bloqueado de ' + m.de + ' sin aceptar una invitación suya que lo nombre');
      if (verB(m.de, k, m.salida) < m.cantidad) return mal('falla', 'bloqueado de ' + k + ' en ' + m.de + ' con la salida «' + m.salida + '»: hay ' + verB(m.de, k, m.salida) + ', transfiere ' + m.cantidad);
      ponerB(m.de, k, m.salida, verB(m.de, k, m.salida) - m.cantidad);
      if (m.a !== m.salida) {
        ponerB(m.a, k, m.salida, verB(m.a, k, m.salida) + m.cantidad);
        return undefined;
      }
    } else if (m.token === 'P') {
      // P posicionado (mapa §15): lo respalda el P de quien lo mueve en ese mismo registro.
      if (!enLibro(libro, m.ambito)) return mal('falla', 'P sobre un registro que no existe: ' + corto(m.ambito));
      const plan = planP(eje, ver, m.de, m);
      if (!plan) return mal('falla', 'P insuficiente en ' + m.de + ' sobre ' + corto(m.ambito) + ' para mover ' + m.cantidad);
      for (const [kp, d] of plan) poner(m.de, kp, ver(m.de, kp) + d);
    } else if (libro.reglas !== 2 && esInformativoT(m)) {
      // T informativo (VG, 8-11): ilimitado, «si lo gastas te vuelve a salir uno»; queda registrado como tal.
      return undefined;
    } else if (conAsignacion && gastaAsignacion(m, ev.autor, true)) {
      // T como asignación diaria (VG, 8-11): lo que queda del día y, si no alcanza, el T explícito; si tampoco,
      // «T del día agotado» (src/ciclo.js lo dice por índice).
      if (delCiclo.has(i)) return mal('falla', delCiclo.get(i));
      const { asignacion, explicito } = repartirGastoT(verA(m.escala), m.cantidad);
      if (ver(m.de, k) < explicito) return mal('falla', 'T del día agotado (' + m.escala + '): quedan ' + (verA(m.escala) + ver(m.de, k)));
      quedaA.set(m.escala, verA(m.escala) - asignacion);
      poner(m.de, k, ver(m.de, k) - explicito);
    } else {
      const s = serie(k);
      // T no se emite (VG, 8-11: no hay T acumulable): el T de una cosa lo respalda la asignación de su persona; basta el saldo.
      if (m.token !== 'T' && (!s || !(s.emitido > 0))) return mal('falla', 'la serie ' + k + ' no se ha emitido: nada respalda estos tokens');
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
      if (esGenesis && libro.reglas !== 2) r.falla('movimiento ' + i + ': el génesis no mueve nada: es la época 0 (encargo 3b)');
      else if (esGenesis && m.a !== ev.autor) r.falla('movimiento ' + i + ': el génesis solo emite a su autor');
    } else if (m.de !== ev.autor && libro.reglas === 2) {
      // Nadie mueve lo de otro, ni por cuenta de un grupo (VG, 8-11: solo existe la delegación): fuera del prefijo de
      // la versión 2 lo dice la regla de la época «nobody moves tokens of others».
      r.falla('movimiento ' + i + ': ' + motivoAjenos(m.de));
    }
  });
  // Quién emite y en qué orden (VG, 7-11 noche): solo personas, T para sí mismas,
  // cada una a su nombre, escalonado T → R → P → E (src/ciclo.js).
  // MAPA §12 [D]: «Nadie emite denominación ajena; solo el emisor amplía su serie».
  for (const e of condicionesDe(libro, ev)) {
    if (e.capa === 5) r[e.pendiente ? 'pendiente' : 'falla']((e.i === null ? '' : 'movimiento ' + e.i + ': ') + e.texto);
  }
  // No hay tipo (VG, 10-11, B1): persona o cosa se lee de quién escribe el alta. Solo en el prefijo de la versión 2
  // (suelo de persistencia) el alta declaraba el tipo, y se lee con las reglas de entonces.
  if (libro.reglas !== 2 && ev.contexto?.tipos !== undefined) r.falla(SIN_TIPO);
  for (const [id, tipo] of Object.entries(libro.reglas === 2 ? ev.contexto?.tipos ?? {} : {})) {
    if (motivoTipo(id, tipo)) r.falla(motivoTipo(id, tipo));
    else if (esGenesis) {
      if (id !== ev.autor) r.falla('el génesis solo declara el tipo de su autor');
      else if (!EMITEN_V2.includes(tipo)) r.falla('el génesis lo emite una persona: su autor no puede ser ' + tipo);
    } else if (libro.eje.tipoV2(id) !== null || conCuenta(libro, id)) r.falla('no se puede cambiar el tipo de ' + id);
    else if (!lista(ev.movimientos).some((m) => m?.a === id)) r.falla('tipo declarado para ' + id + ' sin darle tokens');
  }
  return r;
}

/**
 * El ciclo visto desde este registro (encargo 3b): si lo que anuncia ya pasó, según la plantilla de cerrado que su
 * dueño nombra (motor.cerrado). Un registro que no está en el eje no tiene lectura del ciclo.
 */
function permisoDelMotor(eje, ev, id, enEje) {
  const r = motivos();
  if (!enEje) return { r, motor: null, texto: 'no está en el eje: sin lectura del ciclo' };
  const c = cerrado(eje, id);
  if (c.cerrado === false) r.pendiente('abierto: le falta lo que anuncia (' + c.plantilla + '; motor.siguiente dice qué y de quién)');
  else if (c.cerrado === null) r.pendiente('cerrado sin resolver (' + c.plantilla + '): ' + c.motivo);
  const texto = c.cerrado === true ? 'cerrado (' + c.plantilla + ')' : c.cerrado === false ? 'abierto (' + c.plantilla + ')' : 'cerrado sin resolver';
  return { r, motor: { cerrado: c.cerrado, plantilla: c.plantilla }, texto };
}

function capaPermiso(eje, ev, libro, id, enEje) {
  const delLibro = permisoDelLibro(eje, ev, libro);
  const { r: delMotor, motor, texto } = permisoDelMotor(eje, ev, id, enEje);
  const estado = peor([delLibro.estado, delMotor.estado]);
  const textoLibro = delLibro.estado === 'ok' ? (ev.contexto?.genesis === true ? 'génesis: la época 0, no mueve nada' : 'mueve lo suyo') : delLibro.textos[0];
  const resumen = textoLibro + ' · ' + texto + (motor?.cerrado === true ? ' · externa: sin confirmar' : '');
  return parte(5, estado, [...delLibro.textos, ...delMotor.textos], resumen, {
    libro: { estado: delLibro.estado, motivos: delLibro.textos },
    motor,
    regla: REGLA_DEL_CICLO,
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
    await protegida(1, () => capaForma(ev, epoca, { tLaxo: libro.reglas === 2 })),
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
    // VG, 8-11: pagado solo con T informativo, el registro es válido pero no presente (evento.esPresente).
    presente: esPresente(ev),
    resumen: capas.map((c) => c.capa + ' ' + c.nombre + ': ' + c.estado + ' · ' + c.resumen).join('\n'),
  };
}
