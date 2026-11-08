// Clasificar: la lista de una posición y la cruceta como lente (VG, 7-11
// noche, mapa §12 [D]). La lista de la posición son colisiones fuera del
// árbol («en la profundidad 11»): sus ocupantes, por llegada, no tienen PV.
// La materia prima es esa lista (encaje.lista): lo propio de la posición
// (por hojas, VG 7-11 noche: una décupla o un terminal es UNA pieza; cada
// elemento de una lista, un array solo de hojas, una pieza aparte) y lo
// escrito en ella, por llegada.
// Aquí se ven como piezas sueltas «por clasificar» junto a los diez huecos de
// la cruceta (las subposiciones de la décupla de la posición, nombradas por
// la regla corta de su profundidad). Dos modos:
// - lente: solo ver. Colocar una pieza en un hueco la muestra interpretada
//   con esa lente; no escribe nada. Lo colocado se recuerda solo en este
//   navegador, como comodidad (si no hay almacenamiento, no pasa nada).
// - crear: colocar es escribir el elemento en esa subposición por dirección
//   (`en`), con la escritura de siempre (Pointed: un terminal, un minuto de
//   T). Cada colocación es un registro real del eje; nada se simula. El
//   registro dice qué pieza clasifica (contexto.clasifica) y, desde ese
//   momento, la pieza sale de «por clasificar».
// En el móvil, «arrastrar y soltar» es tocar la pieza y luego el hueco; en
// el escritorio vale también arrastrar. Sin librerías.

import { encaje, salida, bql, mapped, direccion, indicesDe, esReferencia, esTerminal, ARIDAD, EPOCA_0, epocaDe, leerCamino } from '../src/index.js';
import { escapar, corto, leerLocal, guardarLocal } from './comun.js';
import { htmlLeido } from './leido.js';

export const MODOS_CLASIFICAR = Object.freeze(['lente', 'crear']);
const CLAVE_MODO = 'agram.clasificar.modo';
const CLAVE_LENTE = 'agram.clasificar.lente';

let modo = MODOS_CLASIFICAR.includes(leerLocal(CLAVE_MODO)) ? leerLocal(CLAVE_MODO) : 'lente';
let elegida = null; // clave de la pieza tocada, a la espera de un hueco
let lente = leerLente();

function leerLente() {
  try {
    const x = JSON.parse(leerLocal(CLAVE_LENTE) ?? '{}');
    return x && typeof x === 'object' && !Array.isArray(x) ? x : {};
  } catch {
    return {};
  }
}

/** El modo de clasificar: 'lente' (solo ver) o 'crear' (escribe). */
export function modoClasificar() {
  return modo;
}

export function elegirModoClasificar(m) {
  modo = MODOS_CLASIFICAR.includes(m) ? m : 'lente';
  guardarLocal(CLAVE_MODO, modo);
  elegida = null;
  return modo;
}

/**
 * Clave estable de una pieza: el registro y el camino exacto ('id#1'; un
 * escrito, 'id#') y, si es un elemento de una lista explícita, su índice en
 * ella ('id#1[2]').
 */
export function claveDe(pieza) {
  return pieza.evento + '#' + pieza.camino.join('.') + (Number.isInteger(pieza.indice) ? '[' + pieza.indice + ']' : '');
}

/** Si la pieza es un escrito anclado en la posición. */
const deEscrito = (o) => o.tipo === 'escrito';

const mismaLista = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, k) => x === b[k]);
const claveLente = (foco, posicion) => foco + '#' + posicion.join('.');

/** La posición en foco de la vista: el camino y, si se eligió, una de sus diez posiciones. */
export function posicionDe(estado) {
  const camino = [...(estado.camino ?? [])];
  return estado.en === '' || estado.en === undefined || estado.en === null ? camino : [...camino, Number(estado.en)];
}

/** Si un registro es una colocación hecha en «crear», qué pieza clasifica: { posicion, evento, camino, indice? }, o null. */
export function colocacionDe(ev) {
  const c = ev?.contexto?.clasifica;
  if (!c || typeof c.evento !== 'string' || !Array.isArray(c.camino) || !Array.isArray(c.posicion)) return null;
  return c;
}

