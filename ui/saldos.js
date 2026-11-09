// Saldos por series, en corto. Cada familia de tokens es una serie (VG,
// 7-11): T por escala (una hora no son sesenta minutos), E por emisor y
// denominación, P por ámbito, R por emisor. Por cada identidad, una línea
// con lo que es (persona o cosa, por quién escribió su alta), la huella de su clave y lo que tiene de cada familia; debajo,
// las series emitidas (eje.series()): quién emite cada una, cuánto ha
// emitido y cuánto queda en carteras (lo demás se ha consumido).

import { autoridad, ESCALAS_T, PARTES_T, AMBITO_GENESIS } from '../src/index.js';
import { escapar, corto } from './comun.js';

const ESCALA = Object.freeze({ segundo: 's', minuto: 'min', hora: 'h', dia: 'd', semana: 'sem', ciclo: 'cic', anio: 'a' });
/** Semana, ciclo y año van en partes diarias (VG, 8-11): «3/7» o, si cuadra, el entero. */
const cantidadT = (x) => { const n = PARTES_T[x.escala]; return !n ? x.cantidad : x.cantidad % n === 0 ? x.cantidad / n : x.cantidad + '/' + n; };

/** Ids de registro dentro de un nombre de serie (una plaza por noche lleva el de su habitación), en corto. */
const sinIdsLargos = (t) => String(t).replace(/[0-9a-f]{64}/g, (id) => corto(id));
const denominacion = (d) => (d === 'EUR' ? '€' : sinIdsLargos(d));
const ambito = (a) => (a === AMBITO_GENESIS ? 'eje' : corto(a));
/** Por familia, cuántas series se ven de entrada; el resto se despliega. */
const A_LA_VISTA = 3;
/** Con más series emitidas que estas, la tabla empieza plegada. */
const TABLA_ABIERTA_HASTA = 10;

/** Las cuatro familias de una identidad, cada una como lista de textos cortos (vacía si no tiene). */
export function familiasDe(eje, id) {
  return {
    // De la escala mayor a la menor: es lo primero que se lee.
    T: eje.tiempos(id).slice().reverse().map((x) => cantidadT(x) + ' ' + (ESCALA[x.escala] ?? x.escala)),
    E: eje.recursos(id).map((x) => x.cantidad + ' ' + denominacion(x.denominacion) + (x.emisor === id ? '' : ' de ' + x.emisor)),
    P: eje.poderes(id).map((x) => x.cantidad + ' sobre ' + ambito(x.ambito) + (x.origen && x.origen !== id ? ' de ' + x.origen : '')),
    R: eje.reputaciones(id).map((x) => x.cantidad + ' de ' + x.emisor),
  };
}

/** Texto corto de una serie emitida: 'hora', 'casa/EUR', 'eje', 'casa'. */
export function nombreSerie(s) {
  if (s.token === 'P') return ambito(s.ambito ?? s.serie) + (s.origen ? ' (' + s.origen + ')' : '');
  if (s.token === 'E') return s.emisor + '/' + denominacion(s.denominacion);
  return s.serie;
}

/** Lo que queda de una serie en todas las carteras; lo emitido menos esto se ha consumido. */
export function enCarteras(eje, clave) {
  return eje.identidades().reduce((suma, id) => suma + eje.saldo(id, clave), 0);
}

/**
 * Lo plegado que el visor abrió sigue abierto al repintar: se mira en la
 * página (si la hay) antes de rehacerla. En Node no hay página: vale lo de
 * por defecto.
 */
function abierto(clave, porDefecto) {
  const previo = [...(globalThis.document?.querySelectorAll('#saldos details[data-plegado]') ?? [])].find((d) => d.dataset.plegado === clave);
  return previo ? previo.open : porDefecto;
}

function chips(id, familia, lista) {
  if (!lista.length) return `<span class="fam cero"><b>${familia}</b> 0</span>`;
  const vista = `<span class="fam"><b>${familia}</b> ${lista.slice(0, A_LA_VISTA).map(escapar).join(' · ')}</span>`;
  if (lista.length <= A_LA_VISTA) return vista;
  const resto = lista.slice(A_LA_VISTA);
  const clave = id + '|' + familia;
  return vista + `<details class="fam-mas" data-plegado="${escapar(clave)}" ${abierto(clave, false) ? 'open' : ''}><summary>+${resto.length} de ${familia}</summary><span class="fam">${resto.map(escapar).join(' · ')}</span></details>`;
}

/** HTML de los saldos y de las series emitidas. */
export function htmlSaldos(eje) {
  const carteras = eje.identidades().map((id) => {
    const f = familiasDe(eje, id);
    const clave = eje.clave(id);
    const persona = typeof eje.esPersona === 'function' ? eje.esPersona(id) : null;
    const tipo = persona === true ? 'persona' : persona === false ? 'cosa' : null; // B1: por quién escribió su alta
    return `<div class="cartera">
      <div class="quien"><b>${escapar(id)}</b>${tipo ? ` <span>${escapar(tipo)}</span>` : ''} <span class="huella">${clave ? 'clave ' + escapar(autoridad.huella(clave)) : 'sin clave'}</span></div>
      <div class="fams">${['T', 'E', 'P', 'R'].map((x) => chips(id, x, f[x])).join('')}</div>
    </div>`;
  }).join('');
  const orden = ['T', 'E', 'P', 'R'];
  const series = eje.series().slice().sort((a, b) => (orden.indexOf(a.token) - orden.indexOf(b.token))
    || (a.token === 'T' ? ESCALAS_T.indexOf(b.escala) - ESCALAS_T.indexOf(a.escala) : 0));
  const filas = series.map((s) => {
    const quedan = enCarteras(eje, s.clave);
    return `<tr><td><b>${s.token}</b> ${escapar(nombreSerie(s))}</td><td>${escapar(s.emisor ?? '—')}</td><td>${s.emitido}</td><td>${quedan}</td></tr>`;
  }).join('');
  const porFamilia = orden.map((t) => [t, series.filter((x) => x.token === t).length]).filter(([, n]) => n).map(([t, n]) => t + ' ' + n).join(' · ');
  return `<div class="carteras">${carteras}</div>
    <details class="series-emitidas" data-plegado="series" ${abierto('series', series.length <= TABLA_ABIERTA_HASTA) ? 'open' : ''}>
      <summary>Series emitidas · ${series.length}${porFamilia ? ' (' + porFamilia + ')' : ''}</summary>
      <table class="series">
        <thead><tr><th>serie</th><th>emisor</th><th>emitido</th><th>en carteras</th></tr></thead>
        <tbody>${filas || '<tr><td colspan="4">ninguna</td></tr>'}</tbody>
      </table>
    </details>`;
}
