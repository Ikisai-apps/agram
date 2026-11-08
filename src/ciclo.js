// Ciclo de vida de E/P/R/T (VG, 7-11 noche): quién emite y en qué orden.
//
// «Todos son emitidos por una persona individualmente. Siempre es X persona
// respalda Y recurso concreto, poder de decisión sobre algo, reputación
// cedida a otros para requerir atención, o tiempo usado por alguien en algo.»
// Y la emisión es escalonada: «normalmente será T + (opc) R; si T + R + (opc)
// P; si T+R+P + (opc) E».
//
// Estas son las reglas de emisión de un evento que no es el génesis, y la del
// reloj (ningún evento se fecha antes que su foco ni que el alta de su autor).
// Las usan el eje (src/eje.js, al validar) y las capas de validez
// (src/validez.js, con el libro de justo antes del registro), así que las dos
// dicen lo mismo. No simulan saldos: eso lo hace cada uno con su vista. Solo
// leen el contexto de antes del evento y los movimientos del propio evento.
//
// Los eventos que se guardaron con la versión 2 (src/persistencia.js) se
// vuelven a validar con las reglas de entonces (`ctx.reglas === 2`): T y P
// solo los emite el génesis; E y R, su emisor a sí mismo, si es persona o
// grupo; sin escalonado ni regla del reloj. Las reglas nuevas rigen los
// eventos nuevos.

import { AMBITO_GENESIS, EMITEN, SEGUNDOS, TOPE_T_MINIMO, claveToken, partirClave, topeT, validarMovimiento } from './tokens.js';
import { msUTC, msDeGuardado } from './instante.js';
import { esConsolidacion, FABRICA } from './autorizacion.js';
import { esConsumoT } from './evento.js';
import { rPropiaEnJuego } from './lente.js';

/** Quién emitía en la versión 2 (antes del 7-11 noche): personas y grupos. Solo para eventos guardados con ella. */
export const EMITEN_V2 = Object.freeze(['persona', 'grupo']);

/** [X] confirmar VG: cuánto puede ir un evento por delante del mayor t del eje (un anio, en milisegundos). */
export const ADELANTO_MAXIMO_MS = SEGUNDOS.anio * 1000;

const corto = (x) => String(x).slice(0, 8);

/**
 * ¿Se emite E o R a nombre de `emisor` porque es un grupo? Lo que «emite el
 * grupo» lo emite y lo firma una persona con P sobre su registro (lo comprueba
 * reglasDelCiclo). Es uno de los dos sitios donde se lee el tipo, y los dos
 * solo deciden quién firma emisiones (R10: el tipo no da renta; el otro es
 * EMITEN). Lo usan el eje y las capas de validez (src/validez.js).
 */
export function aNombreDeGrupo(ctx, emisor) {
  return ctx.tipo(emisor) === 'grupo';
}

/**
 * ¿Mueve este evento lo de un grupo por su cuenta? Regla de Core (8-11), **[X]
 * confirmar VG**, con la cita de VG: «lo que hace un grupo lo hace una persona
 * con P sobre él, con su firma». Un grupo no recibe T ni escribe: «nadie mueve
 * tokens ajenos» admite que `de` sea un GRUPO si el evento lo dice
 * (`contexto.porCuenta` = el grupo) y su autor es una PERSONA con P sobre el
 * registro de alta del grupo. El evento sigue siendo de la persona: su firma y
 * su T. Vale para mover, bloquear y liberar lo del grupo; emitir a su nombre ya
 * es así (#62). Lo usan el eje y las capas de validez.
 *
 * Revisión de seguridad (VG, 8-11; **[X] confirmar VG** el detalle):
 *   · cuenta solo el P EXACTO sobre el alta del grupo (la clave
 *     `P:<id del alta>`): ni el heredado de un ancestro ni el del génesis, que
 *     cubren mucho más que el grupo;
 *   · disponible, o bloqueado hacia ese mismo grupo (con salida = el grupo, su
 *     alta o una serie de E o R que emite el grupo: grupoDeSalida); el P
 *     bloqueado con otra salida está comprometido en otra cosa y no cuenta;
 *   · el alta solo habilita a su grupo: si el evento de alta dio de alta a
 *     varios grupos, el P sobre él no habilita a mover lo de ninguno (cada
 *     grupo, su propio alta: gruposDeAlta).
 * ctx: tipo(id), alta(id), registro(id), saldo(id, k), bloqueosPor(id, k) → [[salida, cantidad]].
 */
