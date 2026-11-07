// Ciclo de vida de E/P/R/T (VG, 7-11 noche): quién emite y en qué orden.
//
// «Todos son emitidos por una persona individualmente. Siempre es X persona
// respalda Y recurso concreto, poder de decisión sobre algo, reputación
// cedida a otros para requerir atención, o tiempo usado por alguien en algo.»
// Y la emisión es escalonada: «normalmente será T + (opc) R; si T + R + (opc)
// P; si T+R+P + (opc) E».
//
// Estas son las reglas de emisión de un evento que no es el génesis. Las usan
// el eje (src/eje.js, al validar) y las capas de validez (src/validez.js, con
// el libro de justo antes del registro), así que las dos dicen lo mismo. No
// simulan saldos: eso lo hace cada uno con su vista. Solo leen el contexto de
// antes del evento y los movimientos del propio evento.

import { AMBITO_GENESIS, EMITEN, TOPE_T_MINIMO, claveToken, topeT, validarMovimiento } from './tokens.js';

const corto = (x) => String(x).slice(0, 8);

/**
 * Errores de las reglas de emisión de `ev`: [{ i, capa, texto }]. `i` es el
 * índice del movimiento (null si es del evento entero); `capa` es 4 si falta
 * respaldo (el tope del reloj, un ámbito que no existe, la caducidad de la
 * serie) y 5 si falta permiso (quién emite, el escalonado). El génesis no
 * pasa por aquí: emite por convención (src/eje.js, erroresGenesis).
 *
 * ctx, todo de antes del evento:
 *   tipo(id)                 'persona' | 'grupo' | 'cosa' | null
 *   alta(id)                 { id, t } del evento que la dio de alta, o null
 *   emitidoT(id, escala)     T que esa persona lleva emitido en esa escala (sin el génesis)
 *   serie(clave)             { emisor, emitido, caduca } o null
 *   registro(id)             el evento con ese id, o undefined
 *   ambitosQueCubren(ambito) los ámbitos de P que cubren un registro
 *   saldo(id, clave)         saldo disponible
 */
