// Pruebas de propiedades, ronda 2: lo que llegó a main con #51/#55/#58.
// Series de tokens contra un modelo independiente (emisión por emisor, P
// obtenido y reposicionado, R entre tenedores, separadores; encargo 3b), persistencia VERSION 2, BQL
// con estados y BUSCAR por dirección o por índice, el gancho de
// autorización, épocas desde datos, encaje con epoca.ordinal y los casos
// Booking y Tasks, y BASES/CAJA/FRESCURA (main 1215dd8). Mismo PRNG con semilla fija que test/propiedades.test.js,
// pocos cientos de casos por propiedad; el fuzz largo (decenas de miles de
// casos) vive fuera del repo. Lo que pide una decisión va en
// { skip: '<id>: [X] decidir VG …' } con la reproducción exacta.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { claveToken, partirClave, raizDeAmbito } from '../src/tokens.js';
import { serializar, restaurar, VERSION } from '../src/persistencia.js';
import { direccion, indicesDe, esReferencia, ARIDAD } from '../src/btml.js';
import * as B from '../src/bql.js';
import * as E from '../src/encaje.js';
import { cargarEpoca, leerDireccion, EPOCA_0, PV } from '../src/epocas.js';
import { cerrado } from '../src/motor.js';
import { entrarPorInvitacion } from '../ejemplos/ikisai/altas.mjs';
import { escribirDesde } from '../src/escritura.js';
import * as BK from '../ejemplos/ikisai/reserva-booking.mjs';
import * as TK from '../ejemplos/ikisai/tarea-tasks.mjs';
import { ejemploComprasHermanas, escribirBasesDelEjemplo } from '../ejemplos/ikisai/compras-hermanas.mjs';
import { clavesDeMedidas } from '../src/bases.js';
import { ALCANCES } from '../src/tiempo.js';
import { pagaElCoste, conCoste } from './ayudas-coste.js';

const SEMILLA = 20261108;
const T0 = '2026-11-07T00:00:00Z';
/** El día antes de T0: la raíz y sus altas nacen aquí; a T0 cada persona tiene su asignación del día (VG, 8-11). */
const AYER = '2026-11-06T00:00:00Z';
/** La asignación diaria de T de cada persona (VG, 8-11), escrita aparte de src/tokens.js. */
const ASIGNACION = { segundo: 86400, minuto: 1440, hora: 24, dia: 1, semana: 1, ciclo: 1, anio: 1 };

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function prng(semilla) {
  const r = mulberry32(semilla);
  return { r, int: (a, b) => a + Math.floor(r() * (b - a + 1)), pick: (xs) => xs[Math.floor(r() * xs.length)], si: (p = 0.5) => r() < p };
}
const hex = (g, n = 64) => Array.from({ length: n }, () => '0123456789abcdef'[g.int(0, 15)]).join('');
const gastaT = (de, cantidad) => (cantidad === undefined ? pagaElCoste(de) : { token: 'T', escala: 'minuto', cantidad, de, a: null });
const ida = (eje) => JSON.parse(JSON.stringify(serializar(eje)));

// ---------- series de tokens contra un modelo ----------

const ESCALAS = ['segundo', 'minuto', 'hora', 'dia', 'semana', 'ciclo', 'anio'];
const IDS = ['r', 'b', 'c', 'hab', 'x:y', 'p/q', 'u|v', 'ñandú', 'z'];
const texto = (x) => typeof x === 'string' && x.length > 0;

/**
 * Modelo independiente de Eje.validar/aplicar, escrito desde las reglas de la época (datos/epocas/reglas/, leídas como
 * texto) y no desde su código, para lo que el generador ejercita. Encargo 3b: solo emiten personas (quien escribió su
 * propia alta; quien no tiene alta solo entra aceptando una invitación, que el generador no escribe); E y R a su
 * nombre; T no se emite; emitir R exige T real; emitir E exige P sobre su registro (sin registro nombrado, el alta de
 * su emisor) y R propia emitida (VG, 9-11, D2: sin colateral); nadie acuña P a mano salvo un paso de reposición (quemar
 * en un registro y acuñar en su padre la décima o en un hijo una décima más, N7; lo da también una cosa); P solo sobre un registro, que se
 * debita exacto (ya no hay P del génesis ni P que cubra lo de debajo); R se transfiere entre tenedores (se corrige la
 * #62); nadie mueve tokens ajenos; E en enteros (no hay series divisibles en el generador); | : / reservados. Y la
 * obtención (mapa §15 N1, N2): quien escribe obtiene diez P sobre su registro; quien recibe E de su emisor, diez por
 * unidad sobre el registro de la serie; quien recibe R de su emisor, diez por unidad sobre el alta del emisor (de otro
 * tenedor, nada). Encargo 3b-bis: el P guarda su origen (la serie es P:<registro>/<origen>; quien lo obtiene es su
 * origen; moverlo sin decir el origen es mover el propio; reposicionar lo conserva) y la obtención es por cantidad
 * (diez por unidad). VG, tras 3b-bis: la obtención es un TOPE ACUMULADO por regla, titular y registro: el P llega a
 * diez por unidad neta de E (de las series atadas al registro) o de R recibida directamente de su emisor, lo de antes
 * más lo de la transacción; se acuña solo la diferencia y nunca se quema por bajar el nivel. Y un tope POR SERIE: lo que
 * una regla acuña por lo recibido de una serie, de todos los orígenes, no pasa de diez por unidad acuñada de ella (la
 * misma unidad no da P dos veces aunque vuelva al emisor por un tercero). B1 (VG, 10-11): no hay
 * tipo; persona es quien escribió su propia alta, y cosa quien recibió tokens en un alta escrita por otro.
 */

/** Las reglas de obtención de la época (sus nombres son la etiqueta de lo que acuñan). */
const OBTENCIONES = ['writing a record gives ten P on it', 'getting E gives ten P on its record', 'receiving R gives ten P on the root of its issuer'];