/** El hueco (0–9) de la posición en el que está anclado `en`, o null si no es una de sus diez subposiciones. */
export function huecoDe(en, posicion) {
  if (posicion.length >= ARIDAD) return null;
  for (let d = 0; d < ARIDAD; d++) if (direccion([...posicion, d]) === en) return d;
  return null;
}

/** Texto corto de un contenido: un terminal tal cual, una fórmula con su resultado, una referencia con lo que alcanza. */
export function textoPieza(eje, pieza) {
  const c = pieza.contenido;
  if (c === undefined) return pieza.alcanza?.estado ?? '—';
  if (Array.isArray(c)) {
    // Una décupla (o la raíz de un escrito) se nombra por lo que es: su primera hoja, bajando por el 0 (por hojas, el 0 va entre corchetes).
    let primero = c[0];
    while (Array.isArray(primero)) primero = primero[0];
    const cara = typeof primero === 'string' || typeof primero === 'number' ? bql.desescapar(String(primero)) : esReferencia(primero) ? '→ ' + corto(primero.ref) : undefined;
    return (cara !== undefined ? cara + ' · ' : '') + '[' + c.length + ']';
  }
  if (esReferencia(c)) {
    const a = pieza.alcanza?.contenido;
    const visto = a === undefined ? '' : ' = ' + (Array.isArray(a) ? '[' + a.length + ']' : esReferencia(a) ? '→ ' + corto(a.ref) : bql.desescapar(String(a)));
    return '→ ' + corto(c.ref) + visto;
  }
  if (bql.esFormula(c)) {
    // Una fórmula dentro de una lista no tiene dirección propia: se dice, sin evaluarla aquí.
    if (Number.isInteger(pieza.indice)) return c;
    const r = bql.evaluar(eje, pieza.evento, pieza.camino);
    return c + ' → ' + (r.estado === 'RESUELTO' ? r.texto : r.estado.toLowerCase());
  }
  return bql.desescapar(String(c));
}

/**
 * Lo que se escribe al colocar una pieza en «crear»: el elemento.
 * - Un terminal que no es fórmula (texto, número, referencia) se escribe tal cual, también si es
 *   un elemento de una lista.
 * - Un escrito de la lista se escribe como referencia a él (su raíz): las referencias no copian.
 * - Una fórmula o una décupla propias, como referencia a su camino: copiar una fórmula cambiaría lo
 *   que lee. Una dirección no distingue un 0 final (1.0 es la 1), así que una pieza en un camino que
 *   acaba en 0, si es décupla o fórmula, no se puede nombrar: se dice, no se apaña.
 * - Un elemento de una lista que es fórmula tampoco: una dirección no entra en una lista (VG, 7-11
 *   noche, por hojas). Se dice.
 */
export function elementoDe(pieza) {
  const c = pieza.contenido;
  if (pieza.enLista) {
    if (esTerminal(c) && !bql.esFormula(c)) return c;
    throw new Error('el ocupante ' + ((pieza.indice ?? 0) + 1) + ' de una lista no se puede nombrar por dirección (una dirección no entra en una lista): escríbelo a mano');
  }
  if (pieza.tipo === 'escrito') return { ref: pieza.evento };
  if (esTerminal(c) && !bql.esFormula(c)) return c;
  const dir = direccion(pieza.camino);
  if (!mismaLista(indicesDe(dir), pieza.camino)) {
    throw new Error('el ocupante ' + pieza.camino.join('.') + ' no se puede nombrar por dirección (un 0 final es la posición misma): escríbelo a mano');
  }
  return { ref: pieza.evento, dir };
}

/**
 * Modelo de la vista para la posición `posicion` del registro `foco`:
 * { foco, posicion, dir, nombre, piezas, clasificadas, huecos, lente }.
 * - piezas: la lista de la posición (encaje.lista), por llegada, sin las ya
 *   clasificadas en «crear» ni las colocaciones de esta misma posición
 *   (una colocación en el hueco 0 cae en la dirección de la posición: es un
 *   ocupante de ella, pero está en su hueco). Cada una con `clave` y `texto`.
 * - huecos: diez, { digito, nombre, pv, dir, escritos, lente }. `nombre`, la
 *   regla corta de la profundidad de la subposición; `pv`, el PV de la
 *   cruceta para ese dígito (solo bajo la raíz). `escritos`: lo escrito en
 *   esa subposición (las colocaciones y lo escrito por dirección; en el
 *   hueco 0, solo las colocaciones). `lente`: lo colocado en modo lente.
 * `lenteLocal` ({ clave: hueco }) son las colocaciones de la lente.
 */
