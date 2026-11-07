// Vista Scened sobria: varios focos en escena con sus aristas, en el
// navegador, sobre src/scened.js. Una fila por foco (posición en el marco
// común, nivel como sangría, autor, representación) y sus aristas como
// enlaces a la fila de destino. Tocar un foco lo pone en el centro de la
// escena; «Mapped» lo abre en Mapped.
//
// Solo lee: Scened no escribe mientras su proporción no esté fijada
// (src/modos.js). Tope duro: 10000 posiciones leídas (scened.TOPE, mapa §12).
// La escena se corta en el primer foco que no cabe y el corte se dice arriba y
// abajo de la lista, nunca en silencio.
//
// Alcances: los dos de scened.escenaDe (hermanos, hilo) y las otras dos
// cohortes del 8 que ya calcula tiempo.comparables (proyecto, general; mapa
// §12, «Cohortes y bases del 8»). En las cuatro el foco va primero y es el
// centro; los demás, por orden de llegada. [X] decidir VG: la prioridad
// cuando hay corte (hoy, el foco y después la llegada).
//
// Las piezas que comparte con el resto del frontend (escapar, acortar) se
// repiten aquí para no depender de ui/comun.js mientras la PR #47 no esté en
// main.

import { escena, escenaDe, TOPE } from '../src/scened.js';
import { comparables } from '../src/tiempo.js';
import { esReferencia } from '../src/btml.js';
import { esFormula, desescapar } from '../src/bql.js';

/** Alcances de la vista, en el orden de los botones. */
export const ALCANCES_VISTA = Object.freeze([
  Object.freeze({ alcance: 'hermanos', nombre: 'hermanos', pista: 'el foco y lo escrito sobre su mismo padre: los comparables del 8' }),
  Object.freeze({ alcance: 'hilo', nombre: 'hilo', pista: 'el foco y sus antecesores hasta el génesis' }),
  Object.freeze({ alcance: 'proyecto', nombre: 'proyecto', pista: 'todo lo que cuelga del proyecto del foco (el registro de su hilo que cuelga del génesis)' }),
  Object.freeze({ alcance: 'general', nombre: 'todo el eje', pista: 'el foco y todos los registros del eje' }),
]);

const NOMBRES = ALCANCES_VISTA.map((a) => a.alcance);
const CLAVE_ALCANCE = 'agram.escena.alcance';
const RAIZ = '0000000000';
/** Sangría máxima: a 400 px, más de seis niveles no caben; el nivel exacto se lee en la fila. */
const SANGRIA_MAXIMA = 6;