class Modelo {
  /** El estado de partida se copia del eje (el génesis, la emisión, la invitación, la aceptación y el alta de las cosas). */
  constructor(eje) {
    this.gastado = new Map(); // persona + escala → T de su asignación gastado en T0 (VG, 8-11: todo va en T0, un solo día)
    this.padre = new Map(eje.orden.map((id) => [id, eje.obtener(id).sobre]));
    this.autorDe = new Map(eje.orden.map((id) => [id, eje.obtener(id).autor]));
    this.alta = new Map(eje.identidades().map((id) => [id, eje.alta(id).id]));
    this.existe = new Set(eje.identidades());
    this.saldos = new Map();
    this.bloqueados = new Map(); // titular + serie + salida → cantidad
    for (const [id, m] of eje.saldos) for (const [k, v] of m) this.saldos.set(id + '\u0000' + k, v);
    for (const id of eje.identidades()) for (const b of eje.bloqueos(id)) this.bloqueados.set(id + '\u0000' + b.clave + '\u0000' + b.salida, b.cantidad);
    this.emitido = new Map(); // serie de E o R → lo emitido (para la finitud)
    for (const se of eje.series()) if (se.token === 'E' || se.token === 'R') this.emitido.set(se.clave, se.emitido);
    // Lo ya obtenido, por regla (su etiqueta), titular y registro (del libro: es el estado de partida): el nivel alcanzado.
    this.obtenido = new Map();
    for (const a of eje.libro.asientos({ clase: 'obtencion' })) {
      const vez = JSON.stringify([a.etiqueta, a.a, a.serie.slice(2, a.serie.lastIndexOf('/'))]);
      this.obtenido.set(vez, (this.obtenido.get(vez) ?? 0) + a.cantidad);
    }
    // Lo recibido de su emisor, neto, por titular y serie de E o R (VG, tras 3b-bis: la base del tope de la obtención).
    this.neto = new Map();
    for (const a of eje.libro.asientos({ primitiva: 'transferir' })) this.recibe(this.neto, a.serie, a.de, a.a, a.cantidad);
    // El tope por serie: lo que cada regla ha acuñado, de todos los orígenes, por lo recibido de cada serie de E o R.
    this.obtenidoDeSerie = new Map();
    for (const a of eje.libro.asientos({ clase: 'obtencion' })) {
      for (const [s, c] of a.origen?.series ?? []) this.obtenidoDeSerie.set(a.etiqueta + '\u0000' + s, (this.obtenidoDeSerie.get(a.etiqueta + '\u0000' + s) ?? 0) + c);
    }
  }
  /** Anota en `neto` lo que pasa de `de` a `a` en una serie de E o R: del emisor a otro suma; de otro al emisor resta. */
  recibe(neto, k, de, a, c) {
    const familia = k.slice(0, 2);
    if (familia !== 'E:' && familia !== 'R:') return;
    const emisor = k.slice(2).split('/')[0];
    const llave = (id) => id + '\u0000' + k;
    if (de === emisor && a !== emisor) neto.set(llave(a), (neto.get(llave(a)) ?? 0) + c);
    else if (a === emisor && de !== emisor) neto.set(llave(de), (neto.get(llave(de)) ?? 0) - c);
  }
  /** B1: ¿es persona? Quien escribió su propia alta. */
  persona(id) {
    return this.existe.has(id) && this.autorDe.get(this.alta.get(id)) === id;
  }
  formaMov(m) {
    if (!['E', 'P', 'R', 'T'].includes(m.token) || !(Number.isFinite(m.cantidad) && m.cantidad > 0)) return false;
    if (m.token === 'T' && (!ESCALAS.includes(m.escala) || !Number.isSafeInteger(m.cantidad))) return false;
    if (m.token === 'E' && (!texto(m.denominacion) || !texto(m.emisor))) return false;
    if ((m.token === 'P' && !texto(m.ambito)) || (m.token === 'R' && !texto(m.emisor))) return false;
    if ((m.token === 'E' || m.token === 'R') && m.de === null && m.a !== m.emisor) return false;
    if (m.estado !== undefined && (m.estado !== 'bloqueo' || m.de === null || m.a !== m.de || !texto(m.salida))) return false;
    for (const c of ['de', 'a', 'emisor', 'denominacion', 'ambito', 'origen', 'escala']) if (typeof m[c] === 'string' && /[|:/]/.test(m[c])) return false;
    if ((m.de !== null && !texto(m.de)) || (m.a !== null && !texto(m.a)) || (m.de === null && m.a === null)) return false;
    return true;
  }
  clave(m) {
    return m.token === 'T' ? 'T:' + m.escala : m.token === 'E' ? 'E:' + m.emisor + '/' + m.denominacion : m.token === 'P' ? 'P:' + m.ambito + '/' + this.origen(m) : 'R:' + m.emisor;
  }
  /** El origen de un movimiento de P: el que dice o, si no, quien lo mueve o, al acuñarlo, quien lo recibe. */
  origen(m) {
    return m.origen ?? m.de ?? m.a;
  }
  /** El P que tiene sobre un registro, de todos sus orígenes (disponible y bloqueado), antes del evento. */
  tieneP(id, reg) {
    let n = 0;
    for (const [llave, v] of this.saldos) if (llave.startsWith(id + '\u0000P:' + reg + '/')) n += v;
    for (const [llave, v] of this.bloqueados) if (llave.startsWith(id + '\u0000P:' + reg + '/')) n += v;
    return n;
  }
  /** El registro de una serie de E sin registro nombrado: el alta de su emisor. */
  registroE(m) {
    return this.alta.get(m.emisor);
  }
  /** Lo que tiene de una serie (disponible y bloqueado), antes del evento. */
  tiene(id, k) {
    let n = this.saldos.get(id + '\u0000' + k) ?? 0;
    for (const [llave, v] of this.bloqueados) if (llave.startsWith(id + '\u0000' + k + '\u0000')) n += v;
    return n;
  }
  /** ¿Emitió R propia? La tiene alguien (ella u otros), disponible o bloqueada, o la acuña en el evento. */
  rEmitida(autor, ev) {
    const k = 'R:' + autor;
    if (ev.movimientos.some((m) => m.token === 'R' && m.de === null && m.emisor === autor)) return true;
    return [...this.existe].some((id) => this.tiene(id, k) > 0);
  }
  /** Las reglas de la época sobre la candidata (con el estado de antes): true si las cumple. */
  reglasOk(ev) {
    const autor = ev.autor;
    // a person joins by an invitation: quien no tiene alta no escribe aquí (el generador no escribe invitaciones).
    if (!this.existe.has(autor)) return false;
    const P = ev.movimientos.filter((m) => m.token === 'P');
    // P moves within a known scope: todo P va sobre un registro del libro (no «genesis»).
    if (P.some((m) => !this.padre.has(raizDeAmbito(m.ambito)))) return false;
    for (const m of ev.movimientos) {
      if (m.de !== null && m.de !== autor) return false; // nobody moves tokens of others
      if (m.de !== null) continue;
      // only persons mint; salvo P: reposicionarlo es un paso del P que se tiene, también de una cosa (encargo 3b).
      if (m.token !== 'P' && !this.persona(autor)) return false;
      if (m.token === 'T') return false; // nobody mints T
      if ((m.token === 'E' || m.token === 'R') && m.emisor !== autor) return false; // E/R is minted by its issuer
      if (m.token === 'E') {
        // minting E needs P on its record; minting E needs own R issued.
        const reg = this.registroE(m);
        if (!reg || !(this.tieneP(autor, reg) > 0)) return false;
        if (!this.rEmitida(autor, ev)) return false;
      }
    }
    // E en enteros (no hay series divisibles aquí).
    if (ev.movimientos.some((m) => m.token === 'E' && !Number.isInteger(m.cantidad))) return false;
    // P is repositioned one step at a time.
    const M = P.filter((m) => m.de === null);
    if (M.length) {
      const B = P.filter((m) => m.de === autor && m.a === null && m.estado === undefined);
      if (M.some((m) => m.a !== autor) || !B.length) return false;
      if (M.some((m) => m.ambito !== M[0].ambito) || B.some((m) => m.ambito !== B[0].ambito)) return false;
      // Encargo 3b-bis: reposicionar conserva el origen.
      if ([...M, ...B].some((m) => this.origen(m) !== this.origen(B[0]))) return false;
      const sM = M.reduce((s, m) => s + m.cantidad, 0);
      const sB = B.reduce((s, m) => s + m.cantidad, 0);
      const cerca = (a, b) => a - b < 1e-9 && b - a < 1e-9;
      const sube = this.padre.get(B[0].ambito) === M[0].ambito && cerca(sM, sB * 0.1);
      const baja = this.padre.get(M[0].ambito) === B[0].ambito && cerca(sM, sB * 1.1);
      if (!sube && !baja) return false;
    }
    return true;
  }
  /** null si se rechaza; si no, la función que lo aplica. */
  probar(ev) {
    if (!this.padre.has(ev.sobre) || ev.contexto?.tipos !== undefined) return null;
    if (!ev.movimientos.every((m) => this.formaMov(m))) return null;
    // VG, 7-11 noche: escribir consume T del autor, y T no cruza de persona.
    if (!ev.movimientos.some((m) => m.token === 'T' && m.de === ev.autor && m.a === null)) return null;
    // Salvo de una persona a una cosa (Core, 8-11): de una cosa, a otra cosa del mismo dueño, o si el autor escribió su
    // alta o tiene P sobre ella (B1: cosa = alta escrita por otro).
    const duenoDe = (id) => (this.existe.has(id) ? this.autorDe.get(this.alta.get(id)) : ev.autor);
    const esCosa = (id) => (this.existe.has(id) ? !this.persona(id) : id !== ev.autor);
    const pSobre = (reg) => this.tieneP(ev.autor, reg);
    const aCosa = (m) => esCosa(m.a) && (this.persona(ev.autor) || !this.existe.has(m.a) || duenoDe(m.a) === ev.autor || duenoDe(m.a) === duenoDe(ev.autor) || pSobre(this.alta.get(m.a)) > 0);
    if (ev.movimientos.some((m) => m.token === 'T' && m.de !== null && m.a !== null && m.a !== ev.autor && !aCosa(m))) return null;
    if (!this.reglasOk(ev)) return null;
    const vista = new Map(this.saldos);
    const vistaB = new Map(this.bloqueados);
    const emitido = new Map(this.emitido);
    const ver = (id, k) => vista.get(id + '\u0000' + k) ?? 0;
    const poner = (id, k, v) => vista.set(id + '\u0000' + k, v);
    // La asignación diaria (VG, 8-11): lo que una persona gasta de su T sale primero de lo que le queda del día.
    const gastadoAqui = new Map();
    const queda = (e) => ASIGNACION[e] - (this.gastado.get(ev.autor + e) ?? 0) - (gastadoAqui.get(e) ?? 0);
    const nuevos = new Set();
    for (const m of ev.movimientos) {
      const k = this.clave(m);
      if (m.de === null) {
        if (m.token !== 'P') {
          emitido.set(k, (emitido.get(k) ?? 0) + m.cantidad);
          if (!Number.isFinite(emitido.get(k))) return null; // la serie no admite tanto
        }
        poner(m.a, k, ver(m.a, k) + m.cantidad);
        nuevos.add(m.a);
        continue;
      }
      if (m.estado === 'bloqueo') {
        if (ver(m.de, k) < m.cantidad) return null;
        poner(m.de, k, ver(m.de, k) - m.cantidad);
        const llave = m.de + '\u0000' + k + '\u0000' + m.salida;
        vistaB.set(llave, (vistaB.get(llave) ?? 0) + m.cantidad);
        continue;
      }
      if (m.token === 'T' && m.a !== ev.autor && this.persona(ev.autor)) {
        // Gastar T propio (consumirlo o darlo a una cosa): primero la asignación del día, luego el T explícito.
        const usa = Math.min(Math.max(0, queda(m.escala)), m.cantidad);
        if (ver(m.de, k) < m.cantidad - usa) return null;
        gastadoAqui.set(m.escala, (gastadoAqui.get(m.escala) ?? 0) + usa);
        poner(m.de, k, ver(m.de, k) - (m.cantidad - usa));
      } else {
        if (ver(m.de, k) < m.cantidad) return null;
        poner(m.de, k, ver(m.de, k) - m.cantidad);
      }
      if (m.a !== null) { poner(m.a, k, ver(m.a, k) + m.cantidad); nuevos.add(m.a); }
    }
    // La obtención (mapa §15 N1, N2; las reglas que escriben de la época): después de los movimientos, de origen quien
    // la obtiene y por cantidad (encargo 3b-bis). Es un NIVEL (VG, tras 3b-bis: tope acumulado por regla, titular y
    // registro): diez por unidad neta de E (de las series atadas al registro) o de R recibida directamente de su emisor,
    // lo de antes más lo de esta transacción; se acuña solo lo que falte para llegar a él, y nada si ya se llegó.
    const neto = new Map(this.neto);
    for (const m of ev.movimientos) if (m.de !== null && m.a !== null && m.estado === undefined) this.recibe(neto, this.clave(m), m.de, m.a, m.cantidad);
    const niveles = new Map(); // vez → { v: el nivel que coloca la regla (el máximo si coloca varias veces), desde: las series de donde viene }
    const nivel = (regla, id, reg, v, fuente) => {
      if (!id || !reg) return;
      const vez = JSON.stringify([regla, id, reg]);
      if (!niveles.has(vez)) niveles.set(vez, { v: 0, desde: [] });
      const x = niveles.get(vez);
      x.v = Math.max(v, x.v);
      if (fuente && !x.desde.includes(fuente)) x.desde.push(fuente);
    };
    nivel(OBTENCIONES[0], ev.autor, ev.id, 10);
    for (const m of ev.movimientos) {
      if (m.de === null || m.a === null || m.estado !== undefined) continue;
      if (m.token === 'E' && m.de === m.emisor && m.a !== m.de && this.existe.has(m.a)) {
        const reg = this.registroE(m);
        let unidades = 0;
        for (const [llave, v] of neto) {
          const [id, k] = llave.split('\u0000');
          if (id === m.a && k.slice(0, 2) === 'E:' && this.alta.get(k.slice(2).split('/')[0]) === reg) unidades += v;
        }
        nivel(OBTENCIONES[1], m.a, reg + '.1', 10 * unidades, this.clave(m)); // P por mirada: sobre la mirada 1 del registro
      }
      if (m.token === 'R' && m.de === m.emisor && m.a !== m.emisor) nivel(OBTENCIONES[2], m.a, this.alta.get(m.emisor) + '.3', 10 * (neto.get(m.a + '\u0000R:' + m.emisor) ?? 0), 'R:' + m.emisor);
    }
    // El tope por serie: lo que falta para el nivel se cubre, en el orden de sus series, con el cupo de cada una (diez
    // por unidad acuñada, con lo que acuña la transacción, menos lo que la regla ya acuñó por ella, de todos los orígenes).
    const obtenidoAqui = new Map(); // vez → el nivel alcanzado
    const deSerieAqui = new Map(); // regla + serie → lo acuñado aquí por ella
    for (const [vez, { v, desde }] of niveles) {
      const ya = this.obtenido.get(vez) ?? 0;
      if (!(v > ya)) continue;
      const [regla, id, reg] = JSON.parse(vez);
      let falta = v - ya;
      if (desde.length) {
        let cubierto = 0;
        for (const s of desde) {
          const ks = regla + '\u0000' + s;
          const cupo = 10 * (emitido.get(s) ?? 0) - (this.obtenidoDeSerie.get(ks) ?? 0) - (deSerieAqui.get(ks) ?? 0);
          const parte = Math.min(falta - cubierto, Math.max(0, cupo));
          if (!(parte > 0)) continue;
          deSerieAqui.set(ks, (deSerieAqui.get(ks) ?? 0) + parte);
          cubierto += parte;
          if (cubierto >= falta) break;
        }
        falta = cubierto;
      }
      if (!(falta > 0)) continue;
      const k = 'P:' + reg + '/' + id;
      poner(id, k, ver(id, k) + falta);
      nuevos.add(id);
      obtenidoAqui.set(vez, ya + falta);
    }
    return () => {
      this.saldos = vista;
      this.bloqueados = vistaB;
      this.emitido = emitido;
      this.neto = neto;
      for (const [vez, v] of obtenidoAqui) this.obtenido.set(vez, v);
      for (const [ks, c] of deSerieAqui) this.obtenidoDeSerie.set(ks, (this.obtenidoDeSerie.get(ks) ?? 0) + c);
      this.padre.set(ev.id, ev.sobre);
      this.autorDe.set(ev.id, ev.autor);
      for (const id of nuevos) if (!this.existe.has(id)) { this.existe.add(id); this.alta.set(id, ev.id); }
      for (const [e, n] of gastadoAqui) this.gastado.set(ev.autor + e, (this.gastado.get(ev.autor + e) ?? 0) + n);
    };
  }
}