export function reglasDelCiclo(ev, ctx) {
  if (!ev || typeof ev !== 'object' || ev.contexto?.genesis === true) return [];
  const autor = ev.autor;
  const validos = (Array.isArray(ev.movimientos) ? ev.movimientos : [])
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m && typeof m === 'object' && !validarMovimiento(m).length);
  const errores = [];
  const falla = (i, capa, texto) => errores.push({ i, capa, texto });

  // P del autor sobre un registro: saldo disponible en un ámbito que lo cubre, o P que mueve o recibe en este evento con ese ámbito.
  const poderAntes = (registro) => ctx.ambitosQueCubren(registro).reduce((s, a) => s + Math.max(0, ctx.saldo(autor, 'P:' + a)), 0);
  const pEnEvento = (registro) => {
    const cubren = new Set(ctx.ambitosQueCubren(registro));
    return validos.some(({ m }) => m.token === 'P' && (m.de === autor || m.a === autor) && cubren.has(m.ambito));
  };
  const tienePoder = (registro) => poderAntes(registro) > 0 || pEnEvento(registro);

  const tipoAutor = ctx.tipo(autor);
  const emitidas = new Set();
  const tDelEvento = new Map(); // escala → T emitido en este evento
  const caducas = new Map(); // clave → caducidad fijada en este evento

  for (const { m, i } of validos) {
    if (m.de !== null) continue;
    emitidas.add(m.token);
    if (!EMITEN.includes(tipoAutor)) {
      falla(i, 5, 'solo las personas emiten: ' + autor + (tipoAutor ? ' es ' + tipoAutor : ' no declaró tipo en su alta'));
      continue;
    }
    if ((m.token === 'E' || m.token === 'R') && m.emisor !== autor) {
      // A nombre de un grupo: lo emite una persona con P sobre el registro del grupo (su alta).
      if (ctx.tipo(m.emisor) !== 'grupo') { falla(i, 5, 'nadie emite en nombre de otro: ' + m.emisor + ' no es el autor'); continue; }
      const registro = ctx.alta(m.emisor)?.id;
      if (!registro || !tienePoder(registro)) {
        falla(i, 5, 'emitir a nombre del grupo ' + m.emisor + ' exige P sobre su registro' + (registro ? ' (' + corto(registro) + ')' : '') + ': ' + autor + ' no lo tiene');
        continue;
      }
    }
    if (m.token === 'T') {
      // PROVISIONAL [X] (VG, 7-11 noche): «emitir desde dos fuentes es igual de válido que emitir el doble
      // desde una única fuente; no da más». Este T por identidad y reloj es lo que una identidad falsa
      // multiplica: la regla final saldrá del estudio de neutralidad ante agrupación y división.
      if (m.a !== autor) { falla(i, 5, 'T lo emite cada persona para sí misma: a debe ser ' + autor); continue; }
      const alta = ctx.alta(autor);
      const tope = alta ? topeT(alta.t, ev.t, m.escala) : TOPE_T_MINIMO;
      const llevaria = ctx.emitidoT(autor, m.escala) + (tDelEvento.get(m.escala) ?? 0) + m.cantidad;
      tDelEvento.set(m.escala, (tDelEvento.get(m.escala) ?? 0) + m.cantidad);
      if (llevaria > tope) {
        falla(i, 4, 'tope de T:' + m.escala + ' para ' + autor + ': llevaría ' + llevaria + ' emitido y el reloj da ' + tope + (alta ? ' desde su alta (' + alta.t + ')' : ''));
      }
    }
    if (m.token === 'P') {
      if (m.a !== autor) { falla(i, 5, 'la emisión de P va a quien la emite: ' + autor); continue; }
      const registro = m.ambito === AMBITO_GENESIS ? undefined : ctx.registro(m.ambito);
      if (!registro) {
        falla(i, 4, m.ambito === AMBITO_GENESIS
          ? 'P sobre todo el eje («' + AMBITO_GENESIS + '») solo lo emite el génesis'
          : 'P fuera del génesis va sobre un registro existente: ámbito desconocido ' + corto(m.ambito));
        continue;
      }
      if (registro.autor !== autor && !(poderAntes(m.ambito) > 0)) {
        falla(i, 5, 'emitir P sobre ' + corto(m.ambito) + ' exige ser autora del registro o tener ya P sobre él: ' + autor + ' no es ni lo uno ni lo otro');
      }
    }
    if (m.token === 'E') {
      // La caducidad es del contrato de la serie: la fija la primera emisión y las ampliaciones coinciden.
      const k = claveToken(m);
      const s = ctx.serie(k);
      const fijada = caducas.has(k) ? caducas.get(k) : s && s.emitido > 0 ? (s.caduca ?? null) : undefined;
      const esta = m.caduca ?? null;
      if (fijada === undefined) caducas.set(k, esta);
      else if (fijada !== esta) falla(i, 4, 'la serie ' + k + (fijada ? ' caduca el ' + fijada : ' no caduca') + ': una ampliación no cambia su caducidad');
    }
  }

  // Escalonado: R exige T; P exige T y R propia en juego; E exige T, R propia en juego y P sobre el registro.
  if (emitidas.size) {
    const mueveT = validos.some(({ m }) => m.token === 'T' && m.de === autor);
    const rEnJuego = validos.some(({ m }) => m.token === 'R' && m.emisor === autor && m.de === autor && m.a !== null && m.a !== autor && m.estado === undefined);
    for (const token of ['R', 'P', 'E']) {
      if (!emitidas.has(token)) continue;
      if (!mueveT) falla(null, 5, 'emitir ' + token + ' exige mover T del autor en el mismo evento');
      if (token !== 'R' && !rEnJuego) {
        falla(null, 5, 'emitir ' + token + ' exige R propia en juego en el mismo evento: mover R:' + autor + ' de ' + autor + ' a otra identidad o al registro');
      }
      if (token === 'E' && ctx.registro(ev.sobre) && !tienePoder(ev.sobre)) {
        falla(null, 5, 'emitir E exige P del autor sobre el registro ' + corto(ev.sobre) + ' (saldo o movimiento de P en el mismo evento)');
      }
    }
  }
  return errores;
}
