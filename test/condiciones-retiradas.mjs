// Las condiciones JS que las reglas de la época sustituyeron (encargo 3a, paso 9; VG, 10-11, A1), retiradas de
// src/ y guardadas aquí tal cual estaban: son la red de equivalencia de test/reglas-bqlm.test.js, que sigue
// comparando cada regla conectada al eje con el código que la precedía. No las usa el eje ni la validez.
//
//   RL-1 (reloj)                  not before its focus, not before the writer joined, at most a year ahead
//   ID-9 (emision, entera)        only persons mint, E is minted by and to its issuer, R is minted by its issuer,
//                                 nobody mints T; y las del 3b (P), que siguen en src/ciclo.js
//   TT-6 (tNoSeBloquea)           T is not locked
//   TT-4 (asignacionDelDia)       writing burns today's T
//   TT-8 (tNoCruza)               T only goes to things
//   ancla (ANCLA)                 every record hangs on a record of the ledger
//   ID-8 (AJENOS)                 nobody moves tokens of others
//   PP-4 (AMBITO_P)               P moves within a known scope
//   EE-1, registro desconocido    E is tied to a record that exists
//   ID-5, ID-6 (FIRMA, CLAVES)    who has a key signs, without a key nobody acts, a key is declared at its alta,
//                                 a declared key comes with its proof (lo criptográfico sigue en src/: suelo)

import { AMBITO_GENESIS, ESCALAS_INFORMATIVAS, asignacionT, claveToken } from '../src/tokens.js';
import { segundosUTC, segundosDeGuardado, segundosDe } from '../src/instante.js';
import {
  ADELANTO_MAXIMO_S, T_NO_SE_EMITE, T_NO_SE_BLOQUEA, escribePersona, esCosa, poderAntesDe, emitidoAntesDe, mismaCaducidad,
  porQueNoAmplia, motivoAjenos, validosDe,
} from '../src/ciclo.js';
import { verificar, verificarPosesion, clavePublicaValida } from '../src/autoridad.js';

const corto = (x) => String(x).slice(0, 8);
const objetos = (ev) => (Array.isArray(ev.movimientos) ? ev.movimientos.filter((m) => m && typeof m === 'object') : []);

/**
 * RL-1, RL-2, RL-3. El reloj, [X] confirmar VG: el t de un evento no es
 * anterior al de su foco (`sobre`) ni al del alta de su autor; el alta toma
 * el t del evento que la hace. Sin esto, un alta retrofechada (un evento
 * fechado en 1900) daría decenas de miles de días de asignación de T (VG,
 * 8-11: asignación diaria). Y por arriba, [X] confirmar VG: sin reloj externo
 * (T no vale nada para terceros), lo que hay en el eje: un evento no va más
 * de un año (anio) por delante del mayor t ya aceptado. Sin esto, fechar a
 * futuro abriría días de asignación sin fin. Todo se compara en milisegundos
 * UTC (src/instante.js).
 */
function reloj(ev, ctx) {
  const errores = [];
  const falla = (i, capa, texto) => errores.push({ i, capa, texto });
  const autor = ev.autor;
  // En segundos enteros (VG, 10-11, C2), como D-FECHA en las reglas: dentro del mismo segundo no hay antes.
  const t = segundosUTC(ev.t);
  if (!Number.isNaN(t)) {
    const foco = ctx.registro(ev.sobre);
    if (foco && t < segundosDeGuardado(foco.t)) falla(null, 4, 'el t del evento (' + ev.t + ') es anterior al de su foco ' + corto(ev.sobre) + ' (' + foco.t + ')');
    const altaAutor = ctx.alta(autor);
    if (altaAutor && t < segundosDeGuardado(altaAutor.t)) falla(null, 4, 'el t del evento (' + ev.t + ') es anterior al alta de ' + autor + ' (' + altaAutor.t + ')');
    const maximo = ctx.tMaximo?.() ?? -Infinity;
    if (Number.isFinite(maximo) && t > segundosDe(maximo) + ADELANTO_MAXIMO_S) {
      falla(null, 4, 'el t del evento (' + ev.t + ') va más de un año (anio) por delante del mayor t del eje (' + new Date(maximo).toISOString() + ')');
    }
  }
  return errores;
}