function movAleatorio(g, autor, ids, conocidos, eje) {
  const de = g.si(0.12) ? null : g.si(0.85) ? autor : g.pick(conocidos);
  const a = g.si(0.15) ? null : g.pick([...conocidos, ...IDS]);
  const cantidad = g.pick([1, 1, 2, 3, 5, 0, -1, 1.5, 1e308]);
  const tok = g.pick(['T', 'E', 'E', 'P', 'P', 'R', 'R']);
  if (tok === 'T') return { token: 'T', escala: g.pick(['minuto', 'hora', 'minuto', 'mes']), cantidad, de, a };
  if (tok === 'E') {
    const emisor = g.si(0.7) ? autor : g.pick(IDS);
    return { token: 'E', emisor, denominacion: g.pick(['EUR', 'plaza', 'a/b', 'x:1', 'n|2', '']), cantidad, de, a: de === null && g.si(0.8) ? emisor : a };
  }
  // P por mirada (encargo 3c-2a): el ámbito es un registro o una mirada suya (r.1, r.3: donde cae lo obtenido por E y por R).
  if (tok === 'P') {
    // La mitad de las veces, un ámbito donde el autor tiene P de verdad (su P está en registros enteros y en miradas).
    const suyos = eje ? eje.poderes(autor).map((x) => x.ambito) : [];
    return { token: 'P', ambito: suyos.length && g.si(0.5) ? g.pick(suyos) : g.pick([...ids, ...ids, ...ids.map((x) => x + '.1'), ...ids.map((x) => x + '.3'), 'genesis', hex(g), 'a:b']), cantidad, de, a };
  }
  const emisor = g.si(0.5) ? autor : g.pick(conocidos);
  return { token: 'R', emisor, cantidad, de: de === null ? null : g.si(0.6) ? emisor : de, a: de === null && g.si(0.8) ? emisor : a };
}

/** Un paso de reposición al azar: quemar P propio en un registro y acuñarlo en su padre o en un hijo, a veces mal. */
function reposicionAleatoria(g, eje, autor) {
  const conP = eje.poderes(autor).filter((p) => p.cantidad > 0 && eje.obtener(p.ambito));
  if (!conP.length) return [];
  const { ambito, origen, cantidad } = g.pick(conP);
  const q = Math.min(cantidad, g.pick([1, 2, 10]));
  const padre = eje.obtener(ambito).sobre;
  const hijos = eje.sobre(ambito);
  const arriba = padre && g.si(0.5);
  const destino = arriba ? padre : hijos.length ? g.pick(hijos).id : padre;
  if (!destino) return [];
  const factor = destino === padre ? 0.1 : 1.1;
  // Conserva el origen (encargo 3b-bis); a veces lo cambia, y entonces no es un paso.
  return [{ token: 'P', ambito, origen, cantidad: q, de: autor, a: null }, { token: 'P', ambito: destino, origen: g.si(0.9) ? origen : autor, cantidad: g.si(0.85) ? q * factor : q, de: null, a: autor }];
}

const fam = (k) => (k.startsWith('P:') ? 'P' : k);
const fotoEje = (e) => JSON.stringify({ o: e.orden, s: [...e.saldos].map(([k, v]) => [k, [...v]]), se: e.series(), t: e.identidades().map((i) => [i, e.esPersona(i)]), p: e.identidades().map((i) => e.poderes(i)) });

/**
 * El eje acepta exactamente lo que acepta el modelo y deja los mismos saldos; conservación por serie (P por familia),
 * con lo acuñado del libro (la emisión, la asignación de T y la obtención de P); claves de serie reversibles
 * (partirClave ∘ claveToken); solo personas emiten (P no se emite: se obtiene); quien escribe un registro tiene diez P
 * sobre él (N1); y la VERSION restaura series, personas y poderes tal cual.
 */
