// Vista Scened sobria: varios focos en escena con sus aristas, en el
// navegador, sobre src/scened.js. Una fila por foco (posición en el marco
// común, nivel como sangría, autor, representación) y sus aristas como
// enlaces a la fila de destino. Tocar un foco lo pone en el centro de la
// escena; «Mapped» lo abre en Mapped.
//
// Solo lee: Scened no escribe mientras su proporción no esté fijada
// (src/modos.js). Lo que la escena trae se cuenta contra el máximo de
// src/scened.js (CAPACIDAD = maximo('scened') = 10000 posiciones). Es tope
// duro (VG, 7-11 noche: los mismos máximos para representar y emitir); la
// opción `capacidad` solo puede bajarlo. Los mismos números valen para lo que
// emite la fábrica (§12). La escena se
// corta en el primer foco que no cabe y el corte se dice arriba y abajo de la
// lista, nunca en silencio.
//
// Alcances: los cuatro de scened.escenaDe, en su orden (hermanos, proyecto,
// general, hilo); los tres primeros son las cohortes del 8 que calcula
// tiempo.comparables. El foco va primero y es el centro; los demás, por
// llegada. [X] decidir VG: la prioridad cuando hay corte.

import { escenaDe, textoMedidas, CAPACIDAD, ALCANCES } from '../src/scened.js';
import { esReferencia } from '../src/btml.js';
import { esFormula, desescapar } from '../src/bql.js';
import { escapar, corto, leerLocal, guardarLocal } from './comun.js';

/** Alcances de la vista, en el orden de los botones (el de scened.ALCANCES). */
export const ALCANCES_VISTA = Object.freeze([
  Object.freeze({ alcance: 'hermanos', nombre: 'hermanos', pista: 'el foco y lo escrito sobre su mismo padre: los comparables del 8' }),
  Object.freeze({ alcance: 'proyecto', nombre: 'proyecto', pista: 'todo lo que cuelga del proyecto del foco (el registro de su hilo que cuelga del génesis)' }),
  Object.freeze({ alcance: 'general', nombre: 'todo el eje', pista: 'el foco y todos los registros del eje' }),
  Object.freeze({ alcance: 'hilo', nombre: 'hilo', pista: 'el foco y sus antecesores hasta el génesis' }),
]);

const NOMBRES = ALCANCES_VISTA.map((a) => a.alcance);
const CLAVE_ALCANCE = 'agram.escena.alcance';
const RAIZ = '0000000000';
/** Sangría máxima: a 400 px, más de seis niveles no caben; el nivel exacto se lee en la fila. */
const SANGRIA_MAXIMA = 6;

/** El ancla de la fila de un foco: por id, no por posición, para que no cambie al recentrar. */
const ancla = (id) => 'escena-' + id;

/** Lo que representa a un foco en una línea: su terminal (un terminal no tiene posición 0) o su posición 0. */
export function representacion(f) {
  return f.mapa.terminal ?? f.mapa.celdas[0]?.contenido;
}

function representar(c) {
  if (c === undefined) return '—';
  if (Array.isArray(c)) return c.length + (c.length === 1 ? ' posición' : ' posiciones');
  if (esReferencia(c)) return '→ ' + corto(c.ref) + (c.dir && c.dir !== RAIZ ? ' : ' + c.dir : '');
  const s = esFormula(c) ? String(c) : String(desescapar(c));
  return s.length > 80 ? s.slice(0, 79) + '…' : s;
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
  const aristas = f.salen.map((x) => `<a class="arista a-${x.tipo}" href="#${ancla(x.aId)}" title="${escapar(tituloArista(x, e))}">${escapar(textoArista(x))}</a>`).join('');
  const hermanos = 'hermano ' + f.hermano.indice + ' de ' + f.hermano.de + (f.hermanosEnEje > f.hermano.de ? ' (' + f.hermanosEnEje + ' en el eje)' : '');
  const meta = ['n' + f.nivel, hermanos, 'pasado ' + f.tiempo.totalPasado, 'futuro ' + f.tiempo.totalFuturo, ...(f.entran ? ['← ' + f.entran] : [])].join(' · ');
  return `<li class="pieza${f.centro ? ' centro' : ''}" id="${ancla(f.id)}" style="--nivel:${Math.min(f.nivel, SANGRIA_MAXIMA)}">
      <div class="pieza-fila">
        <button class="abrir" data-ir="${escapar(f.id)}" title="poner este foco en el centro de la escena"><span class="n">${f.posicion}</span><span class="quien">${corto(f.id)} · ${escapar(f.autor)}${f.centro ? ' · centro' : ''}</span><span class="rep">${escapar(representar(representacion(f)))}</span></button>
        <button class="ref" data-escena-mapped="${escapar(f.id)}" title="abrir este foco en Mapped">Mapped</button>
      </div>
      <div class="meta">${escapar(meta)}</div>
      ${aristas ? `<div class="aristas">${aristas}</div>` : ''}
    </li>`;
}