/**
 * ID-9, ID-10, TT-1, PP-2, PP-3, EE-9 (caducidad). Quién emite: solo
 * personas, en su propio nombre; T no se emite; P lo acuña quien escribió el
 * registro, una vez (R3); la caducidad de una serie de E la fija su primera
 * emisión. Un solo motivo por movimiento: el primero que falla.
 */
function emision(ev, ctx, validos) {
  const errores = [];
  const falla = (i, capa, texto) => errores.push({ i, capa, texto });
  const autor = ev.autor;
  const emitidoAntes = emitidoAntesDe(ctx);
  const persona = escribePersona(autor, ctx);
  const caducas = new Map(); // clave → caducidad fijada en este evento

  for (const { m, i } of validos) {
    if (m.de !== null) continue;
    if (!persona) {
      // B1 (VG, 10-11): persona = quien escribió su propia alta; una cosa es lo que dio de alta otra identidad, su dueño.
      // Quien entró en el prefijo de la versión 2 es lo que declaró su alta entonces (suelo de persistencia).
      const tipoV2 = ctx.tipo?.(autor);
      falla(i, 5, 'solo las personas emiten: ' + autor + (tipoV2 ? ' es ' + tipoV2 + ' (lo declaró su alta, de la versión 2)' : ' es una cosa (su alta la escribió ' + (ctx.registro(ctx.alta(autor)?.id)?.autor ?? 'otra identidad') + ')'));
      continue;
    }
    if ((m.token === 'E' || m.token === 'R') && m.emisor !== autor) {
      // Solo personas emiten, en su propio nombre (VG, 8-11: «en P y en R es la persona la que pone su R y su P,
      // no maneja el del grupo; en E igual»). Lo que se hace por un grupo se hace con lo delegado.
      falla(i, 5, 'nadie emite en nombre de otro: ' + m.emisor + ' no es el autor');
      continue;
    }
    if (m.token === 'T') {
      // VG, 8-11: no hay T acumulable. Nadie emite T, ni el génesis: cada persona tiene, cada día, su asignación.
      falla(i, 5, T_NO_SE_EMITE + ' (VG, 8-11: no hay T acumulable)');
      continue;
    }
    if (m.token === 'P') {
      // Acuñar P es solo de quien escribió el registro (sobre el eje entero,
      // del génesis). Quien solo TIENE P lo transfiere (delegar estrecha el
      // ámbito y conserva la cantidad), pero no lo acuña: si no, con 1 P
      // delegado se acuñaría P sin límite, y con P sobre el génesis, sobre
      // todo el eje.
      if (m.a !== autor) { falla(i, 5, 'la emisión de P va a quien la emite: ' + autor); continue; }
      const registro = m.ambito === AMBITO_GENESIS ? undefined : ctx.registro(m.ambito);
      if (!registro) {
        falla(i, 4, m.ambito === AMBITO_GENESIS
          ? 'P sobre todo el eje («' + AMBITO_GENESIS + '») solo lo emite el génesis'
          : 'P fuera del génesis va sobre un registro existente: ámbito desconocido ' + corto(m.ambito));
        continue;
      }
      // [X] confirmar VG: con el id del génesis como ámbito, su autor puede
      // ampliar después el P sobre todo el eje, como cualquier autora sobre su
      // registro; nadie más.
      if (registro.autor !== autor) {
        falla(i, 5, 'P sobre ' + corto(m.ambito) + ' lo acuña solo quien escribió el registro (' + registro.autor + '): ' + autor + ' puede transferir el P que tenga, no acuñarlo');
        continue;
      }
      // R3 (VG, 7-11 noche): P:X es una serie cerrada. Su autor la emite UNA
      // vez (en su primera emisión; varios movimientos del mismo evento son la
      // misma); ampliarla después es ejecutar una consolidación sobre X que
      // esté AUTORIZADA (src/autorizacion.js), y solo entonces vale. Sobre el
      // génesis, P:genesis (el del génesis) y P:<id del génesis> son la misma
      // serie: lo que emitió el génesis ya la abrió.
      const noAmplia = emitidoAntes(m.ambito) > 0 ? porQueNoAmplia(ev, m.ambito, ctx) : null;
      if (noAmplia) {
        falla(i, 5, 'P:' + corto(m.ambito) + ' es una serie cerrada: ya la emitió su autor, y ampliarla es ejecutar una consolidación sobre ' + corto(m.ambito) + ' que esté AUTORIZADA (R3): ' + noAmplia);
      }
    }
    if (m.token === 'E') {
      // La caducidad es del contrato de la serie: la fija la primera emisión y las ampliaciones coinciden (como instante).
      const k = claveToken(m);
      const s = ctx.serie(k);
      const fijada = caducas.has(k) ? caducas.get(k) : s && s.emitido > 0 ? (s.caduca ?? null) : undefined;
      const esta = m.caduca ?? null;
      if (fijada === undefined) caducas.set(k, esta);
      else if (!mismaCaducidad(fijada, esta)) falla(i, 4, 'la serie ' + k + (fijada ? ' caduca el ' + fijada : ' no caduca') + ': una ampliación no cambia su caducidad');
    }
  }
  return errores;
}