test('propiedad: series de tokens contra un modelo — emisión por emisor, P obtenido y reposicionado, R entre tenedores, separadores, VERSION', async () => {
  const vistos = { mueveP: 0, reposiciona: 0, emiteOtro: 0, rechazoSeparador: 0, rEntreTenedores: 0 };
  for (let s = 0; s < 14; s++) {
    const g = prng(SEMILLA + s);
    // VG, 7-11 noche: emite una persona: el autor del génesis, la primera identidad del eje (B1). El génesis no mueve
    // nada (encargo 3b): lo que emite r va en una transacción suya. Y no emite T (VG, 8-11).
    const eje = await Eje.genesis({ demostracion: true, identidad: 'r', emision: [{ token: 'R', emisor: 'r', cantidad: 6 }, { token: 'E', emisor: 'r', denominacion: 'EUR', cantidad: 40 }], foco: 'g', t: AYER });
    // B1: b, una persona, entra aceptando la invitación de r (encargo 3b); c y hab son cosas: las da de alta r.
    await entrarPorInvitacion(eje, { por: 'r', quien: 'b', t: AYER });
    const ids = [...eje.orden];
    const alta = { autor: 'r', sobre: eje.genesisId, t: AYER, movimientos: [gastaT('r'), ...['b', 'c', 'hab'].map((a) => ({ token: 'E', emisor: 'r', denominacion: 'EUR', cantidad: 1, de: 'r', a })), { token: 'P', ambito: eje.genesisId, cantidad: 2, de: 'r', a: 'b' }, { token: 'P', ambito: eje.genesisId, cantidad: 1, de: 'r', a: 'hab' }, { token: 'R', emisor: 'r', cantidad: 2, de: 'r', a: 'c' }, { token: 'R', emisor: 'r', cantidad: 1, de: 'r', a: 'r', estado: 'bloqueo', salida: 'R:r' }, { token: 'E', emisor: 'r', denominacion: 'EUR', cantidad: 5, de: 'r', a: 'hab' }], payload: 'alta' };
    const ev0 = await eje.escribir(alta);
    ids.push(ev0.id);
    // Revisión de seguridad (encargo 3b): escribir sobre el alta de otra persona tiene el precio de su atención; los
    // registros al azar cuelgan de los demás (el modelo no cobra atención).
    const altasDePersonas = new Set([eje.genesisId, eje.alta('b').id]);
    const sobres = ids.filter((id) => !altasDePersonas.has(id));
    const mod = new Modelo(eje);
    for (let paso = 0; paso < 30; paso++) {
      const conocidos = [...mod.existe];
      const autor = g.si(0.9) ? g.pick(conocidos) : g.pick(IDS);
      const movimientos = [gastaT(autor)];
      for (let i = 0; i < g.int(0, 3); i++) movimientos.push(movAleatorio(g, autor, ids, conocidos, eje));
      // Con el escalonado, una emisión al azar casi nunca cumple: a veces se añade la más simple (T + R propia).
      if (g.si(0.2)) movimientos.push({ token: 'R', emisor: autor, cantidad: 1, de: null, a: autor });
      // Y a veces, un paso de reposición de P (bien o mal hecho).
      if (g.si(0.2)) movimientos.push(...reposicionAleatoria(g, eje, autor));
      // Y a veces, pasar R ajena que tiene a otro tenedor (VG, 9-11, mapa §15 [D] «R según el corpus»).
      const ajenas = [...(eje.saldos.get(autor) ?? [])].filter(([k, v]) => k.startsWith('R:') && k !== 'R:' + autor && v > 0);
      if (ajenas.length && g.si(0.3)) movimientos.push({ token: 'R', emisor: g.pick(ajenas)[0].slice(2), cantidad: 1, de: autor, a: g.pick(conocidos) });
      // B1: no hay tipo; a veces un alta lo declara igual (y se rechaza), y a veces se da de alta a una cosa nueva.
      const contexto = g.si(0.05) ? { tipos: { [g.pick(IDS)]: g.pick(['persona', 'grupo', 'cosa', 'robot']) } } : {};
      if (g.si(0.3)) {
        const nuevo = g.pick(IDS);
        // T no cruza de persona (VG, 7-11 noche): el alta da al nuevo un euro de la serie de r.
        if (g.si(0.8)) movimientos.push({ token: 'E', emisor: 'r', denominacion: 'EUR', cantidad: 1, de: autor, a: nuevo });
      }
      // La quema del coste, calculada ya para que el modelo vea lo mismo que el eje (VG 12-11, #64 b).
      const datos = conCoste(eje, { autor, sobre: g.si(0.95) ? g.pick(sobres) : hex(g), t: T0, movimientos, payload: ['p', paso], contexto });
      const antes = fotoEje(eje);
      let ev = null;
      try { ev = await eje.escribir(datos); } catch (e) {
        assert.equal(e.constructor, Error, e.message);
        assert.match(e.message, /evento (rechazado|mal formado)/);
        assert.equal(fotoEje(eje), antes, 'un rechazo no cambia nada');
        if (/no puede llevar \| : ni \//.test(e.message)) vistos.rechazoSeparador++;
      }
      const aplicar = mod.probar({ ...datos, id: ev?.id ?? 'candidata' });
      assert.equal(Boolean(ev), Boolean(aplicar), 'el eje y el modelo discrepan en ' + JSON.stringify(datos));
      if (!ev) continue;
      aplicar();
      ids.push(ev.id);
      sobres.push(ev.id);
      for (const m of ev.movimientos) {
        if (m.token === 'P' && m.de !== null && m.a !== null) vistos.mueveP++;
        if (m.token === 'P' && m.de === null) vistos.reposiciona++;
        if (m.de === null && ev.autor !== 'r') vistos.emiteOtro++;
        if (m.token === 'R' && m.de !== null && m.de !== m.emisor && m.a !== null && m.a !== m.emisor && m.estado === undefined) vistos.rEntreTenedores++;
      }
      for (const [idk, v] of mod.saldos) {
        const [id, k] = idk.split('\u0000');
        assert.ok(Math.abs(eje.saldo(id, k) - v) < 1e-9, id + ' ' + k + ': eje ' + eje.saldo(id, k) + ', modelo ' + v + ' tras ' + JSON.stringify(datos));
      }
      // Conservación, con lo acuñado y lo quemado del libro, de todas las clases.
      const total = new Map();
      for (const [, m] of eje.saldos) for (const [k, v] of m) total.set(fam(k), (total.get(fam(k)) ?? 0) + v);
      for (const id of eje.identidades()) for (const b of eje.bloqueos(id)) total.set(fam(b.clave), (total.get(fam(b.clave)) ?? 0) + b.cantidad);
      const acunado = new Map();
      for (const [k, v] of Object.entries(eje.libro.sumas({ primitiva: 'acunar' }))) acunado.set(fam(k), (acunado.get(fam(k)) ?? 0) + v);
      const quemado = new Map();
      for (const [k, v] of Object.entries(eje.libro.sumas({ primitiva: 'quemar' }))) quemado.set(fam(k), (quemado.get(fam(k)) ?? 0) + v);
      for (const [k, e] of acunado) assert.ok(Math.abs((total.get(k) ?? 0) + (quemado.get(k) ?? 0) - e) < 1e-6, 'conservación de ' + k);
      for (const se of eje.series()) {
        assert.equal(claveToken(partirClave(se.clave)), se.clave);
        if (se.token === 'E' || se.token === 'R') assert.equal(se.emisor, partirClave(se.clave).emisor);
        // Solo emiten personas, a su nombre (VG, 8-11): quien escribió su propia alta (B1). P no se emite: se obtiene.
        if (se.token !== 'P') assert.ok(eje.esPersona(se.emisor) === true, se.clave + ' la emite ' + se.emisor);
      }
      // N1: escribir un registro propio da diez P sobre él.
      assert.ok(eje.poderSobre(ev.autor, ev.id) >= 10, 'quien escribe obtiene P sobre su registro');
    }
    const datos = ida(eje);
    const copia = JSON.stringify(datos);
    const otro = await restaurar(datos);
    assert.equal(datos.version, VERSION);
    assert.equal(JSON.stringify(datos), copia, 'restaurar no cambia lo que lee');
    assert.equal(fotoEje(otro), fotoEje(eje));
  }
  assert.ok(Object.values(vistos).every((n) => n > 0), JSON.stringify(vistos));
});

test('regresión (encargo 3b): pasarse a uno mismo R ajena no da P sobre el alta de su emisor', async () => {
  // La regla «receiving R gives ten P…» pedía solo que quien recibe no fuera el emisor: un tenedor que se pasaba a sí
  // mismo R ajena obtenía diez P sobre el alta del emisor en cada registro, sin que nadie le cediera atención. Ahora
  // solo da P la R que llega de su emisor (revisión de seguridad; por unidad desde el encargo 3b-bis).
  const eje = await Eje.genesis({ demostracion: true, identidad: 'r', emision: [{ token: 'R', emisor: 'r', cantidad: 2 }], foco: 'g', t: AYER });
  await entrarPorInvitacion(eje, { por: 'r', quien: 'b', t: AYER });
  const raiz = 'P:' + eje.alta('r').id + '/b';
  const antes = eje.saldo('b', raiz);
  // Bajo el alta propia de b (escribir sobre el alta de r tendría el precio de su atención: revisión de seguridad).
  await eje.escribir({ autor: 'b', sobre: eje.alta('b').id, t: T0, movimientos: [gastaT('b'), { token: 'R', emisor: 'r', cantidad: 1, de: 'b', a: 'b' }], payload: 'yo a mí' });
  assert.equal(eje.saldo('b', raiz), antes);
});

test('regresión: VERSION 2 — un eje de otra versión se rechaza diciendo cuál, y nada a medias se restaura', async () => {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'r', emision: [], foco: 'g', t: T0 });
  const d = ida(eje);
  // Desde el ciclo E/P/R/T (VG, 7-11 noche) la versión es la 3; la 2 se migra (test/persistencia.test.js).
  await assert.rejects(restaurar({ ...d, version: 1 }), /versión 1; esta es la 3/);
  await assert.rejects(restaurar({ ...d, version: 4 }), /versión 4; esta es la 3/);
  for (const malo of [{ ...d, version: '2' }, { ...d, eventos: [] }, { version: 2 }, null]) await assert.rejects(restaurar(malo), /datos de eje inválidos/);
});

test('cantidades no enteras de E y P: 0,3 − 0,1 no alcanza para 0,2',
  { skip: 'TOK-03: [X] decidir VG con qué aritmética van las fracciones de E (solo en las series declaradas divisibles, R2, VG 7-11 noche) y de P. Hoy, con 0,3 EUR divisibles, pagar 0,1 deja 0,19999999999999998 y pagar luego 0,2 se rechaza por «saldo insuficiente de E:r/EUR»; igual con P (fuzz 2, sonda-float)' },
  async () => {
    const eje = await Eje.genesis({ demostracion: true, identidad: 'r', emision: [{ token: 'E', emisor: 'r', denominacion: 'EUR', cantidad: 0.3, divisible: true }], foco: 'g', t: T0 });
    const pago = (c) => ({ token: 'E', emisor: 'r', denominacion: 'EUR', cantidad: c, de: 'r', a: null });
    await eje.escribir({ autor: 'r', sobre: eje.genesisId, t: T0, movimientos: [gastaT('r'), pago(0.1)], payload: 'a' });
    await eje.escribir({ autor: 'r', sobre: eje.genesisId, t: T0, movimientos: [gastaT('r'), pago(0.2)], payload: 'b' });
    assert.equal(eje.saldo('r', 'E:r/EUR'), 0);
  });

// ---------- BQL: estados, BUSCAR por dirección y por índice, autorización ----------

const dirAl = (g) => direccion(Array.from({ length: g.int(0, 4) }, () => g.int(0, g.si(0.8) ? 3 : 9)));
const idx = (g) => Array.from({ length: g.int(1, 3) }, () => g.int(0, g.si(0.8) ? 3 : 9)).join(', ');