function avisos(e) {
  return e.avisos.map((a) => `<div class="aviso">${escapar(a)}</div>`).join('');
}

/** Qué capacidad se aplica, en palabras. */
function textoCapacidad(c) {
  return c === CAPACIDAD ? 'máximo de Scened (' + CAPACIDAD + ', tope duro)' : 'capacidad bajada (máximo ' + CAPACIDAD + ')';
}

/**
 * La suma de medidas del 8 de la escena (VG, 8-11: medidas perezosas): si
 * ya se pidió, sus números (scened.medidasDeEscena, la misma medida que la
 * celda 8); si no, un botón que la pide. Componer la escena no mide nada.
 */
export function htmlMedidas(m) {
  if (m) return `<div class="medidas-escena">${escapar(textoMedidas(m))}</div>`;
  return `<div class="medidas-escena"><button type="button" data-escena-medidas aria-pressed="false" title="medir cada foco en escena con la medida del 8: cuesta una medida por foco">medir la escena</button> <span class="pista">medidas del 8 bajo demanda</span></div>`;
}

/** HTML sobrio de una escena: alcance, lectura frente a la capacidad, avisos arriba, una fila por foco, recuentos, medidas del 8 (bajo demanda) y avisos abajo. */
export function htmlEscena(e) {
  const r = e.recuentos;
  const botones = ALCANCES_VISTA.map((a) => `<button data-alcance="${a.alcance}" aria-pressed="${a.alcance === e.alcance}" title="${escapar(a.pista)}">${escapar(a.nombre)}</button>`).join('');
  const finita = r.capacidad !== Infinity;
  const parte = finita ? Math.min(100, (r.posicionesEnEscena / r.capacidad) * 100) : 0;
  const barra = finita
    ? `<div class="barra${e.corte ? ' llena' : ''}" role="meter" aria-label="posiciones en escena" aria-valuemin="0" aria-valuemax="${r.capacidad}" aria-valuenow="${r.posicionesEnEscena}"><span style="width:${parte.toFixed(2)}%"></span></div>`
    : '';
  const lectura = `
    <div class="lectura">
      <div class="titulo">Scened · ${r.enEscena} de ${r.pedidos} focos · común ${e.comun ? corto(e.comun) : '—'} · camino ${e.camino.length ? e.camino.join('.') : 'raíz'} · ${escapar(e.epoca)}</div>
      ${barra}
      <div class="pista">${r.posicionesEnEscena}${finita ? ' de ' + r.capacidad : ''} posiciones en escena · ${escapar(textoCapacidad(r.capacidad))}${r.fuera ? ' · ' + r.fuera + (r.fuera === 1 ? ' foco fuera' : ' focos fuera') : ''}</div>
    </div>`;
  const filas = e.focos.length ? `<ol class="piezas">${e.focos.map((f) => filaFoco(f, e)).join('')}</ol>` : '<div class="nada">ningún foco cabe en la escena</div>';
  const recuentos = `
    <div class="recuentos">
      <div>aristas: hilo ${r.aristas.hilo} · referencia ${r.aristas.referencia} · fórmula ${r.aristas.formula} · a registros fuera de escena ${r.referenciasFuera}</div>
      <div>recuentos: grupos ${r.grupos} · pasado ${r.pasado} · futuro ${r.futuro}</div>
      ${htmlMedidas(r.medidas)}
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
let medirPara = null; // la escena (foco, alcance y camino) cuyas medidas del 8 se han pedido

function alcanceGuardado() {
  const a = leerLocal(CLAVE_ALCANCE);
  return NOMBRES.includes(a) ? a : 'hermanos';
}

const claveEscena = (foco, alcance, camino) => foco + '|' + alcance + '|' + camino.join('.');

/**
 * La vista Scened del foco, lista para #vista. Si algo falla, lo dice en vez
 * de dejar la vista vacía. Las medidas del 8 solo se calculan si se piden
 * (`medidas: true`, o el botón «medir la escena» para esta misma escena).
 */
export function vistaEscena(eje, foco, { camino = [], alcance, medidas } = {}) {
  alcanceVista ??= alcanceGuardado();
  const a = alcance ?? alcanceVista;
  try {
    return htmlEscena(escenaDe(eje, foco, { alcance: a, camino, medidas: medidas ?? medirPara === claveEscena(foco, a, camino) }));
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
      guardarLocal(CLAVE_ALCANCE, alcanceVista);
      pintar();
    } else if (b.dataset.escenaMedidas !== undefined) {
      medirPara = claveEscena(estado.foco, alcanceVista ?? alcanceGuardado(), estado.camino ?? []);
      pintar();
    } else if (b.dataset.escenaMapped !== undefined) {
      estado.modo = 'mapped';
      irA(b.dataset.escenaMapped);
    }
  });
}

// Comprobación: el orden de los botones es el de scened.ALCANCES.
if (NOMBRES.join() !== ALCANCES.join()) throw new Error('ui/escena.js: los alcances de la vista no son los de src/scened.js');