/** TT-6. T no se bloquea ni se libera (VG, 8-11: no hay T acumulable). */
function tNoSeBloquea(ev, ctx, validos) {
  return validos.filter(({ m }) => m.token === 'T' && m.estado !== undefined).map(({ i }) => ({ i, capa: 5, texto: T_NO_SE_BLOQUEA }));
}

/**
 * TT-2, TT-3, TT-4. T como asignación diaria (VG, 8-11: «te lo gastas como
 * quieras, no te puedes gastar más»): lo que una persona dada de alta gasta
 * de su T (consumirlo o dárselo a una cosa) sale de la asignación del día de
 * ev.t (tokens.asignacionT). Ningún T se acumula (VG, 8-11: no hay T
 * acumulable): el génesis no emite T y T no cruza a una persona, así que una
 * persona no tiene T explícito; solo lo arrastra quien viene del prefijo de
 * la versión 2 (src/persistencia.js), que lo gasta después de la asignación
 * hasta agotarlo. Si no alcanza: T del día agotado. Lo que no es una persona
 * (una cosa) no tiene asignación: gasta el T que le dio su persona, y ese sí
 * lo conserva hasta gastarlo (lo mira el saldo).
 */
function asignacionDelDia(ev, ctx, validos) {
  const errores = [];
  const autor = ev.autor;
  // B1: la asignación es de las personas: de quien escribió su alta o la escribe ahora (aún sin cuenta: nada gastado).
  if (!escribePersona(autor, ctx) || !ctx.gastadoT) return errores;
  const conAlta = Boolean(ctx.alta(autor));
  const asignada = new Map(); // escala → lo que queda de la asignación, durante el evento
  const explicito = new Map(); // escala → T explícito disponible, durante el evento
  const verA = (e) => {
    if (!asignada.has(e)) { const a = asignacionT(ev.t, e); asignada.set(e, Math.max(0, a.cantidad - (conAlta ? ctx.gastadoT(autor, e, a.periodo) : 0))); }
    return asignada.get(e);
  };
  const verX = (e) => (explicito.has(e) ? explicito.get(e) : Math.max(0, ctx.saldo(autor, 'T:' + e)));
  for (const { m, i } of validos) {
    if (m.token !== 'T' || m.de !== autor || ESCALAS_INFORMATIVAS.includes(m.escala)) continue;
    const e = m.escala;
    if (m.estado !== undefined || m.a === autor) continue; // bloquear T ya falla (TT-6); darse T a uno mismo no gasta
    const usa = Math.min(verA(e), m.cantidad);
    const falta = m.cantidad - usa;
    if (falta > verX(e)) { errores.push({ i, capa: 4, texto: 'T del día agotado (' + e + '): quedan ' + (verA(e) + verX(e)) }); continue; }
    asignada.set(e, verA(e) - usa);
    explicito.set(e, verX(e) - falta);
  }
  return errores;
}