function escapar(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function corto(id) {
  return String(id ?? '').slice(0, 8);
}

/** Lo que representa a un foco en una línea: su terminal o su posición 0 (la escena ya lo trae en `representacion`). */
function representar(c) {
  if (c === undefined) return '—';
  if (Array.isArray(c)) return c.length + (c.length === 1 ? ' posición' : ' posiciones');
  if (esReferencia(c)) return '→ ' + corto(c.ref) + (c.dir && c.dir !== RAIZ ? ' : ' + c.dir : '');
  const s = esFormula(c) ? String(c) : String(desescapar(c));
  return s.length > 80 ? s.slice(0, 79) + '…' : s;
}

/**
 * Focos de un alcance, en orden de prioridad: el foco primero y los demás
 * por llegada. 'hermanos' e 'hilo' los elige scened.escenaDe; 'proyecto' y
 * 'general' salen de tiempo.comparables, las mismas cohortes que lee el 8.
 */
export function focosDe(eje, foco, alcance) {
  if (!NOMBRES.includes(alcance)) throw new Error('alcance desconocido: ' + alcance + ' (' + NOMBRES.join(', ') + ')');
  if (alcance === 'hilo') return eje.hilo(foco).map((e) => e.id);
  const resto = comparables(eje, foco, alcance).map((e) => e.id).filter((id) => id !== foco);
  return [foco, ...resto];
}

/**
 * La escena de la vista: la de scened, con el foco como centro. Opciones:
 * alcance, camino (todos los focos se miran desde el mismo camino), ahora y
 * tope (solo para bajarlo en pruebas: scened no deja subirlo de 10000).
 */
export function escenaVista(eje, foco, { alcance = 'hermanos', camino = [], ahora, tope } = {}) {
  const opciones = { camino, ...(ahora !== undefined ? { ahora } : {}), ...(tope !== undefined ? { tope } : {}) };
  if (alcance === 'hermanos' || alcance === 'hilo') return escenaDe(eje, foco, { alcance, ...opciones });
  return { ...escena(eje, focosDe(eje, foco, alcance), { ...opciones, centro: foco }), alcance };
}

function textoArista(x) {
  if (x.tipo === 'hilo') return 'hilo → ' + x.a + (x.saltos > 1 ? ' (' + x.saltos + ' saltos)' : '') + (x.en && x.en !== RAIZ ? ' en ' + x.en : '');
  const donde = x.camino.length ? x.camino.join('.') : 'raíz';
  return (x.tipo === 'formula' ? 'fórmula ' : 'ref ') + donde + ' → ' + x.a + ' : ' + x.dir;
}

function tituloArista(x, e) {
  const destino = e.focos[x.a];
  const quien = corto(destino.id) + ' · ' + destino.autor;
  if (x.tipo === 'hilo') return (x.saltos > 1 ? 'su antecesor en la escena, ' + x.saltos + ' registros más arriba: ' : 'escrito sobre ') + quien;
  if (x.tipo === 'formula') return 'una fórmula de su posición ' + (x.camino.join('.') || 'raíz') + ' lee con REF la ' + x.dir + ' de ' + quien;
  return 'su posición ' + (x.camino.join('.') || 'raíz') + ' es una referencia a la ' + x.dir + ' de ' + quien + ' (no copia)';
}

function filaFoco(f, e) {
  const aristas = f.salen.map((x) => `<a class="arista a-${x.tipo}" href="#escena-${x.a}" title="${escapar(tituloArista(x, e))}">${escapar(textoArista(x))}</a>`).join('');
  const hermanos = 'hermano ' + f.hermano.indice + ' de ' + f.hermano.de + (f.hermanosEnEje > f.hermano.de ? ' (' + f.hermanosEnEje + ' en el eje)' : '');
  const meta = ['n' + f.nivel, hermanos, 'pasado ' + f.tiempo.totalPasado, 'futuro ' + f.tiempo.totalFuturo, ...(f.entran ? ['← ' + f.entran] : [])].join(' · ');
  return `<li class="pieza${f.centro ? ' centro' : ''}" id="escena-${f.posicion}" style="--nivel:${Math.min(f.nivel, SANGRIA_MAXIMA)}">
      <div class="pieza-fila">
        <button class="abrir" data-ir="${escapar(f.id)}" title="poner este foco en el centro de la escena"><span class="n">${f.posicion}</span><span class="quien">${corto(f.id)} · ${escapar(f.autor)}${f.centro ? ' · centro' : ''}</span><span class="rep">${escapar(representar(f.representacion))}</span></button>
        <button class="ref" data-escena-mapped="${escapar(f.id)}" title="abrir este foco en Mapped">Mapped</button>
      </div>
      <div class="meta">${escapar(meta)}</div>
      ${aristas ? `<div class="aristas">${aristas}</div>` : ''}
    </li>`;
}

function avisos(e) {
  return e.avisos.map((a) => `<div class="aviso">${escapar(a)}</div>`).join('');
}

/** HTML sobrio de una escena: alcance, lectura frente al tope, avisos arriba, una fila por foco, recuentos y avisos abajo. */
export function htmlEscena(e) {
  const r = e.recuentos;
  const botones = ALCANCES_VISTA.map((a) => `<button data-alcance="${a.alcance}" aria-pressed="${a.alcance === e.alcance}" title="${escapar(a.pista)}">${escapar(a.nombre)}</button>`).join('');
  const parte = Math.min(100, (r.posicionesLeidas / r.tope) * 100);
  const lectura = `
    <div class="lectura">
      <div class="titulo">Scened · ${r.enEscena} de ${r.pedidos} focos · común ${e.comun ? corto(e.comun) : '—'} · camino ${e.camino.length ? e.camino.join('.') : 'raíz'} · ${escapar(e.epoca)}</div>
      <div class="barra${e.corte ? ' llena' : ''}" role="meter" aria-label="posiciones leídas" aria-valuemin="0" aria-valuemax="${r.tope}" aria-valuenow="${r.posicionesLeidas}"><span style="width:${parte.toFixed(2)}%"></span></div>
      <div class="pista">${r.posicionesLeidas} de ${r.tope} posiciones leídas${r.tope === TOPE ? ' · tope duro de Scened' : ' · tope rebajado'}${r.fuera ? ' · ' + r.fuera + (r.fuera === 1 ? ' foco fuera' : ' focos fuera') : ''}</div>
    </div>`;
  const filas = e.focos.length ? `<ol class="piezas">${e.focos.map((f) => filaFoco(f, e)).join('')}</ol>` : '<div class="nada">ningún foco cabe en la escena</div>';
  const recuentos = `
    <div class="recuentos">
      <div>aristas: hilo ${r.aristas.hilo} · referencia ${r.aristas.referencia} · fórmula ${r.aristas.formula} · a registros fuera de escena ${r.referenciasFuera}</div>
      <div>recuentos: grupos ${r.grupos} · escritos ${r.escritos} · movimientos ${r.movimientos} · posiciones ${r.posicionesDesarrolladas} · pasado ${r.pasado} · futuro ${r.futuro}</div>
    </div>`;
  return `
    <section class="escena" aria-label="escena">
      <div class="alcances" role="group" aria-label="alcance de la escena">${botones}</div>
      ${lectura}
      ${avisos(e)}
      ${filas}
      ${e.corte ? avisos(e) : ''}
      ${recuentos}
      <div class="pista">Scened solo lee: aquí no se escribe mientras su proporción no esté fijada. Tocar un foco lo pone en el centro; «Mapped» lo abre en Mapped; una arista lleva a la fila de su destino.</div>
    </section>`;
}

// ---------- en el navegador ----------

let alcanceVista = null;

function alcanceGuardado() {
  try {
    const a = globalThis.localStorage?.getItem(CLAVE_ALCANCE);
    return NOMBRES.includes(a) ? a : 'hermanos';
  } catch {
    return 'hermanos';
  }
}

/** La vista Scened del foco, lista para #vista. Si algo falla, lo dice en vez de dejar la vista vacía. */
export function vistaEscena(eje, foco, { camino = [], alcance } = {}) {
  alcanceVista ??= alcanceGuardado();
  try {
    return htmlEscena(escenaVista(eje, foco, { alcance: alcance ?? alcanceVista, camino }));
  } catch (err) {
    return `<div class="aviso">No se puede componer la escena: ${escapar(err.message ?? err)}</div>`;
  }
}

let instalada = false;

/**
 * Enganche con app.js, una sola vez: los botones de alcance repintan y
 * «Mapped» abre el foco en Mapped. El resto (tocar un foco) ya lo hace el
 * data-ir de app.js.
 */
export function instalarEscena({ estado, pintar, irA }) {
  if (instalada) return;
  instalada = true;
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest?.('button');
    if (!b) return;
    if (b.dataset.alcance !== undefined) {
      alcanceVista = NOMBRES.includes(b.dataset.alcance) ? b.dataset.alcance : 'hermanos';
      try { globalThis.localStorage?.setItem(CLAVE_ALCANCE, alcanceVista); } catch { /* sin almacenamiento */ }
      pintar();
    } else if (b.dataset.escenaMapped !== undefined) {
      estado.modo = 'mapped';
      irA(b.dataset.escenaMapped);
    }
  });
}