export function porCuentaDeGrupo(ev, de, ctx) {
  return motivoPorCuenta(ev, de, ctx) === null;
}

/**
 * Por qué `ev` NO mueve lo del grupo `de` por su cuenta (null si sí): las
 * reglas de porCuentaDeGrupo, con el motivo que se enseña.
 */
export function motivoPorCuenta(ev, de, ctx) {
  if (!ev || ev.contexto?.porCuenta !== de) return 'el evento no dice contexto.porCuenta';
  if (ctx.tipo(de) !== 'grupo') return de + ' no es un grupo';
  if (ctx.tipo(ev.autor) !== 'persona') return ev.autor + ' no es una persona';
  const alta = ctx.alta(de)?.id;
  if (!alta) return de + ' no tiene alta';
  const grupos = gruposDeAlta(ctx, alta);
  if (grupos.length > 1) return 'su alta (' + corto(alta) + ') dio de alta a varios grupos (' + grupos.join(', ') + '): el P sobre ella no habilita a ninguno; cada grupo, su propio alta';
  const k = 'P:' + alta;
  const disponible = Math.max(0, ctx.saldo(ev.autor, k));
  const haciaElGrupo = (ctx.bloqueosPor?.(ev.autor, k) ?? [])
    .filter(([salida]) => grupoDeSalida(salida, de, alta))
    .reduce((s, [, c]) => s + Math.max(0, c), 0);
  if (disponible + haciaElGrupo > 0) return null;
  return ev.autor + ' no tiene ' + k + ' (el P exacto sobre el alta del grupo, disponible o bloqueado hacia él; el heredado o el bloqueado para otra cosa no cuenta)';
}

/**
 * Los grupos que dio de alta el evento `altaId`: los que declaró grupo en
 * `contexto.tipos` y los grupos que recibieron en él sus primeros tokens.
 */
export function gruposDeAlta(ctx, altaId) {
  const ev = ctx.registro?.(altaId);
  if (!ev) return [];
  const candidatos = new Set([
    ...Object.keys(ev.contexto?.tipos ?? {}),
    ...(Array.isArray(ev.movimientos) ? ev.movimientos : []).map((m) => m?.a).filter((a) => typeof a === 'string'),
  ]);
  return [...candidatos].filter((id) => (ev.contexto?.tipos?.[id] ?? ctx.tipo(id)) === 'grupo' && (ev.contexto?.tipos?.[id] === 'grupo' || ctx.alta(id)?.id === altaId));
}

/** ¿Va un bloqueo con esta salida hacia el grupo? Salida = el grupo, su alta, o una serie de E o R que emite el grupo. */
export function grupoDeSalida(salida, grupo, alta) {
  if (typeof salida !== 'string') return false;
  if (salida === grupo || salida === alta) return true;
  if (!/^[ER]:/.test(salida)) return false;
  return partirClave(salida).emisor === grupo;
}

/**
 * El motivo de rechazo cuando alguien mueve lo de otro, con la pista de
 * porCuenta si la pide para un grupo (y, con `ctx`, por qué no vale).
 */
export function motivoAjenos(ev, de, ctx) {
  if (ev?.contexto?.porCuenta !== de) return 'nadie mueve tokens ajenos: ' + de + ' no es el autor';
  const por = ctx ? motivoPorCuenta(ev, de, ctx) : null;
  return 'nadie mueve tokens ajenos: ' + de + ' no es el autor (por cuenta del grupo ' + de + ' mueve una persona con P exacto sobre su alta' + (por ? ': ' + por : '') + ')';
}

/** Dos caducidades son la misma si faltan las dos o nombran el mismo instante en UTC (no el mismo texto). */
function mismaCaducidad(a, b) {
  if (a === null || b === null) return a === b;
  return msUTC(a) === msUTC(b);
}