function formula(g, ids, prof = 0) {
  const hoja = () => g.pick([
    () => String(g.int(0, 20)),
    () => g.int(1, 9) + ' ' + g.pick(['EUR', 'min', 'h']),
    () => '"' + g.pick(['a', 'escrito', '1000000000']) + '"',
    () => 'LOCAL(' + idx(g) + ')',
    () => 'REF("' + g.pick(ids).slice(0, g.pick([8, 64])) + '"' + (g.si() ? ', "' + dirAl(g) + '"' : '') + ')',
    () => 'CONTAR(BUSCAR("' + dirAl(g) + '"))',
    () => 'CONTAR(BUSCAR(' + idx(g) + '))',
  ])();
  if (prof > 3 || g.r() < 0.3) return hoja();
  const sub = () => formula(g, ids, prof + 1);
  const busca = () => g.pick(['BUSCAR(' + idx(g) + ')', 'BUSCAR("' + dirAl(g) + '")', 'BUSCAR(LOCAL(' + idx(g) + '))']);
  const dentro = () => g.pick(['ORIGEN() = "escrito"', 'ACUERDO() >= ' + g.int(0, 10), 'SIGNO() = "exacto"', 'ACTUAL(' + g.int(0, 3) + ') = ' + g.int(0, 3), sub()]);
  const col = () => g.pick([
    busca,
    () => 'FILTRAR(' + busca() + ', ' + dentro() + ')',
    () => 'ORDENAR(' + busca() + ', ' + g.pick(['ACUERDO()', 'ORIGEN()', sub()]) + ')',
    () => 'ELEGIR(' + busca() + ', ' + g.int(0, 3) + ')',
    () => 'ACTUAL(' + g.int(0, 9) + ', ' + g.int(1, 3) + ')',
  ])();
  return g.pick([
    () => sub() + ' ' + g.pick(['+', '-', '*', '/']) + ' ' + sub(),
    () => sub() + ' ' + g.pick(['=', '<>', '<', '>=']) + ' ' + sub(),
    col,
    () => g.pick(['CONTAR', 'SUMAR']) + '(' + col() + ')',
    () => g.pick(['Y', 'O']) + '(' + sub() + ', ' + sub() + ')',
    () => g.pick(['FOO()', '1 +', 'BUSCAR("12")', 'BUSCAR("1000000000", 1)', 'BUSCAR(10)', 'ORIGEN()']),
  ])();
}

function payloadAl(g, ids, prof = 0) {
  if (prof >= 3 || g.r() < 0.35) {
    const k = g.r();
    if (k < 0.25) return g.pick([0, 1, 2, 3, 12]);
    if (k < 0.4) return g.pick(['5 EUR', '3 EUR', '2 min', 'x', '==t', '1000000000', '2000000000']);
    if (k < 0.6 && ids.length) return g.si(0.3) ? { ref: g.pick(ids) } : { ref: g.pick(ids), dir: dirAl(g) };
    // C1 (VG, 10-11): una referencia a un evento ausente no entra en el eje; la lectura de una rota la prueban los
    // ejes falsos (propiedades.test.js, «referencias cíclicas y cadenas largas»).
    if (k < 0.65) { hex(g); return ids.length ? { ref: ids[ids.length - 1] } : 'y'; } // el mismo azar de antes
    if (k < 0.9 && ids.length) return '=' + formula(g, ids);
    return 'y';
  }
  return Array.from({ length: g.int(1, g.si(0.1) ? 10 : 4) }, () => payloadAl(g, ids, prof + 1));
}

async function ejeAl(g) {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'r', emision: [], foco: payloadAl(g, []), t: T0 });
  const ids = [eje.genesisId];
  for (let i = 0; i < g.int(2, 6); i++) {
    const ev = await eje.escribir({ autor: 'r', sobre: g.pick(ids), en: g.si(0.7) ? dirAl(g) : '0000000000', t: T0, movimientos: [gastaT('r')], payload: payloadAl(g, ids), contexto: { i } });
    ids.push(ev.id);
  }
  return { eje, ids };
}

function huecos(p, camino = [], out = []) {
  if (camino.length > ARIDAD) return out;
  out.push(camino);
  if (Array.isArray(p)) p.forEach((h, i) => huecos(h, [...camino, i], out));
  return out;
}

const ESTADOS = [...B.ESTADOS, ...B.SUBTIPOS_PENDIENTE];
const llave = (it) => JSON.stringify([it.origen, it.evento, it.indices]);
const itemsDe = (r) => (r.estado === 'RESUELTO' && r.valor.tipo === 'coleccion' ? r.valor.items.map(llave) : null);
const SIN_TOPE = { limites: { candidatos: 1e9 } };

/**
 * Mapa §12 [D] «BUSCAR por dirección y por índice»: «un número es índice
 * (camino exacto, relativo al anfitrión); un texto de diez dígitos es
 * dirección (absoluta en el registro, nombra la colisión entera)».
 */
test('propiedad: BUSCAR por dirección es absoluta y da la colisión entera; por índice, relativo al anfitrión, exacto y dentro de la dirección', async () => {
  let comparados = 0;
  for (let s = 0; s < 14; s++) {
    const g = prng(SEMILLA + 100 + s);
    const { eje, ids } = await ejeAl(g);
    for (const id of ids) {
      const hs = huecos(eje.obtener(id).payload);
      for (let k = 0; k < 4; k++) {
        const d = dirAl(g);
        const h1 = g.pick(hs);
        const h2 = Array.from({ length: g.int(1, 5) }, () => g.int(0, 9));
        const r1 = B.consultar(eje, id, h1.length ? h1 : [0], 'BUSCAR("' + d + '")', SIN_TOPE);
        const r2 = B.consultar(eje, id, h2, 'BUSCAR("' + d + '")', SIN_TOPE);
        assert.equal(r1.estado, r2.estado);
        assert.deepEqual(itemsDe(r1), itemsDe(r2), 'la dirección no depende del anfitrión');
        if (r1.estado === 'RESUELTO') assert.equal(r1.valor.items.length, E.ocupantes(eje, id, indicesDe(d)).length, 'la colisión entera');
        const h = Array.from({ length: g.int(0, 3) }, () => g.int(0, 3));
        // VG, 7-11 noche: por hojas. Con dos o más números, el último de BUSCAR es el índice en la lista de la
        // posición (por llegada: cada elemento de una lista propia y cada escrito) y los demás, el camino; con uno
        // solo, el camino.
        const conK = g.si(0.5);
        const i = Array.from({ length: g.int(1, 3) }, () => g.int(0, 3));
        const k = conK ? [g.int(0, 3)] : [];
        const ra = B.consultar(eje, id, [...h, g.int(0, 9)], 'BUSCAR(' + [...i, ...k].join(', ') + ')', SIN_TOPE);
        // Desde la raíz, el mismo camino; sin índice en la lista solo es lo mismo si el anfitrión no añade nada.
        if (conK || h.length === 0) {
          const rb = B.consultar(eje, id, [g.int(0, 9)], 'BUSCAR(' + [...h, ...i, ...k].join(', ') + ')', SIN_TOPE);
          assert.deepEqual(itemsDe(ra), itemsDe(rb), 'el índice es relativo al anfitrión');
        }
        const camino = [...h, ...i];
        const rd = B.consultar(eje, id, [0], 'BUSCAR("' + direccion(camino) + '")', SIN_TOPE);
        if (ra.estado === 'RESUELTO' && rd.estado === 'RESUELTO') {
          const todos = new Set(itemsDe(rd));
          for (const it of itemsDe(ra)) assert.ok(todos.has(it), 'el índice no da nada que la dirección no tenga');
          for (const it of ra.valor.items.filter((x) => x.origen === 'propio')) assert.deepEqual(it.indices, camino, 'índice = camino exacto');
          if (conK) assert.ok(ra.valor.items.filter((x) => x.origen !== 'referencia').length <= 1, 'el índice en la lista da un ocupante');
          comparados++;
        }
      }
    }
  }
  assert.ok(comparados > 100, String(comparados));
});

/**
 * Estados (corpus 03 l.46): siempre uno de los cuatro o un subtipo de
 * PENDIENTE; el gancho que todo lo permite no cambia nada; si el gancho
 * niega una lectura que la evaluación hace, el resultado es PENDIENTE DE
 * AUTORIZACIÓN (ninguna parada se captura dentro: la primera lectura negada
 * manda). Determinista y sin escribir.
 */
test('propiedad: BQL — estados, gancho de autorización (todo permitido = sin gancho; una lectura negada = PENDIENTE DE AUTORIZACIÓN), determinista', async () => {
  const vistos = new Set();
  let negadas = 0;
  for (let s = 0; s < 12; s++) {
    const g = prng(SEMILLA + 200 + s);
    const { eje, ids } = await ejeAl(g);
    const antes = JSON.stringify(ida(eje));
    for (const id of ids) {
      for (const camino of huecos(eje.obtener(id).payload)) {
        const lecturas = [];
        const a = B.evaluar(eje, id, camino);
        const todo = B.evaluar(eje, id, camino, { puedeLeer: (e, d, ind) => { lecturas.push(JSON.stringify([e, d, ind])); return true; } });
        assert.ok(ESTADOS.includes(a.estado), a.estado);
        assert.notEqual(a.estado, 'PENDIENTE DE AUTORIZACIÓN');
        if (a.estado !== 'RESUELTO') assert.ok(a.texto.startsWith(a.estado + ': '), a.texto);
        for (const dep of a.dependencias) assert.match(dep, /^[0-9a-f]{64}:[0-9]{10}$/);
        assert.deepEqual(todo, a);
        assert.deepEqual(B.evaluar(eje, id, camino), a, 'determinista');
        vistos.add(a.estado);
        if (lecturas.length) {
          const negada = g.pick(lecturas);
          const r = B.evaluar(eje, id, camino, { puedeLeer: (e, d, ind) => JSON.stringify([e, d, ind]) !== negada });
          assert.equal(r.estado, 'PENDIENTE DE AUTORIZACIÓN', negada + ' → ' + r.texto);
          negadas++;
        }
      }
      for (let k = 0; k < 3; k++) {
        const f = formula(g, ids);
        const c = Array.from({ length: g.int(1, 3) }, () => g.int(0, 9));
        const x = B.consultar(eje, id, c, f);
        assert.ok(ESTADOS.includes(x.estado), f);
        assert.deepEqual(B.consultar(eje, id, c, f), x);
        vistos.add(x.estado);
      }
    }
    assert.equal(JSON.stringify(ida(eje)), antes, 'BQL no escribe');
  }
  assert.deepEqual([...vistos].sort(), ['ERROR', 'INCOMPATIBLE', 'PENDIENTE', 'RESUELTO']);
  assert.ok(negadas > 100, String(negadas));
});

