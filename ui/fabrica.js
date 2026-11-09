// Fábrica visible en Mapped. Dos cosas que el motor ya hace y la pantalla no
// enseñaba:
// 1. Proponer (operador B, motor.proponer): construye las elecciones desde
//    lo que dicen las posiciones del foco. Aquí rellena el formulario de
//    consolidación con esas elecciones (candidato, referencia o terminal
//    nuevo) y enseña de dónde sale cada una (orígenes) y lo que no se pudo
//    proponer (pendientes). No escribe nada: consolidar sigue siendo un
//    paso aparte, con el botón de siempre.
// 2. El contexto de cada consolidación: contexto.encaje (de dónde vino cada
//    fuente, con su vector y su signo) y, si existe, contexto.nuevos (los
//    terminales nuevos, que no vienen de ninguna fuente).

import { motor, direccion, indicesDe, esReferencia, encaje, RAIZ } from '../src/index.js';
import { escapar, corto, dirCorta, vectorCorto } from './comun.js';
import { nombrePV } from './epocas.js';

/**
 * Propuesta en curso: la del foco y el camino donde se pidió, con el eje y
 * cuántos registros tenía entonces (los índices 'cK' del formulario y los
 * textos de origen valen para ese estado del eje y no para otro).
 */
let propuesta = null;

const claveDe = (foco, camino) => foco + '#' + camino.join('.');

function dirDeCandidato(c) {
  return direccion(c.camino ?? indicesDe(c.dir));
}

/** Valor del formulario para una elección propuesta en una posición descubierta. */
function valorDe(p, e) {
  if (e && typeof e === 'object' && e.candidato) {
    const c = e.candidato;
    const k = p.candidatos.findIndex((x) => x.evento === c.evento && dirDeCandidato(x) === c.dir && (!c.tipo || x.tipo === c.tipo));
    if (k >= 0) return { valor: 'c' + k, texto: '', como: 'candidato' };
    return { valor: 'nuevo', texto: '@' + corto(c.evento) + ':' + c.dir, como: 'referencia' };
  }
  if (esReferencia(e)) {
    const dir = e.dir ?? RAIZ;
    const k = p.candidatos.findIndex((x) => x.evento === e.ref && dirDeCandidato(x) === dir);
    if (k >= 0) return { valor: 'c' + k, texto: '', como: 'candidato' };
    return { valor: 'nuevo', texto: '@' + corto(e.ref) + (e.dir ? ':' + e.dir : ''), como: 'referencia' };
  }
  return { valor: 'nuevo', texto: String(e), como: 'terminal' };
}

/**
 * Traduce las elecciones de una propuesta a los campos del formulario de
 * consolidación (uno por posición descubierta): `valor` del desplegable
 * ('' nada, 'cK' el candidato K, 'nuevo') y `texto` del terminal nuevo.
 * Un candidato que no está en la lista de esa posición (una fórmula que
 * elige de otra posición) entra como referencia escrita: '@id:dir'.
 * `fuera`: posiciones propuestas que el formulario no tiene.
 */
export function valoresPropuestos(desc, prop) {
  const valores = {};
  for (const p of desc) valores[p.posicion] = { valor: '', texto: '', como: 'nada' };
  const fuera = [];
  for (const [k, e] of Object.entries(prop.elecciones ?? {})) {
    const p = desc.find((x) => x.posicion === Number(k));
    if (!p) fuera.push(Number(k));
    else valores[p.posicion] = valorDe(p, e);
  }
  return { valores, fuera };
}

/** Pide la propuesta para el foco y el camino, y la guarda para rellenar el formulario. */
export function proponerAhora(eje, foco, camino = []) {
  const prop = motor.proponer(eje, foco, { camino });
  const desc = motor.descubrir(eje, foco, { camino });
  const { valores, fuera } = valoresPropuestos(desc, prop);
  propuesta = {
    clave: claveDe(foco, camino), foco, camino: [...camino], prop, valores, fuera,
    eje, registros: eje.orden.length, antes: motor.propuestas(eje, foco, camino).length, recalculada: false,
  };
  return propuesta;
}

/**
 * La propuesta en curso, si vale para este foco, este camino y el eje tal
 * como está ahora; si no, null. Si se ha consolidado algo sobre el foco
 * desde que se pidió, ya se usó y se retira; si el eje es otro (otro
 * ejemplo, reinicio), también. Si el eje solo ha crecido (un escrito, una
 * referencia, una autorización), los candidatos de 1–4 pueden haber
 * cambiado de lugar: se vuelve a pedir, para que el formulario marque el
 * mismo candidato que propone el motor y la caja enseñe los orígenes de ahora.
 */
export function propuestaVigente(eje, foco, camino = []) {
  if (!propuesta || propuesta.clave !== claveDe(foco, camino)) return null;
  if (propuesta.eje !== eje || motor.propuestas(eje, foco, camino).length !== propuesta.antes) { propuesta = null; return null; }
  if (eje.orden.length !== propuesta.registros) {
    try {
      proponerAhora(eje, foco, camino);
      propuesta.recalculada = true;
    } catch {
      propuesta = null;
    }
  }
  return propuesta;
}

export function quitarPropuesta() {
  propuesta = null;
}

export function propuestaEnCurso() {
  return propuesta;
}