export function modeloClasificar(eje, foco, posicion, { epoca = EPOCA_0, lenteLocal = {} } = {}) {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  if (posicion.length >= ARIDAD) throw new Error('en la profundidad 10 no quedan subposiciones donde clasificar');
  const e = epocaDe(epoca);
  const n = posicion.length;
  const dir = direccion(posicion);
  const hijos = eje.sobre(foco);
  const colocaciones = hijos.map((h) => ({ h, c: colocacionDe(h) })).filter(({ c }) => c && mismaLista(c.posicion, posicion));
  const yaColocadas = new Set(colocaciones.map(({ c }) => claveDe(c)));
  const deEstaPosicion = new Set(colocaciones.map(({ h }) => h.id));
  // `n`: el lugar de la pieza en la lista (desde 1); los elementos de una misma lista comparten llegada.
  const todas = encaje.lista(eje, foco, posicion)
    .map((o, k) => ({ ...o, n: k + 1 }))
    .filter((o) => !(deEscrito(o) && deEstaPosicion.has(o.evento)))
    .map((o) => ({ ...o, clave: claveDe(o), texto: textoPieza(eje, o) }));
  const piezas = todas.filter((p) => !yaColocadas.has(p.clave));
  const clasificadas = todas.filter((p) => yaColocadas.has(p.clave));
  const enLente = new Map(Object.entries(lenteLocal).filter(([k, d]) => piezas.some((p) => p.clave === k) && Number.isInteger(d) && d >= 0 && d < ARIDAD));
  const huecos = [];
  for (let d = 0; d < ARIDAD; d++) {
    const dirHueco = direccion([...posicion, d]);
    const escritos = hijos
      .filter((h) => h.en === dirHueco && (d > 0 || deEstaPosicion.has(h.id)))
      .map((h) => {
        const c = colocacionDe(h);
        const o = { tipo: 'escrito', evento: h.id, camino: [], contenido: h.payload, autor: h.autor };
        if (esReferencia(h.payload)) o.alcanza = encaje.seguir(eje, h.payload);
        return { evento: h.id, autor: h.autor, texto: textoPieza(eje, o), colocacion: Boolean(c && mismaLista(c.posicion, posicion)) };
      });
    huecos.push({
      digito: d,
      nombre: e.reglaCorta(n, d),
      pv: n > 0 ? e.reglaCorta(0, d) : null,
      dir: dirHueco,
      escritos,
      lente: piezas.filter((p) => enLente.get(p.clave) === d),
    });
  }
  const nombre = n ? leerCamino(posicion, e).map((x) => x.digito + ' ' + x.significado).join(' › ') : 'raíz del foco';
  return { foco, posicion: [...posicion], dir, nombre, piezas, clasificadas, huecos, lente: Object.fromEntries(enLente) };
}

/** Lo colocado en la lente para una posición: { clave: hueco }. Solo en este navegador. */
export function lenteDe(foco, posicion) {
  return { ...(lente[claveLente(foco, posicion)] ?? {}) };
}

/** Coloca una pieza en un hueco con la lente: no escribe nada en el eje. */
export function colocarEnLente(foco, posicion, clave, hueco) {
  if (!Number.isInteger(hueco) || hueco < 0 || hueco >= ARIDAD) throw new Error('hueco 0–9');
  const k = claveLente(foco, posicion);
  lente = { ...lente, [k]: { ...(lente[k] ?? {}), [clave]: hueco } };
  guardarLocal(CLAVE_LENTE, JSON.stringify(lente));
  return lenteDe(foco, posicion);
}

/** Devuelve una pieza de la lente a «por clasificar»; sin clave, vacía la lente de la posición. */
export function quitarDeLente(foco, posicion, clave) {
  const k = claveLente(foco, posicion);
  const actual = { ...(lente[k] ?? {}) };
  if (clave === undefined) lente = { ...lente, [k]: {} };
  else {
    delete actual[clave];
    lente = { ...lente, [k]: actual };
  }
  guardarLocal(CLAVE_LENTE, JSON.stringify(lente));
  return lenteDe(foco, posicion);
}