test('regresión: un dato que falta en FILTRAR no se vuelve «falso» (corpus 03 l.46)', async () => {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'r', emision: [], foco: ['g', 'propio'], t: T0 });
  for (const p of [['a', 5], ['b']]) await eje.escribir({ autor: 'r', sobre: eje.genesisId, en: '1000000000', t: T0, movimientos: [gastaT('r')], payload: p });
  // El segundo escrito no tiene posición 1: la condición queda PENDIENTE para él y no se descarta en silencio.
  const r = B.consultar(eje, eje.genesisId, [0], 'CONTAR(FILTRAR(FILTRAR(BUSCAR("1000000000"), ORIGEN() = "escrito"), ACTUAL(1) > 1))');
  assert.equal(r.estado, 'PENDIENTE');
  assert.equal(B.consultar(eje, eje.genesisId, [0], 'CONTAR(FILTRAR(BUSCAR("1000000000"), ORIGEN() = "escrito"))').texto, '2');
});

// ---------- BASES, CAJA y FRESCURA (leen el 8) ----------

/**
 * Sobre el eje de las compras hermanas con sus bases escritas: estados,
 * determinismo, sin escribir; CAJA(medida, alcance) = BASES(alcance,
 * medida), con gancho o sin él; el gancho que todo lo permite no cambia nada
 * salvo las dos medidas de fórmulas (docs/BQL.md §7.14: con gancho no se
 * cuentan); una lectura negada da PENDIENTE DE AUTORIZACIÓN.
 */
test('propiedad: BASES, CAJA y FRESCURA — estados, CAJA = BASES con y sin gancho, autorización', async () => {
  const ej = await ejemploComprasHermanas();
  await escribirBasesDelEjemplo(ej);
  const { eje } = ej;
  const ids = [...eje.orden];
  const antes = JSON.stringify(ida(eje));
  const g = prng(SEMILLA + 700);
  const MEDIDAS = [...clavesDeMedidas(), 'T:minuto', 'E:casa/EUR', 'P:genesis', 'R:casa', 'T:mes', 'inventada'];
  const FORMULAS = ['formulasResueltas', 'formulasPendientes'];
  const vistos = new Set();
  let negadas = 0;
  for (let k = 0; k < 300; k++) {
    const id = g.pick(ids);
    const medida = g.pick(MEDIDAS);
    const alcance = g.pick([...ALCANCES, 'otro']);
    const f = g.pick([
      'CAJA("' + medida + '")', 'CAJA("' + medida + '", "' + alcance + '")', 'FRESCURA("' + alcance + '")', 'FRESCURA()',
      'BASES("' + alcance + '", "' + medida + '")', 'BASES("' + alcance + '", "' + medida + '", ' + g.pick(['0', '9', '"media"', '"minimo"', '"foco"', '"caja"']) + ')',
    ]);
    const lecturas = [];
    const a = B.consultar(eje, id, [0], f);
    const todo = B.consultar(eje, id, [0], f, { puedeLeer: (e, d, ind) => { lecturas.push(JSON.stringify([e, d, ind])); return true; } });
    assert.ok(ESTADOS.includes(a.estado), f);
    assert.deepEqual(B.consultar(eje, id, [0], f), a, 'determinista');
    if (a.estado === 'RESUELTO') assert.ok(Number.isFinite(a.valor.valor), f + ' → ' + a.texto);
    vistos.add(a.estado);
    if (!FORMULAS.includes(medida)) assert.deepEqual(todo, a, f);
    if (lecturas.length) {
      const negada = g.pick(lecturas);
      assert.equal(B.consultar(eje, id, [0], f, { puedeLeer: (e, d, ind) => JSON.stringify([e, d, ind]) !== negada }).estado, 'PENDIENTE DE AUTORIZACIÓN', f + ' sin ' + negada);
      negadas++;
    }
    if (ALCANCES.includes(alcance) && clavesDeMedidas().includes(medida)) {
      const vetado = g.pick(ids);
      for (const opciones of [undefined, { puedeLeer: () => true }, { puedeLeer: (e) => e !== vetado }]) {
        const c = B.consultar(eje, id, [0], 'CAJA("' + medida + '", "' + alcance + '")', opciones);
        const b = B.consultar(eje, id, [0], 'BASES("' + alcance + '", "' + medida + '")', opciones);
        assert.equal(c.estado, b.estado, medida + ' ' + alcance + ': ' + c.texto + ' / ' + b.texto);
        if (c.estado === 'RESUELTO') assert.equal(c.texto, b.texto);
      }
    }
  }
  assert.equal(JSON.stringify(ida(eje)), antes, 'leer el 8 no escribe');
  assert.deepEqual([...vistos].sort(), ['ERROR', 'PENDIENTE', 'RESUELTO']);
  assert.ok(negadas > 100, String(negadas));
});

// Fuzz 2 (fuzz-caja, semilla 19000) sobre main 1215dd8: CAJA con gancho no daba las medidas de fórmulas y
// BASES sí, y su recuento dejaba ver si se resolvía una fórmula que lee lo que el gancho niega. Arreglado en src/bql.js.
test('regresión: con gancho, BASES no cuenta las fórmulas del anfitrión (como CAJA): no deja ver lo que el gancho niega', async () => {
  const ej = await ejemploComprasHermanas();
  await escribirBasesDelEjemplo(ej);
  const { eje } = ej;
  const secreto = ej.menu.id;
  const hijo = await eje.escribir({ autor: 'casa', sobre: ej.comedor.id, t: '2026-11-07T19:00:00Z', movimientos: [gastaT('casa', 3)], payload: ['=REF("' + secreto + '", "0000000000") + 1', 'x'] }, ej.claves.casa.privada);
  const gancho = { puedeLeer: (id) => id !== secreto };
  assert.equal(B.consultar(eje, hijo.id, [1], 'REF("' + secreto + '")', gancho).estado, 'PENDIENTE DE AUTORIZACIÓN');
  // R7 (VG, 7-11 noche): las fórmulas son un recuento y el 8 no los sitúa: ni con gancho ni sin él se leen, así que no
  // dejan ver nada de lo que el gancho niega.
  for (const f of ['CAJA("formulasPendientes")', 'BASES("hermanos", "formulasPendientes", "foco")', 'BASES("hermanos", "formulasResueltas")', 'BASES("proyecto", "formulasPendientes", "caja")', 'BASES("hermanos", "formulasPendientes", 0)']) {
    for (const opciones of [gancho, undefined]) assert.equal(B.consultar(eje, hijo.id, [1], f, opciones).estado, 'ERROR', f);
  }
  // Lo que solo lee la base sigue respondiendo con gancho.
  for (const f of ['BASES("hermanos", "T:minuto", 0)', 'BASES("hermanos", "T:minuto", "suma")', 'BASES("hermanos")']) {
    assert.equal(B.consultar(eje, hijo.id, [1], f, gancho).estado, 'RESUELTO', f);
  }
});

// ---------- épocas desde datos ----------

test('la época 0 de los datos es la del mapa: profundidad 0 = la cruceta; toda n ≥ 1 = el PV aplicado al nodo de arriba; ninguna ordinal', () => {
  const PREGUNTAS = ['qué es', 'cuánto', 'con qué condición', 'con quién', 'qué se hace', 'dónde encaja', 'de dónde viene', 'para cuándo', 'frente a otros', 'cómo'];
  assert.equal(EPOCA_0.reglas.length, 100);
  for (let d = 0; d < 10; d++) {
    assert.equal(EPOCA_0.reglaCorta(0, d), PV[d]);
    for (let p = 1; p < 10; p++) assert.equal(EPOCA_0.reglaCorta(p, d), PREGUNTAS[d], p + '.' + d);
  }
  for (let k = 0; k < 10; k++) assert.equal(EPOCA_0.ordinal(k), false);
});

/**
 * cargarEpoca con datos generados: carga si y solo si las cien combinaciones
 * quedan cubiertas (propia > de todas las profundidades > respaldo) y todo
 * está bien formado; si no, TypeError o Error con el nombre de la época. No
 * cambia sus datos. ordinal(k) es exactamente la lista; leerDireccion da una
 * entrada por profundidad real y la regla larga del prefijo exacto gana a la
 * corta desde la profundidad 1.
 */