/**
 * El alta de quien entró en el prefijo de la versión 2 (con las reglas viejas,
 * que no ataban el t) cuenta, para el reloj y el tope de T, desde el primer
 * evento de la versión 3 (`tPrimeroV3`) si este es posterior.
 */
export function acotarAltaV2(alta, tPrimeroV3) {
  return msDeGuardado(alta.t) >= msDeGuardado(tPrimeroV3) ? alta : { id: alta.id, t: tPrimeroV3 };
}

/**
 * Errores de las reglas de emisión de `ev`: [{ i, capa, texto }]. `i` es el
 * índice del movimiento (null si es del evento entero); `capa` es 4 si falta
 * respaldo (el tope del reloj, el t del evento, un ámbito que no existe, la
 * caducidad de la serie) y 5 si falta permiso (quién emite, el escalonado).
 * El génesis no pasa por aquí: emite por convención (src/eje.js,
 * erroresGenesis).
 *
 * ctx, todo de antes del evento:
 *   tipo(id)                 'persona' | 'grupo' | 'cosa' | null
 *   alta(id)                 { id, t } del evento que la dio de alta, o null (acotada si es del prefijo v2)
 *   tMaximo()                el mayor t aceptado en el eje, en milisegundos UTC
 *   emitidoT(id, escala)     T que esa persona lleva emitido en esa escala (sin el génesis)
 *   serie(clave)             { emisor, emitido, caduca } o null
 *   registro(id)             el evento con ese id, o undefined
 *   ambitosQueCubren(ambito) los ámbitos de P que cubren un registro
 *   saldo(id, clave)         saldo disponible
 *   reglas                   2 si el evento se guardó con la versión 2; si no, las de ahora
 *   genesisId                el id del génesis
 *   autorizada(id)           true si la consolidación id está AUTORIZADA (y sin ejecutar) justo antes del evento
 *                            (src/autorizacion.js: estadoPorPeso con el lector de ese momento)
 *   ampliada(id)             true si la consolidación id ya respaldó una ampliación de P (consolidacionQueAmplia, que lee este mismo contexto)
 *   bloqueado(id, k, salida) lo bloqueado de esa serie por esa identidad con esa salida (la R propia en juego, R6)
 */