/**
 * TT-8, TT-9. T no cruza de persona (VG, 7-11 noche: «recibir T solo es un
 * registro de una cantidad de tiempo; podemos hacer que se transforme en E,
 * al ser un recurso de otra persona»): de una persona a otra identidad, T se
 * rechaza, y dar tiempo a otro es emitir E de la serie del que lo da, en su
 * tiempo (E:<persona>/hora). Lo único que vale (Core, 8-11) es que una
 * PERSONA dé su T a una COSA («T de segundo para automatismos y
 * maquinaria»): la máquina gasta el T de su dueño, y el tope sigue siendo el
 * de la persona (y una cosa lo pasa a otra cosa: no cruza de persona).
 * Delegar T (VG, 8-11: «yo te delego T, P, R, E para que tú lo uses») es
 * esto: dar E en tiempo propio.
 */
function tNoCruza(ev, ctx, validos) {
  const errores = [];
  const autor = ev.autor;
  // B1 (VG, 10-11): persona o cosa por la autoría del alta, no por un tipo declarado.
  const personaAutor = escribePersona(autor, ctx);
  const poderAntes = poderAntesDe(ev, ctx);
  // El dueño de una identidad: quien escribió su alta (si se da de alta en este mismo evento, el autor).
  const duenoDe = (id) => { const alta = ctx.alta(id); return alta ? ctx.registro(alta.id)?.autor : autor; };
  const cosaACosa = (de, a) => {
    const alta = ctx.alta(a);
    if (!alta) return true; // la da de alta este mismo evento: su dueño es el autor
    return duenoDe(a) === de || duenoDe(a) === duenoDe(de) || poderAntes(alta.id) > 0;
  };
  for (const { m, i } of validos) {
    if (m.token !== 'T' || m.de === null || m.a === null || m.a === autor) continue;
    const cosaA = esCosa(m.a, autor, ctx);
    if (personaAutor && cosaA) continue; // una persona da su T a una cosa
    // De cosa a cosa (VG, 8-11; regla de Core aceptada): solo entre cosas del mismo dueño (quien escribió sus altas) o
    // si el autor escribió el alta de la cosa destino o tiene P sobre ella. Si no, una cosa repartiría T ajeno.
    if (!personaAutor && cosaA) {
      if (!cosaACosa(autor, m.a)) errores.push({ i, capa: 5, texto: 'T de cosa a cosa solo entre cosas del mismo dueño, o si ' + autor + ' escribió el alta de ' + m.a + ' o tiene P sobre ella (VG, 8-11)' });
      continue;
    }
    errores.push({ i, capa: 5, texto: 'T no cruza de persona: ' + m.a + ' no es el autor; dar tiempo a otro es emitir E de la serie del que lo da, denominada en su tiempo (E:' + autor + '/' + m.escala + '); solo se da T a una cosa' });
  }
  return errores;
}

/** Las secciones del ciclo retiradas, como estaban en SECCIONES_DEL_CICLO: (ev, ctx.ciclo, validos) → [{ i, capa, texto }]. */
export const SECCIONES_RETIRADAS = Object.freeze({
  'RL-1': Object.freeze({ nombre: 'RL-1', filas: Object.freeze(['RL-1', 'RL-2', 'RL-3']), evaluar: reloj }),
  'ID-9': Object.freeze({ nombre: 'ID-9', filas: Object.freeze(['ID-9', 'ID-10', 'TT-1', 'PP-2', 'PP-3', 'EE-9']), evaluar: emision }),
  'TT-6': Object.freeze({ nombre: 'TT-6', filas: Object.freeze(['TT-6']), evaluar: tNoSeBloquea }),
  'TT-4': Object.freeze({ nombre: 'TT-4', filas: Object.freeze(['TT-2', 'TT-3', 'TT-4']), evaluar: asignacionDelDia }),
  'TT-8': Object.freeze({ nombre: 'TT-8', filas: Object.freeze(['TT-8', 'TT-9']), evaluar: tNoCruza }),
});

/** El anclaje: todo registro, salvo el génesis, se ancla sobre uno que está en el eje. */
export const ANCLA = Object.freeze({
  nombre: 'ancla',
  evaluar: (tx, libro, ctx) => {
    const ev = ctx.evento;
    if (ev.sobre === null) return 'solo el génesis carece de foco';
    return ctx.registro(ev.sobre) ? null : 'foco desconocido: ' + ev.sobre;
  },
});