test('propiedad: épocas desde datos — cobertura de las cien reglas, prioridad, ordinales y reglas largas', () => {
  const vistos = { carga: 0, rechazo: 0 };
  for (let s = 0; s < 400; s++) {
    const g = prng(SEMILLA + 300 + s);
    const conRespaldo = g.si(0.4);
    const reglas = [];
    const propias = new Map();
    const generales = new Map();
    const largas = new Map();
    let invalida = false;
    const nGen = g.pick([0, 0, 3, 10]);
    for (let d = 0; d < 10; d++) if (g.r() < nGen / 10) { reglas.push({ profundidad: 'todas', digito: d, nombre: 'g' + d }); generales.set(d, 'g' + d); }
    const densidad = g.pick([0.2, 0.95, 1]);
    for (let p = 0; p < 10; p++) for (let d = 0; d < 10; d++) if (g.si(densidad)) { reglas.push({ profundidad: p, digito: d, nombre: 'p' + p + '.' + d }); propias.set(p + '.' + d, 'p' + p + '.' + d); }
    for (let i = 0; i < g.int(0, 4); i++) {
      const ruta = Array.from({ length: g.int(2, 4) }, () => g.int(0, 3)).join('');
      if (!largas.has(ruta)) { reglas.push({ ruta, nombre: 'L' + ruta }); largas.set(ruta, 'L' + ruta); }
    }
    if (g.si(0.15)) {
      reglas.splice(g.int(0, reglas.length), 0, g.pick([{ profundidad: 1, digito: 10, nombre: 'x' }, { profundidad: 10, digito: 1, nombre: 'x' }, { profundidad: 1, digito: 1, nombre: '' }, { ruta: '1', nombre: 'x' }, { ruta: '12', profundidad: 1, nombre: 'x' }, null, { profundidad: 1, digito: '1', nombre: 'x' }]));
      invalida = true;
    }
    if (g.si(0.05) && largas.size) { reglas.push({ ruta: [...largas.keys()][0], nombre: 'otra' }); invalida = true; }
    const ordinales = g.si(0.5) ? [] : Array.from({ length: g.int(1, 3) }, () => g.int(0, 9));
    const datos = { nombre: 'época ' + hex(g, 4), reglas, ordinales };
    const copia = JSON.stringify(datos);
    let faltan = 0;
    for (let p = 0; p < 10; p++) for (let d = 0; d < 10; d++) if (!propias.has(p + '.' + d) && !generales.has(d) && !conRespaldo) faltan++;
    let ep;
    try {
      ep = cargarEpoca(datos, conRespaldo ? { respaldo: EPOCA_0 } : {});
    } catch (e) {
      assert.ok(e instanceof TypeError || e.constructor === Error, e.message);
      assert.ok(invalida || faltan > 0, 'rechaza datos completos y válidos: ' + e.message);
      vistos.rechazo++;
      continue;
    }
    vistos.carga++;
    assert.equal(JSON.stringify(datos), copia, 'cargarEpoca no cambia sus datos');
    assert.ok(!invalida && faltan === 0, 'carga datos que debía rechazar');
    for (let p = 0; p < 10; p++) for (let d = 0; d < 10; d++) {
      assert.equal(ep.reglaCorta(p, d), propias.get(p + '.' + d) ?? generales.get(d) ?? EPOCA_0.reglaCorta(p, d), p + '.' + d);
    }
    for (let k = 0; k < 10; k++) assert.equal(ep.ordinal(k), ordinales.includes(k));
    for (let i = 0; i < 10; i++) {
      const dir = direccion(Array.from({ length: g.int(0, 6) }, () => g.int(0, g.si(0.7) ? 3 : 9)));
      const reales = indicesDe(dir);
      const lect = leerDireccion(dir, ep);
      assert.equal(lect.length, reales.length);
      lect.forEach((x, p) => {
        const larga = p > 0 ? largas.get(reales.slice(0, p + 1).join('')) : undefined;
        assert.equal(x.significado, larga ?? ep.reglaCorta(p, reales[p]), dir + ' en ' + p);
      });
    }
  }
  assert.ok(vistos.carga > 50 && vistos.rechazo > 50, JSON.stringify(vistos));
});

/**
 * Mapa §12 [D] «Signo del vector: opción B»: ni signo ni distancia ordenan
 * «hasta que una época haga ordinal una profundidad (entonces solo ahí)».
 * ordenarPorEncaje con listas de vectores generadas y épocas con
 * profundidades ordinales: primero el acuerdo de prefijo, luego la distancia
 * solo en las profundidades ordinales (de menor a mayor profundidad), luego
 * la llegada; el signo nunca; nada se borra; empates = lo que el encaje no
 * separa. La época 0 (ninguna ordinal) ordena como sin época.
 */
test('propiedad: ordenarPorEncaje con epoca.ordinal — acuerdo, distancia solo en las ordinales, llegada; el signo no ordena', () => {
  const g = prng(SEMILLA + 400);
  let reordena = 0;
  for (let s = 0; s < 300; s++) {
    const lista = Array.from({ length: g.int(1, 8) }, (_, i) => {
      const a = g.int(0, 4);
      const vector = Array.from({ length: ARIDAD }, (_, k) => (k < a ? 0 : k === a ? g.pick([-3, -1, 1, 2, 3]) : g.int(-3, 3)));
      return { llegada: i, vector, acuerdo: E.acuerdo(vector) };
    });
    const ords = Array.from({ length: g.int(0, 4) }, () => g.int(0, 6));
    const epoca = cargarEpoca({ nombre: 'época de prueba', reglas: [], ordinales: ords }, { respaldo: EPOCA_0 });
    const ordinales = [...new Set(ords)].sort((a, b) => a - b);
    const cmp = (a, b) => (b.acuerdo - a.acuerdo) || ordinales.reduce((r, q) => r || (Math.abs(a.vector[q]) - Math.abs(b.vector[q])), 0) || (a.llegada - b.llegada);
    const esperado = [...lista].sort(cmp);
    const enc = E.ordenarPorEncaje(lista, { epoca });
    assert.deepEqual(enc, esperado);
    // El signo no ordena: con los signos cambiados, el mismo orden de llegada.
    const espejo = lista.map((o) => ({ ...o, vector: o.vector.map((x) => -x) }));
    assert.deepEqual(E.ordenarPorEncaje(espejo, { epoca }).map((o) => o.llegada), enc.map((o) => o.llegada));
    assert.deepEqual(E.ordenarPorEncaje(lista, { epoca: EPOCA_0 }), E.ordenarPorEncaje(lista));
    if (JSON.stringify(enc) !== JSON.stringify(E.ordenarPorEncaje(lista))) reordena++;
    for (const o of E.marcarEmpates(enc, { epoca })) {
      const n = enc.filter((p) => p.llegada !== o.llegada && cmp({ ...o, llegada: 0 }, { ...p, llegada: 0 }) === 0).length;
      assert.equal(o.empatados, n);
      assert.equal(o.empate, n > 0);
    }
  }
  assert.ok(reordena > 20, String(reordena));
});

/**
 * Lo que la ronda 2 encontró: en `ocupantes` (y por él en BUSCAR y en
 * descubrir) una dirección de un registro tiene como mucho UN ocupante con
 * vector distinto de cero. Los propios y los escritos se colocan donde se
 * buscan (vector cero, acuerdo 10), y la cadena de ceros de caminosDe
 * (1, 1.0, 1.0.0…) termina en un único nodo no array, así que solo una
 * referencia por dirección se sigue. Como la distancia ordinal solo desempata
 * candidatos de igual acuerdo, epoca.ordinal no puede cambiar hoy el orden de
 * ningún ocupante: el gancho existe pero no actúa. [X] decidir VG (ver el
 * PR «Pruebas de propiedades 2»): qué candidatos de una misma dirección
 * deben llevar vector propio para que la época ordene algo.
 *
 * Por hojas (VG, 7-11 noche): una lista bajo la raíz da un ocupante por
 * elemento, y tras cada elemento que es una referencia va lo que alcanza.
 * Con una lista de referencias, una dirección puede tener varios ocupantes
 * con vector distinto de cero, y entre los de igual acuerdo la época sí
 * puede ordenar. Lo que se mantiene: solo una referencia seguida tiene
 * vector distinto de cero, una por cada propio que es referencia; sin
 * elementos de lista, como mucho una, y la época no cambia el orden; con
 * ellos, la época no quita ni añade ocupantes, no rompe el orden por
 * acuerdo y deja en su orden a los de vector cero.
 */
test('propiedad: en una dirección de un registro hay como mucho un ocupante con vector distinto de cero, y la época no cambia el orden de ocupantes', async () => {
  let direcciones = 0;
  let conLista = 0;
  for (let s = 0; s < 10; s++) {
    const g = prng(SEMILLA + 450 + s);
    const payload = (ids, prof = 0) => (prof >= 2 || g.r() < 0.3
      ? (ids.length && g.si(0.6) ? { ref: g.pick(ids), dir: dirAl(g) } : g.pick([1, 'x']))
      : Array.from({ length: g.int(1, 4) }, () => payload(ids, prof + 1)));
    const eje = await Eje.genesis({ demostracion: true, identidad: 'r', emision: [], foco: payload([]), t: T0 });
    const ids = [eje.genesisId];
    for (let i = 0; i < 6; i++) ids.push((await eje.escribir({ autor: 'r', sobre: g.pick(ids), en: dirAl(g), t: T0, movimientos: [gastaT('r')], payload: g.si(0.3) ? { ref: g.pick(ids), dir: dirAl(g) } : payload(ids), contexto: { i } })).id);
    for (const id of ids) {
      for (const [dir, oc] of E.arbol(eje, id)) {
        direcciones++;
        const noExactos = oc.filter((o) => o.acuerdo < ARIDAD);
        assert.ok(noExactos.every((o) => o.origen === 'referencia'), dir);
        assert.equal(oc.filter((o) => o.origen === 'referencia').length, oc.filter((o) => o.origen === 'propio' && esReferencia(o.contenido)).length, dir);
        const epoca = cargarEpoca({ nombre: 'época de prueba', reglas: [], ordinales: [g.int(0, 9), g.int(0, 9)] }, { respaldo: EPOCA_0 });
        const conEpoca = E.ocupantes(eje, id, indicesDe(dir), { epoca });
        const proc = (lista) => lista.map((o) => JSON.stringify(o.procedencia));
        if (!oc.some((o) => o.enLista)) {
          assert.ok(noExactos.length <= 1, dir);
          assert.deepEqual(proc(conEpoca), proc(oc));
        } else {
          conLista++;
          assert.deepEqual([...proc(conEpoca)].sort(), [...proc(oc)].sort(), 'la época no quita ni añade');
          for (let i = 1; i < conEpoca.length; i++) assert.ok(conEpoca[i - 1].acuerdo >= conEpoca[i].acuerdo, 'orden por acuerdo');
          const ceros = (lista) => proc(lista.filter((o) => o.acuerdo === ARIDAD));
          assert.deepEqual(ceros(conEpoca), ceros(oc), 'los de vector cero, en su orden');
        }
      }
    }
  }
  assert.ok(direcciones > 100, String(direcciones));
  assert.ok(conLista > 0, 'hay direcciones con elementos de lista');
});

// ---------- caso Booking ----------