export function reglasDelCiclo(ev, ctx) {
  if (!ev || typeof ev !== 'object' || ev.contexto?.genesis === true) return [];
  const autor = ev.autor;
  const validos = (Array.isArray(ev.movimientos) ? ev.movimientos : [])
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m && typeof m === 'object' && !validarMovimiento(m).length);
  if (ctx.reglas === 2) return reglasV2(autor, validos, ctx);
  const errores = [];
  const falla = (i, capa, texto) => errores.push({ i, capa, texto });

  // El reloj, [X] confirmar VG: el t de un evento no es anterior al de su foco
  // (`sobre`) ni al del alta de su autor; el alta toma el t del evento que la
  // hace. Sin esto, un alta retrofechada (un evento fechado en 1900) daría
  // miles de millones de T:segundo con el tope de abajo.
  // Y por arriba, [X] confirmar VG: sin reloj externo (T no vale nada para
  // terceros), lo que hay en el eje: un evento no va más de un año (anio) por
  // delante del mayor t ya aceptado. Sin esto, fechar a futuro inflaría el tope.
  // Todo se compara en milisegundos UTC (src/instante.js).
  const t = msUTC(ev.t);
  if (!Number.isNaN(t)) {
    const foco = ctx.registro(ev.sobre);
    if (foco && t < msDeGuardado(foco.t)) falla(null, 4, 'el t del evento (' + ev.t + ') es anterior al de su foco ' + corto(ev.sobre) + ' (' + foco.t + ')');
    const altaAutor = ctx.alta(autor);
    if (altaAutor && t < msDeGuardado(altaAutor.t)) falla(null, 4, 'el t del evento (' + ev.t + ') es anterior al alta de ' + autor + ' (' + altaAutor.t + ')');
    const maximo = ctx.tMaximo?.() ?? -Infinity;
    if (Number.isFinite(maximo) && t > maximo + ADELANTO_MAXIMO_MS) {
      falla(null, 4, 'el t del evento (' + ev.t + ') va más de un año (anio) por delante del mayor t del eje (' + new Date(maximo).toISOString() + ')');
    }
  }

  // P del autor sobre un registro: saldo disponible en un ámbito que lo cubre, o P que mueve o recibe en este evento con ese ámbito.
  const poderAntes = (registro) => ctx.ambitosQueCubren(registro).reduce((s, a) => s + Math.max(0, ctx.saldo(autor, 'P:' + a)), 0);
  const pEnEvento = (registro) => {
    const cubren = new Set(ctx.ambitosQueCubren(registro));
    return validos.some(({ m }) => m.token === 'P' && (m.de === autor || m.a === autor) && cubren.has(m.ambito));
  };
  const tienePoder = (registro) => poderAntes(registro) > 0 || pEnEvento(registro);
  // Lo emitido de la serie P de un registro antes del evento (sobre el génesis, P:genesis y P:<id> juntas).
  const emitidoAntes = (ambito) => clavesDeSerieP(ambito, ctx.genesisId).reduce((s, k) => s + (ctx.serie(k)?.emitido ?? 0), 0);

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
      if (!aNombreDeGrupo(ctx, m.emisor)) { falla(i, 5, 'nadie emite en nombre de otro: ' + m.emisor + ' no es el autor'); continue; }
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

  // T se acuña al gastarse (src/eje.js, acunaAlGastar): consumir T propio sin
  // saldo es AZÚCAR de emitirlo y consumirlo en el mismo evento, así que rige
  // lo mismo que una emisión explícita: solo lo hace una persona, y lo acuñado
  // cuenta en lo emitido por escala y no pasa del tope del reloj (revisión de
  // seguridad de Core, 8-11). Si no alcanza, saldo insuficiente, como antes.
  const disponibleT = new Map(); // escala → T disponible del autor durante el evento
  const verT = (e) => (disponibleT.has(e) ? disponibleT.get(e) : Math.max(0, ctx.saldo(autor, 'T:' + e)));
  for (const { m, i } of validos) {
    if (m.token !== 'T') continue;
    const e = m.escala;
    if (m.de === null) { if (m.a === autor) disponibleT.set(e, verT(e) + m.cantidad); continue; }
    if (m.de !== autor) continue;
    if (m.estado === 'liberacion') { disponibleT.set(e, verT(e) + m.cantidad); continue; }
    if (!esConsumoT(m, autor)) { if (m.estado === 'bloqueo' || m.a !== autor) disponibleT.set(e, Math.max(0, verT(e) - m.cantidad)); continue; }
    const usa = Math.min(verT(e), m.cantidad);
    disponibleT.set(e, verT(e) - usa);
    const falta = m.cantidad - usa;
    if (falta <= 0) continue;
    const k = 'T:' + e;
    // Solo las personas (Core, 8-11): una cosa gasta el T que le dio su persona, y un grupo no tiene T.
    if (!EMITEN.includes(tipoAutor)) {
      falla(i, 4, 'saldo insuficiente de ' + k + ' en ' + autor + ': tiene ' + usa + ' y gasta ' + m.cantidad + '; solo una persona acuña su T al gastarlo (' + autor + (tipoAutor ? ' es ' + tipoAutor : ' no declaró tipo en su alta') + ')');
      continue;
    }
    const alta = ctx.alta(autor);
    const tope = alta ? topeT(alta.t, ev.t, e) : TOPE_T_MINIMO;
    const llevaria = ctx.emitidoT(autor, e) + (tDelEvento.get(e) ?? 0) + falta;
    tDelEvento.set(e, (tDelEvento.get(e) ?? 0) + falta);
    if (llevaria > tope) {
      falla(i, 4, 'saldo insuficiente de ' + k + ' en ' + autor + ': acuñar al gastar los ' + falta + ' que faltan llevaría ' + llevaria + ' emitido y el reloj da ' + tope + (alta ? ' desde su alta (' + alta.t + ')' : ''));
    }
  }

  // T no cruza de persona (VG, 7-11 noche: «recibir T solo es un registro de
  // una cantidad de tiempo; podemos hacer que se transforme en E, al ser un
  // recurso de otra persona»): de una persona a otra identidad, T se rechaza, y
  // dar tiempo a otro es emitir E de la serie del que lo da, en su tiempo
  // (E:<persona>/hora). Lo único que vale (Core, 8-11) es que una PERSONA dé su
  // T a una COSA («T de segundo para automatismos y maquinaria»): la máquina
  // gasta el T de su dueño, y el tope sigue siendo el de la persona (y una cosa
  // lo pasa a otra cosa: no cruza de persona). Un grupo
  // no recibe T: lo que escribe un grupo lo escribe una persona con P sobre él.
  for (const { m, i } of validos) {
    if (m.token !== 'T' || m.de === null || m.a === null || m.a === autor) continue;
    const tipoA = ctx.tipo(m.a) ?? ev.contexto?.tipos?.[m.a] ?? null;
    if ((tipoAutor === 'persona' || tipoAutor === 'cosa') && tipoA === 'cosa') continue; // una cosa pasa a otra cosa el T de su persona
    falla(i, 5, 'T no cruza de persona: ' + m.a + ' no es el autor; dar tiempo a otro es emitir E de la serie del que lo da, denominada en su tiempo (E:' + autor + '/' + m.escala + '); solo se da T a una cosa');
  }

  // R3 (VG, 7-11 noche): quien recibe P solo lo delega (repartiendo: el eje
  // debita del ámbito exacto y, si no alcanza, de los que lo cubren) o lo
  // bloquea. Delegar con el ámbito de un registro X tomando de un ámbito más
  // amplio (estrechar) crea P:X que no viene de la emisión de X, así que:
  // hacia una serie cerrada (P:X ya emitida) no se estrecha; y hacia la raíz
  // de un dominio (un registro sobre el génesis, el que decide al autorizar:
  // src/autorizacion.js) solo estrecha su autor ([X] confirmar VG). Si no,
  // quien tiene P del eje lo convertiría en P de la raíz antes de que su autor
  // emita, y el P del génesis contaría donde la raíz tiene P propio. Estrechar
  // hacia un registro que no es raíz sigue libre: ese P no autoriza nada.
  const exacto = new Map(); // ámbito → P:ámbito exacto disponible del autor, durante el evento
  const verExacto = (a) => (exacto.has(a) ? exacto.get(a) : Math.max(0, ctx.saldo(autor, 'P:' + a)));
  const emitidaAqui = new Set(); // ámbitos de P emitidos en este evento
  for (const { m, i } of validos) {
    if (m.token !== 'P') continue;
    const a = m.ambito;
    if (m.de === null) {
      emitidaAqui.add(a);
      if (m.a === autor) exacto.set(a, verExacto(a) + m.cantidad);
      continue;
    }
    if (m.de !== autor) continue;
    if (m.estado === 'liberacion') { exacto.set(a, verExacto(a) + m.cantidad); continue; }
    const hay = verExacto(a);
    exacto.set(a, Math.max(0, hay - m.cantidad));
    if (m.estado === undefined && m.a === autor) exacto.set(a, exacto.get(a) + m.cantidad);
    if (m.estado !== undefined || hay >= m.cantidad || a === AMBITO_GENESIS || a === ctx.genesisId) continue;
    const registro = ctx.registro(a);
    if (!registro) continue; // el ámbito desconocido lo rechaza el eje
    if (emitidoAntes(a) > 0 || emitidaAqui.has(a)) {
      falla(i, 5, 'P:' + corto(a) + ' es una serie cerrada: se delega el P:' + corto(a) + ' que se tiene (' + hay + '); estrecharlo desde un ámbito más amplio la ampliaría (R3)');
    } else if (registro.sobre === ctx.genesisId && registro.autor !== autor) {
      falla(i, 5, 'estrechar P hacia ' + corto(a) + ', la raíz de un dominio, es solo de quien la escribió (' + registro.autor + '): ' + autor + ' delega el P que tiene con su ámbito (R3)');
    }
  }

  // Escalonado: R exige T; P exige T y R propia en juego; E exige T, R propia en juego y P sobre el registro.
  if (emitidas.size) {
    // «Mover T» es CONSUMIR T del autor (VG, 7-11 noche): de = autor, a =
    // null. Bloquearlo, liberarlo o dárselo a uno mismo no cuesta nada, y T no
    // cruza de persona, así que solo cuenta el consumo.
    const mueveT = validos.some(({ m }) => esConsumoT(m, autor));
    // «R propia en juego» (R6, VG 7-11 noche): R:<autor> bloqueada como colateral de su serie (src/lente.js).
    const rEnJuego = rPropiaEnJuego(autor, validos.map(({ m }) => m), ctx);
    for (const token of ['R', 'P', 'E']) {
      if (!emitidas.has(token)) continue;
      if (!mueveT) falla(null, 5, 'emitir ' + token + ' exige consumir T del autor en el mismo evento (de = ' + autor + ', a = null; VG, 7-11 noche)');
      if (token !== 'R' && !rEnJuego) {
        falla(null, 5, 'emitir ' + token + ' exige R propia en juego: R:' + autor + ' bloqueada como colateral (salida «R:' + autor + '»), al menos la décima parte de lo emitido de R:' + autor + ', antes o en el mismo evento (R6)');
      }
      if (token === 'E' && ctx.registro(ev.sobre) && !tienePoder(ev.sobre)) {
        falla(null, 5, 'emitir E exige P del autor sobre el registro ' + corto(ev.sobre) + ' (saldo o movimiento de P en el mismo evento)');
      }
    }
  }
  return errores;
}