/**
 * Modo crear: escribe la pieza en la subposición `hueco` de la posición, por
 * dirección (`en` = direccion([...posicion, hueco])), con la escritura de
 * Pointed (un terminal, un minuto de T del autor). Es un evento real del
 * eje, firmado si hay clave. contexto.clasifica dice qué pieza clasifica.
 * La pieza ha de estar todavía por clasificar. Devuelve el evento.
 */
export async function escribirColocacion(eje, { foco, posicion, clave, hueco, autor, t, epoca }, privada) {
  if (!Number.isInteger(hueco) || hueco < 0 || hueco >= ARIDAD) throw new Error('hueco 0–9');
  const m = modeloClasificar(eje, foco, posicion, { epoca });
  const pieza = m.piezas.find((p) => p.clave === clave);
  if (!pieza) throw new Error(m.clasificadas.some((p) => p.clave === clave) ? 'esa pieza ya está clasificada' : 'esa pieza no está en la lista de la posición');
  return salida.escribirDesde(eje, {
    modo: 'pointed',
    autor,
    sobre: foco,
    en: m.huecos[hueco].dir,
    payload: elementoDe(pieza),
    ...(t ? { t } : {}),
    contexto: { clasifica: { posicion: [...posicion], evento: pieza.evento, camino: [...pieza.camino], ...(Number.isInteger(pieza.indice) ? { indice: pieza.indice } : {}) } },
  }, privada);
}

// ---------- HTML ----------

function botonPieza(p, sel) {
  const quien = deEscrito(p) ? ' · ' + escapar(p.autor) + ' ' + corto(p.evento) : '';
  const deLista = p.enLista ? ' · en lista' : '';
  return `<li><button type="button" class="cl-pieza" data-pieza="${escapar(p.clave)}" draggable="true" aria-pressed="${sel ? 'true' : 'false'}"
    aria-label="Pieza ${p.n}, por llegada: ${escapar(p.texto)}${sel ? ', elegida' : ''}"><span class="cl-n">${p.n}</span><span class="cl-t">${escapar(p.texto)}${quien}${deLista}</span></button></li>`;
}

function htmlHueco(h, modoVista) {
  const nombre = `<span class="cl-d">${h.digito}</span> ${escapar(h.nombre)}${h.pv ? ` <small>${escapar(h.pv)}</small>` : ''}`;
  const verbo = modoVista === 'crear' ? 'Escribir aquí' : 'Ver con esta lente';
  const escritos = h.escritos.map((x) => `<li class="cl-escrito${x.colocacion ? ' colocado' : ''}"><button type="button" class="chip" data-ir="${x.evento}" title="${x.colocacion ? 'colocación escrita' : 'escrito por dirección'}"><b>${corto(x.evento)}</b> ${escapar(x.texto)}</button></li>`).join('');
  const enLente = modoVista === 'lente' ? h.lente.map((p) => `<li class="cl-en-lente"><span>${escapar(p.texto)}</span> <i>visto como ${escapar(h.nombre)}${h.pv ? ' (' + escapar(h.pv) + ')' : ''}</i>
    <button type="button" class="cl-quitar" data-quitar-lente="${escapar(p.clave)}" aria-label="Devolver «${escapar(p.texto)}» a por clasificar">×</button></li>`).join('') : '';
  const vacio = !escritos && !enLente ? '<li class="cl-vacio">vacío</li>' : '';
  return `<div class="cl-hueco c${h.digito}">
    <button type="button" class="cl-destino" data-hueco="${h.digito}" aria-label="${verbo}: ${h.digito} ${escapar(h.nombre)}${h.pv ? ', ' + escapar(h.pv) : ''} (${h.dir})">${nombre}</button>
    <ul class="cl-dentro">${enLente}${escritos}${vacio}</ul>
  </div>`;
}

/**
 * HTML de la vista: la posición, el conmutador de modo, las piezas por
 * clasificar y la cruceta de diez huecos (dispuesta como la matriz de
 * Mapped, con el 0 debajo). `posiciones`: [{ valor, etiqueta, n }] para
 * cambiar de posición; `identidades` y `identidad` para «crear».
 */