/** ID-8. Nadie mueve tokens ajenos: todo movimiento con origen lo escribe su titular (era una condición de paso). */
export const AJENOS = Object.freeze({
  nombre: 'ID-8',
  evaluar: (tx, libro, ctx) => {
    const ev = ctx.evento;
    return (ctx.validos ?? validosDe(ev)).filter(({ m }) => m.de !== null && m.de !== ev.autor).map(({ m, i }) => ({ paso: i, i, texto: motivoAjenos(m.de) }));
  },
});

/** PP-4. Delegar o consumir P va sobre un ámbito que existe (era una condición de paso). */
export const AMBITO_P = Object.freeze({
  nombre: 'PP-4',
  evaluar: (tx, libro, ctx) => {
    const ev = ctx.evento;
    return (ctx.validos ?? validosDe(ev))
      .filter(({ m }) => m.token === 'P' && m.de !== null && m.de === ev.autor && m.estado === undefined && m.ambito !== AMBITO_GENESIS && !ctx.registro(m.ambito))
      .map(({ m, i }) => ({ paso: i, i, texto: 'ámbito desconocido: ' + String(m.ambito).slice(0, 8) }));
  },
});

/** EE-1, la parte retirada: la E se ata a un registro del eje. */
export function registroDesconocido(ev, ctxTope) {
  return validosDe(ev)
    .filter(({ m }) => m.token === 'E' && m.de === null && m.registro !== undefined && !ctxTope.registro(m.registro))
    .map(({ m }) => 'registro desconocido de la serie ' + claveToken(m) + ': ' + corto(m.registro) + ' (la E se ata a un registro del eje)');
}

/** ID-4, ID-5 como estaban: quien tiene clave firma, el firmante es el autor, sin clave no se actúa (R9). */
export const FIRMA = Object.freeze({
  nombre: 'ID-5',
  evaluar: async (tx, libro, ctx) => {
    const ev = ctx.evento;
    const clave = ctx.clave(ev.autor) ?? (libro.tiene(ev.autor) ? undefined : ev.contexto?.claves?.[ev.autor]);
    if (clave) {
      if (!ev.firma) return 'firma ausente de ' + ev.autor;
      if (ev.firmante !== ev.autor) return 'el firmante debe ser el autor';
      if (!(await verificar(ev, clave))) return 'firma inválida de ' + ev.autor;
      return null;
    }
    if (ctx.exigirFirmas) return 'autor sin clave: ' + ev.autor;
    if (ctx.exigeClave) return 'sin clave no se actúa: ' + ev.autor + ' no tiene clave registrada (solo un eje de demostración lo admite)';
    return null;
  },
});

/** ID-2, ID-6 como estaban: las claves se declaran en el alta, de identidades nuevas, con su prueba de posesión. */
export const CLAVES = Object.freeze({
  nombre: 'ID-6',
  evaluar: async (tx, libro, ctx) => {
    const ev = ctx.evento;
    const movimientos = objetos(ev);
    const errores = [];
    const declaradas = ev.contexto?.claves ?? {};
    for (const [id, jwk] of Object.entries(declaradas)) {
      const propia = id === ev.autor;
      if (ctx.tieneClave(id) || libro.tiene(id)) errores.push('no se puede cambiar la clave de ' + id);
      else if (!propia && !movimientos.some((m) => m.a === id)) errores.push('clave declarada para ' + id + ' sin darle tokens');
      else if (!(await clavePublicaValida(jwk))) errores.push('clave inválida para ' + id);
      else if (propia && !Object.hasOwn(ev.posesion ?? {}, id)) continue;
      else if (!Object.hasOwn(ev.posesion ?? {}, id)) {
        if (ctx.exigeClave) errores.push('la clave de ' + id + ' llega sin prueba de posesión: el alta lleva la firma de esa clave sobre su id (posesion)');
      } else if (!(await verificarPosesion(ev, id, jwk))) errores.push('prueba de posesión inválida para ' + id + ': no la firma la clave que se declara');
    }
    for (const id of Object.keys(ev.posesion ?? {})) {
      if (!Object.hasOwn(declaradas, id)) errores.push('prueba de posesión de ' + id + ' sin clave declarada para él en este evento');
    }
    return errores;
  },
});