/** Las claves de la serie P de un ámbito: sobre el génesis, P:genesis y P:<id del génesis>, que son la misma. */
function clavesDeSerieP(ambito, genesisId) {
  return ambito === AMBITO_GENESIS || ambito === genesisId ? ['P:' + AMBITO_GENESIS, ...(genesisId ? ['P:' + genesisId] : [])] : ['P:' + ambito];
}

/**
 * La consolidación que `ev` usó para ampliar una serie P ya emitida, o null.
 * El eje y las capas de validez la marcan como usada al aplicar el evento: una
 * consolidación respalda UNA ampliación de P. Solo la usa el evento que amplía
 * de verdad (SEG-04, revisión de la #73): su foco es una consolidación de su
 * mismo autor y emite P sobre el registro que ella amplía (sobre el génesis,
 * P:genesis o P:<id del génesis>), en una serie que ya estaba emitida antes del
 * evento, por el camino en que `porQueNoAmplia` no puso pega. Una ejecución
 * que emite P por primera vez sobre otro registro (o un evento de otra
 * identidad en la fábrica) no la consume: si no, bastaría con él para negar
 * la ampliación legítima.
 *
 * `contexto` es el de las reglas del ciclo (reglasDelCiclo) de justo antes de
 * `ev`, o una función que lo da: solo se pide si `ev` está en la fábrica y
 * dice `fase: 'ejecutado'`.
 */