const dia = (n) => new Date(Date.parse('2026-11-12') + n * 86400000).toISOString().slice(0, 10);
// Los minutos que se pasaban ya no se dan: T no cruza de persona (VG, 7-11 noche); se ignoran.
async function altaHuesped(eje, id, eur) {
  // B1: la persona escribe su propia alta, aceptando la invitación de la casa (encargo 3b).
  // Revisión de seguridad (encargo 3b): la aceptación no se fecha antes del último t del libro.
  const t = new Date(Math.max(Date.parse('2026-11-08T08:00:00Z'), eje.tMaximo())).toISOString();
  await entrarPorInvitacion(eje, { por: BK.CASA, quien: id, t });
  return eje.escribir({ autor: BK.CASA, sobre: eje.genesisId, t, movimientos: [gastaT(BK.CASA), ...(eur ? [{ token: 'E', emisor: BK.CASA, denominacion: 'EUR', cantidad: eur, de: BK.CASA, a: id }] : []), ...(eur ? [] : [{ token: 'R', emisor: BK.CASA, cantidad: 1, de: BK.CASA, a: id }])], payload: ['Alta', [id]] });
}

/**
 * Reservas aleatorias (personas huéspedes con poco o mucho dinero, plazas,
 * noches dentro y fuera de la temporada, solapes) y confirmaciones en orden
 * aleatorio. Con minutos de sobra: cada serie «<plaza>@<noche>» se conserva y
 * nunca pasa de la capacidad; una reserva solo queda entregada si queda
 * pagada (y al revés), por el total de su 1.3, y entonces está cerrada (la
 * plantilla de la reserva: lo anunciado pasó); lo que la comprobación previa
 * rechaza no escribe nada. Encargo 3b: cada parte escribe su movimiento sobre
 * la reserva (la entrega, de la casa; el pago, de quien reserva).
 */
// Lo que cumple cada anuncio de la reserva cuelga de él (VG 12-11, decisión 8).
const parte = (eje, r, autor, titulo) => eje.sobre(r.id, '4100000000').flatMap((a) => eje.sobre(a.id)).some((e) => e.autor === autor && e.payload === titulo);
test('propiedad: Booking — series de plaza conservadas y acotadas por la capacidad; entregada ⇔ pagada; la comprobación previa no escribe', async () => {
  const vistos = { confirmada: 0, solape: 0, sinDinero: 0 };
  for (let s = 0; s < 6; s++) {
    const g = prng(SEMILLA + 500 + s);
    const { eje, habitacion, reserva: primera } = await BK.ejemploReserva({ confirmar: false });
    const huespedes = ['huesped'];
    for (let i = 0; i < 3; i++) { await altaHuesped(eje, 'h' + i, g.pick([0, 30, 60]), 600); huespedes.push('h' + i); }
    const reservas = [primera];
    const pagado = new Map();
    for (let paso = 0; paso < 10; paso++) {
      if (g.si(0.5)) {
        const entrada = g.int(0, 20);
        reservas.push(await BK.reservar(eje, { autor: g.pick(huespedes), habitacion, plaza: g.int(0, 2), noches: [dia(entrada), dia(entrada + g.int(1, 4))], t: '2026-11-08T18:30:00Z' }));
      } else {
        const r = g.pick(reservas);
        const n0 = eje.orden.length;
        const eur = eje.saldo(r.autor, BK.EUR);
        try {
          const hecho = await BK.confirmarReserva(eje, r);
          if (!hecho.yaConfirmada) pagado.set(r.id, eur - eje.saldo(r.autor, BK.EUR));
          vistos.confirmada++;
        } catch (e) {
          if (/^sin saldo para pagar/.test(e.message)) { vistos.sinDinero++; assert.equal(eje.orden.length, n0, 'la comprobación previa no escribe'); }
          if (/saldo insuficiente de E:casa\//.test(e.message)) vistos.solape++;
        }
      }
      for (const se of eje.series().filter((x) => x.token === 'E' && x.denominacion.includes('@'))) {
        const total = eje.identidades().reduce((n, id) => n + eje.saldo(id, se.clave), 0);
        assert.equal(total, se.emitido, 'se conserva ' + se.clave);
        assert.ok(se.emitido <= 2, 'capacidad');
      }
      for (const r of reservas) {
        const entregada = parte(eje, r, BK.CASA, 'Plaza entregada');
        const pagada = parte(eje, r, r.autor, 'Pagada');
        assert.equal(entregada, pagada, 'entregada ⇔ pagada en ' + r.id.slice(0, 8));
        assert.equal(cerrado(eje, r.id).cerrado, pagada, 'cerrada ⇔ entregada y pagada en ' + r.id.slice(0, 8));
        if (pagada && pagado.has(r.id)) assert.equal(pagado.get(r.id), B.evaluar(eje, r.id, [1, 3]).valor.cantidad);
      }
    }
    assert.deepEqual(ida(await restaurar(ida(eje))), ida(eje));
  }
  assert.ok(Object.values(vistos).every((n) => n > 0), JSON.stringify(vistos));
});

// BK-01 y BK-02 ya no se saltan: T no se agota (VG, 7-11 noche: T es el medidor propio, no cruza de persona y lo
// que falta se acuña al gastarse), así que ninguna de las dos partes se queda a medias por falta de minutos.
test('regresión Booking: sin minutos para pagar, la plaza no se entrega sin cobrar', async () => {
  const { eje, habitacion } = await BK.ejemploReserva({ confirmar: false });
  await altaHuesped(eje, 'h0', 30, 18);
  const r = await BK.reservar(eje, { autor: 'h0', habitacion, plaza: BK.PLAZAS.litera, noches: ['2026-11-20', '2026-11-21'], t: '2026-11-08T18:30:00Z' });
  await BK.confirmarReserva(eje, r).catch(() => {});
  assert.ok(!parte(eje, r, BK.CASA, 'Plaza entregada') || parte(eje, r, 'h0', 'Pagada'));
});

test('regresión Booking: reservar sin minutos para las noches no deja una reserva sin su 7', async () => {
  const { eje, habitacion } = await BK.ejemploReserva({ confirmar: false });
  await altaHuesped(eje, 'h1', 30, 12);
  const n0 = eje.orden.length;
  // Sin T que se agote, la reserva y sus noches entran las dos: nunca una reserva sin su 7.
  const r = await BK.reservar(eje, { autor: 'h1', habitacion, plaza: BK.PLAZAS.litera, noches: ['2026-11-20', '2026-11-21'], t: '2026-11-08T18:30:00Z' });
  assert.equal(eje.orden.length, n0 + 2 + 2); // la reserva, sus noches y lo que anuncia (una noche y el pago: encargo 3b)
  assert.ok(eje.sobre(r.id, '7000000000').length > 0, 'la reserva tiene su tramo en el 7');
});

// ---------- caso Tasks ----------

/**
 * La fórmula del 9 (FORMULA_ELECCION) contra un oráculo: de los escritos
 * anclados en el 1 de la tarea, el primero en llegar cuyo precio (su 1) cabe
 * en el coste total (1.1) y cuyo plazo (su 2) cabe en el plazo (2.1); si
 * alguno trae otra unidad, INCOMPATIBLE (antes de operar se validan tipos y
 * dimensiones, corpus 03 l.44); si ninguno cabe, la colección vacía.
 */
test('propiedad: Tasks — la fórmula del 9 elige el primer presupuesto que cabe en coste y plazo', async () => {
  const vistos = { elige: 0, ninguno: 0, incompatible: 0 };
  for (let s = 0; s < 14; s++) {
    const g = prng(SEMILLA + 600 + s);
    const { eje, tarea } = await TK.ejemploTarea({ hasta: 'tarea' });
    const coste = B.evaluar(eje, tarea.id, [1, 1]).valor;
    const plazo = B.evaluar(eje, tarea.id, [2, 1]).valor;
    const escritos = [];
    for (let i = 0; i < g.int(1, 4); i++) {
      const precio = g.pick([200, 310, 350, 420, 1000]);
      const unidad = g.si(0.9) ? 'EUR' : 'USD';
      const horas = g.pick([2, 5, 8, 9, 12]);
      const uh = g.si(0.92) ? 'h' : 'min';
      const ev = await escribirDesde(eje, { modo: 'sequenced', autor: 'proveedor', sobre: tarea.id, en: tarea.payload[5], t: '2026-11-08T0' + i + ':00:00Z', payload: ['Presupuesto ' + i, precio + ' ' + unidad, horas + ' ' + uh, 'proveedor'] });
      escritos.push({ id: ev.id, precio, unidad, horas, uh });
    }
    const r = B.evaluar(eje, tarea.id, [9]);
    if (escritos.some((x) => x.unidad !== coste.unidad || x.uh !== plazo.unidad)) {
      assert.equal(r.estado, 'INCOMPATIBLE', r.texto);
      vistos.incompatible++;
      continue;
    }
    const cabe = escritos.filter((x) => x.precio <= coste.cantidad && x.horas <= plazo.cantidad);
    assert.equal(r.estado, 'RESUELTO', r.texto);
    assert.deepEqual(r.valor.items.map((x) => x.evento), cabe.slice(0, 1).map((x) => x.id));
    vistos[cabe.length ? 'elige' : 'ninguno']++;
  }
  assert.ok(Object.values(vistos).every((n) => n > 0), JSON.stringify(vistos));
});

// TK-01 ya no se salta: R8, elegibilidad antes que límites (src/elegibles.js; mapa §14 [D] «Quién ocupa una posición
// ajena»): el BUSCAR del 9 de la tarea ya no ve el presupuesto de la casa, que no está en su 3.
test('regresión Tasks: por defecto solo cuentan los ocupantes del autor y de quien aparece en el 3',
  async () => {
    const { eje, tarea } = await TK.ejemploTarea({ hasta: 'tarea' });
    const ajeno = await escribirDesde(eje, { modo: 'sequenced', autor: 'casa', sobre: tarea.id, en: tarea.payload[5], t: '2026-11-07T12:00:00Z', payload: ['Presupuesto de la casa', '300 EUR', '5 h', 'casa'] });
    const r = B.evaluar(eje, tarea.id, [9]);
    assert.equal(r.estado, 'RESUELTO', r.texto);
    assert.ok(!r.valor.items.some((x) => x.evento === ajeno.id), 'la casa no está en el 3 de la tarea');
  });