export function htmlClasificar(m, { modo: modoVista = modo, elegida: sel = elegida, posiciones = [], identidades = [], identidad = '', leido = '' } = {}) {
  // En la lente, lo colocado se ve en su hueco y sale de las sueltas; en «crear», la lente no cuenta.
  const sueltas = modoVista === 'lente' ? m.piezas.filter((p) => m.lente[p.clave] === undefined) : m.piezas;
  const chipsPos = posiciones.length ? `<div class="cl-posiciones" role="group" aria-label="Posición que se clasifica">${posiciones.map((x) => `<button type="button" data-pos-clasificar="${x.valor}" aria-pressed="${x.actual ? 'true' : 'false'}">${escapar(x.etiqueta)} <small>${x.n}</small></button>`).join('')}</div>` : '';
  const modos = `<div class="cl-modos" role="group" aria-label="Modo de clasificar">
    <button type="button" data-modo-clasificar="lente" aria-pressed="${modoVista === 'lente'}">Lente · solo ver</button>
    <button type="button" data-modo-clasificar="crear" aria-pressed="${modoVista === 'crear'}">Crear · escribe</button></div>`;
  const quien = modoVista === 'crear' && identidades.length
    ? `<label class="cl-quien">Escribe <select name="identidad">${identidades.map((i) => `<option ${i === identidad ? 'selected' : ''}>${escapar(i)}</option>`).join('')}</select> <small>cada colocación es un registro y mueve 1 minuto de T</small></label>`
    : '';
  const explica = modoVista === 'crear'
    ? 'Colocar una pieza escribe el elemento en esa subposición, por dirección. Es un registro real del eje.'
    : 'Colocar una pieza solo cambia cómo la ves: la interpretas con la lente de ese hueco. No se escribe nada.';
  const elegidaP = m.piezas.find((p) => p.clave === sel);
  const estadoTexto = elegidaP ? `Elegida «${escapar(elegidaP.texto)}»: toca un hueco para colocarla.` : sueltas.length ? 'Toca una pieza y luego un hueco, o arrástrala.' : 'No queda nada por clasificar en esta posición.';
  const vaciar = modoVista === 'lente' && Object.keys(m.lente).length ? '<button type="button" class="cl-quitar-todo" data-quitar-lente="">vaciar la lente</button>' : '';
  const orden = [...mapped.MATRIZ.flat(), 0];
  return `<section class="clasificar" aria-labelledby="cl-titulo">
    <div class="titulo" id="cl-titulo">Clasificar · ${escapar(m.nombre)} · ${m.piezas.length + m.clasificadas.length} en la lista</div>
    ${chipsPos}
    <p class="pista">La lista de una posición está fuera del árbol: sus ocupantes van por llegada y no tienen punto de vista. Una décupla es una sola pieza; cada elemento de una lista de hojas, una. La cruceta es la lente para verlos o para colocarlos.</p>
    ${modos}
    <p class="pista">${explica}</p>
    ${quien}
    <div class="cl-cab">Por clasificar · ${sueltas.length}${m.clasificadas.length ? ` · ya clasificadas ${m.clasificadas.length}` : ''}</div>
    <ul class="cl-piezas" aria-label="Piezas por clasificar">${sueltas.map((p) => botonPieza(p, p.clave === sel)).join('') || '<li class="nada">nada por clasificar</li>'}</ul>
    <div class="cl-estado" role="status" aria-live="polite">${estadoTexto} ${vaciar}</div>
    <div class="cl-cruceta${modoVista === 'crear' ? ' crear' : ''}${elegidaP ? ' esperando' : ''}">${orden.map((d) => htmlHueco(m.huecos[d], modoVista)).join('')}</div>
    ${leido}
  </section>`;
}