export function consolidacionQueAmplia(ev, contexto) {
  if (!ev || ev.en !== FABRICA || ev.contexto?.fase !== 'ejecutado' || typeof ev.sobre !== 'string') return null;
  const ctx = typeof contexto === 'function' ? contexto() : contexto;
  if (!ctx || ctx.reglas === 2) return null;
  const c = ctx.registro(ev.sobre);
  if (!esConsolidacion(c) || c.autor !== ev.autor) return null;
  const emitidoAntes = (ambito) => clavesDeSerieP(ambito, ctx.genesisId).reduce((s, k) => s + (ctx.serie(k)?.emitido ?? 0), 0);
  const amplia = (Array.isArray(ev.movimientos) ? ev.movimientos : []).some((m) =>
    m && typeof m === 'object' && !validarMovimiento(m).length && m.token === 'P' && m.de === null && m.a === ev.autor &&
    m.ambito !== AMBITO_GENESIS && ctx.registro(m.ambito)?.autor === ev.autor &&
    emitidoAntes(m.ambito) > 0 && porQueNoAmplia(ev, m.ambito, ctx) === null);
  return amplia ? c.id : null;
}

/**
 * Por qué `ev` no amplía la serie P:`ambito`, o null si la amplía: ha de ser la
 * ejecución REAL de una consolidación sobre el registro `ambito` que está
 * AUTORIZADA justo antes (y aún sin ejecutar), y que no haya respaldado ya otra
 * ampliación. Es lo único que amplía una serie P:X ya emitida (R3). La ejecuta
 * su autor (ejecutar en el motor; aquí, el autor de la consolidación, que ha
 * de ser quien emite: el autor de X). Real (SEG-01, revisión de main 7-11
 * noche): no basta con decir `fase: 'ejecutado'`; lleva la evidencia que deja
 * motor.ejecutar, no vacía, con el id de la consolidación, y todas sus
 * referencias son eventos del eje.
 */