/** Botón «proponer» del formulario de consolidación. */
export function botonProponer() {
  return `<div class="proponer"><button type="button" class="accion" data-proponer>proponer</button>
    <span class="pista">rellena las elecciones de arriba desde lo que dicen las posiciones del foco (B); no escribe nada</span></div>`;
}

/**
 * Caja de la propuesta en curso, si es de este foco y este camino: de dónde
 * sale cada elección y qué queda pendiente (ver propuestaVigente: se retira
 * si ya se usó y se recalcula si el eje ha cambiado).
 */
export function cajaPropuesta(eje, foco, camino = []) {
  if (!propuestaVigente(eje, foco, camino)) return '';
  const prof = camino.length;
  const etiqueta = (i) => `<b>${i} ${escapar(nombrePV(i, prof))}</b>`;
  const como = { candidato: 'candidato', referencia: 'referencia escrita', terminal: 'terminal nuevo' };
  const filas = propuesta.prop.origenes.map((o) => {
    const v = propuesta.valores[o.posicion];
    return `<li>${etiqueta(o.posicion)} ← ${o.desde === 'formula' ? 'fórmula' : 'del foco'} · ${escapar(o.texto)}${v ? ' <i>→ ' + (como[v.como] ?? v.como) + '</i>' : ''}</li>`;
  });
  const pendientes = propuesta.prop.pendientes.map((p) => `<li class="pend">${etiqueta(p.posicion)} pendiente · ${escapar(p.motivo)}</li>`);
  const propuestas = new Set([...propuesta.prop.origenes, ...propuesta.prop.pendientes].map((x) => x.posicion));
  const callan = Object.keys(propuesta.valores).map(Number).filter((i) => !propuestas.has(i));
  const fuera = propuesta.fuera.length ? `<li class="pend">fuera del formulario: ${propuesta.fuera.join(', ')}</li>` : '';
  return `<div class="propuesta">
    <div class="titulo">Propuesta · orígenes y pendientes</div>
    ${propuesta.recalculada ? '<div class="pista">recalculada: el eje ha cambiado desde que se pidió</div>' : ''}
    <ul>${filas.join('')}${pendientes.join('')}${fuera}</ul>
    ${callan.length ? `<div class="pista">no proponen (sin desarrollar): ${callan.join(', ')}</div>` : ''}
    ${!filas.length && !pendientes.length ? '<div class="pista">nada que proponer: las posiciones 1–4 del foco están sin desarrollar</div>' : ''}
    <button type="button" class="miga" data-quitar-propuesta>quitar la propuesta</button>
  </div>`;
}

/** Contexto de una consolidación: de dónde vino cada fuente (encaje) y los terminales nuevos (nuevos), si los hay. */
export function contextoConsolidacion(eje, id) {
  const ctx = eje.obtener(id)?.contexto ?? {};
  const fuentes = (ctx.encaje ?? []).map((x) => {
    const v = Array.isArray(x.vector) ? x.vector : null;
    const signo = x.signo ?? (v ? encaje.signo(v) : '');
    const vec = v ? vectorCorto(v) : '';
    return `<li><b>${x.posicion}</b> ← ${escapar(x.tipo ?? 'referencia')} <button class="enlace" data-ir="${escapar(x.evento)}">${corto(x.evento)}</button> desde ${escapar(dirCorta(x.origen))} a ${escapar(dirCorta(x.destino))}${signo ? ' · ' + escapar(signo) : ''}${vec ? ' · vector ' + escapar(vec) : ''}</li>`;
  });
  const nuevos = Array.isArray(ctx.nuevos)
    ? ctx.nuevos.map((x) => `<li><b>${x.posicion}</b> terminal nuevo, sin fuente${x.destino ? ' · a ' + escapar(dirCorta(x.destino)) : ''}</li>`)
    : [];
  if (!fuentes.length && !nuevos.length) return '<div class="ctx"><span class="pista">sin fuentes en su contexto</span></div>';
  return `<div class="ctx"><span class="ctx-t">de dónde vino cada fuente${nuevos.length ? ' · y lo nuevo' : ''}</span><ul>${fuentes.join('')}${nuevos.join('')}</ul></div>`;
}

/** Rellena el formulario de consolidación con la propuesta en curso (tras cada pintado). */
export function trasPintarFabrica(estado) {
  const form = document.querySelector('#consolidar');
  if (!form || !propuestaVigente(estado.eje, estado.foco, estado.camino)) return;
  for (const [pos, v] of Object.entries(propuesta.valores)) {
    const sel = form.elements['e' + pos];
    const txt = form.elements['n' + pos];
    if (sel && [...sel.options].some((o) => o.value === v.valor)) sel.value = v.valor;
    if (txt) txt.value = v.texto;
    if (v.como !== 'nada') sel?.closest('label')?.classList.add('propuesto');
  }
}

/** Botones «proponer» y «quitar la propuesta»: calculan o retiran, y repintan. */
export function instalarFabrica({ estado, pintar }) {
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-proponer], [data-quitar-propuesta]');
    if (!b) return;
    if (b.dataset.proponer !== undefined) {
      try {
        proponerAhora(estado.eje, estado.foco, estado.camino);
        estado.aviso = '';
      } catch (err) {
        estado.aviso = String(err.message ?? err);
      }
    } else {
      quitarPropuesta();
    }
    estado.exito = '';
    pintar();
  });
}