/** Las posiciones entre las que elegir: la raíz del camino y sus diez, con cuántos ocupantes tiene cada lista. */
export function posicionesDe(eje, foco, camino, en) {
  const salidaPos = [];
  const actual = en === '' || en === undefined || en === null ? '' : String(en);
  salidaPos.push({ valor: '', etiqueta: camino.length ? camino.join('.') : 'raíz', n: encaje.lista(eje, foco, camino).length, actual: actual === '' });
  if (camino.length < ARIDAD - 1) {
    for (let d = 0; d < ARIDAD; d++) {
      salidaPos.push({ valor: String(d), etiqueta: [...camino, d].join('.'), n: encaje.lista(eje, foco, [...camino, d]).length, actual: actual === String(d) });
    }
  }
  return salidaPos;
}

/** La vista entera para el estado de app.js: la posición en foco es el camino más la posición elegida («en»). */
export function vistaClasificar(estado, { epoca = EPOCA_0 } = {}) {
  const posicion = posicionDe(estado);
  if (posicion.length >= ARIDAD) return '<div class="nada">en la profundidad 10 no quedan subposiciones donde clasificar</div>';
  const m = modeloClasificar(estado.eje, estado.foco, posicion, { epoca, lenteLocal: lenteDe(estado.foco, posicion) });
  if (elegida && !m.piezas.some((p) => p.clave === elegida)) elegida = null;
  return htmlClasificar(m, {
    posiciones: posicionesDe(estado.eje, estado.foco, estado.camino ?? [], estado.en),
    identidades: estado.eje.identidades(),
    identidad: estado.identidad,
    // «leído»: la posición en foco como texto, una línea por posición (src/lectura.js).
    leido: htmlLeido(estado.eje, estado.foco, { epoca, camino: posicion, donde: 'clasificar' }),
  });
}

/**
 * Engancha la vista: elegir pieza, colocarla (tocar o arrastrar), cambiar de
 * modo y de posición. `guardar`, `fallo` y `privadaDe` son los de app.js.
 */
export function instalarClasificar({ estado, pintar, guardar, fallo, privadaDe, epoca = () => EPOCA_0 }) {
  async function colocar(clave, hueco) {
    const posicion = posicionDe(estado);
    elegida = null;
    if (modo === 'lente') {
      colocarEnLente(estado.foco, posicion, clave, hueco);
      estado.aviso = '';
      estado.exito = '';
      pintar();
      return;
    }
    try {
      const ev = await escribirColocacion(estado.eje, { foco: estado.foco, posicion, clave, hueco, autor: estado.identidad, epoca: epoca() }, privadaDe(estado.identidad));
      guardar();
      estado.aviso = '';
      estado.exito = 'Colocado: registrado ' + corto(ev.id) + ' en ' + [...posicion, hueco].join('.') + ' sobre ' + corto(estado.foco) + ' · 1 minuto de T' + (ev.firma ? ' · firmado' : '') + '.';
      pintar();
    } catch (e) {
      fallo(e);
    }
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !b.closest('.clasificar')) return;
    if (b.dataset.modoClasificar) { elegirModoClasificar(b.dataset.modoClasificar); estado.exito = ''; estado.aviso = ''; pintar(); }
    else if (b.dataset.posClasificar !== undefined) { estado.en = b.dataset.posClasificar; elegida = null; pintar(); }
    else if (b.dataset.pieza) { elegida = elegida === b.dataset.pieza ? null : b.dataset.pieza; pintar(); }
    else if (b.dataset.hueco !== undefined && elegida) colocar(elegida, Number(b.dataset.hueco));
    else if (b.dataset.quitarLente !== undefined) {
      quitarDeLente(estado.foco, posicionDe(estado), b.dataset.quitarLente || undefined);
      pintar();
    }
  });
  document.addEventListener('dragstart', (e) => {
    const p = e.target.closest?.('[data-pieza]');
    if (!p || !e.dataTransfer) return;
    e.dataTransfer.setData('text/plain', p.dataset.pieza);
    e.dataTransfer.effectAllowed = 'move';
  });
  document.addEventListener('dragover', (e) => {
    if (e.target.closest?.('.clasificar .cl-hueco')) e.preventDefault();
  });
  document.addEventListener('drop', (e) => {
    const h = e.target.closest?.('.clasificar .cl-hueco');
    if (!h) return;
    e.preventDefault();
    const clave = e.dataTransfer?.getData('text/plain');
    const destino = h.querySelector('[data-hueco]');
    if (clave && destino) colocar(clave, Number(destino.dataset.hueco));
  });
}