function porQueNoAmplia(ev, ambito, ctx) {
  const c = ctx.registro(ev.sobre);
  if (!esConsolidacion(c) || ev.en !== FABRICA || ev.contexto?.fase !== 'ejecutado') return 'no es la ejecución de una consolidación';
  if (c.autor !== ev.autor) return 'la ejecuta el autor de la consolidación (' + c.autor + ')';
  const sobreElGenesis = ambito === AMBITO_GENESIS || ambito === ctx.genesisId;
  if (sobreElGenesis ? c.sobre !== ctx.genesisId : c.sobre !== ambito) return 'la consolidación ' + corto(c.id) + ' no es sobre ' + corto(ambito);
  const evidencia = ev.contexto?.evidencia;
  if (!Array.isArray(evidencia) || !evidencia.length) return 'una ejecución lleva su evidencia (contexto.evidencia), y esta no la lleva';
  if (!evidencia.includes(c.id)) return 'la evidencia no cita la consolidación ' + corto(c.id);
  const rota = evidencia.find((id) => typeof id !== 'string' || !ctx.registro(id));
  if (rota !== undefined) return 'la evidencia cita ' + corto(rota) + ', que no está en el eje';
  if (ctx.ampliada?.(c.id) === true) return 'la consolidación ' + corto(c.id) + ' ya respaldó una ampliación: respalda una sola';
  if (ctx.autorizada?.(c.id) !== true) return 'la consolidación ' + corto(c.id) + ' no está AUTORIZADA (o ya se ejecutó)';
  return null;
}

/** Las reglas de emisión de la versión 2, para los eventos guardados con ella. */
function reglasV2(autor, validos, ctx) {
  const errores = [];
  const tipo = ctx.tipo(autor);
  for (const { m, i } of validos) {
    // Lo que la versión 2 no conocía no cabe en su prefijo.
    if (m.estado !== undefined || m.salida !== undefined || m.caduca !== undefined) {
      errores.push({ i, capa: 5, texto: 'estado, salida y caduca no existían en la versión 2: no caben en su prefijo' });
      continue;
    }
    if (m.token === 'R' && m.de !== null && m.de !== m.emisor) {
      errores.push({ i, capa: 5, texto: 'R no es fungible: solo la mueve su emisor ' + m.emisor + ' (reglas de la versión 2: tampoco se devolvía)' });
      continue;
    }
    if (m.de !== null) continue;
    if (m.token === 'T' || m.token === 'P') errores.push({ i, capa: 5, texto: 'solo el génesis emite ' + m.token + ' (reglas de la versión 2)' });
    else if (m.emisor !== autor) errores.push({ i, capa: 5, texto: 'nadie emite en nombre de otro: ' + m.emisor + ' no es el autor (reglas de la versión 2)' });
    else if (!EMITEN_V2.includes(tipo)) errores.push({ i, capa: 5, texto: 'solo personas y grupos emiten: ' + autor + (tipo ? ' es ' + tipo : ' no declaró tipo en su alta') + ' (reglas de la versión 2)' });
  }
  return errores;
}
