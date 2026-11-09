// Mundo de la fábrica (PV4): la primera pieza de la X (mapa §12 [D]: la
// fábrica es la confluencia de 7 y 9).
//
// Qué se ve: la matriz 10×10×10 del foco como diez LÍNEAS DE MONTAJE, una por
// posición (0 lente … 9 camino), cada una con diez puestos, uno por
// subposición. Los puestos ocupados son la matriz de 100 del foco, que ya
// está y no se emite (mapa §12 [D]). Lo que se escribe sobre el foco son
// PIEZAS en la línea: una por celda modificada (i.j.k), con la forma de su
// clase de modificación k, el tercer dígito desde el camino (mapa §13 [D]:
// la matriz es relativa al camino; la clase es el dígito en la profundidad
// n+2). Debajo, dos ESTACIONES (encargo 3b: el ciclo es una sola
// operación, registrar, y los estados son lecturas; VG, 8-11, mapa §15 [D]):
// «abierta», las propuestas de la fábrica a las que aún les falta lo que
// anuncian, y «cerrada», las que su plantilla de cerrado da por cerradas.
//
// Qué se anima, solo si el evento es nuevo para quien mira:
// - una pieza avanza por su línea desde el principio hasta su puesto: el
//   registro que modifica esa celda (los registros del motor no son piezas:
//   el catálogo no los lee celda a celda; son las cajas);
// - una caja entra en «abierta» (la propuesta) y pasa a «cerrada» con el
//   último registro que cada parte escribe sobre ella (su movimiento).
// Cada elemento animado lleva data-evento y data-efecto (el nombre del
// catálogo de la PR #45 visto desde la fábrica).
//
// De dónde sale cada cosa: las celdas, con su posición, subposición y clase,
// de src/efectos.js (efectosDe con el camino del foco como marco: la clase
// es claseRelativa(celda, camino), el dígito n+2); las estaciones, de
// src/motor.js (propuestas, con su lectura de cerrado). Aquí no se calcula
// ninguna celda ni se escribe nada.
//
// [X] decidir VG (abierto en este mundo):
// - leer lo escrito sobre el foco desde el camino de quien mira: el registro
//   no guarda desde qué camino se escribió (marca del marco leído, catálogo);
//   lo anclado fuera del camino no sale en sus líneas;
// - varias piezas del mismo registro en la misma celda son una sola pieza;
// - las clases 5 a 9 no tienen nombre (catálogo, «clases»): se dibujan como
//   hexágonos sin rótulo.

import { ARIDAD } from '../../src/btml.js';
import { efectosDe } from '../../src/efectos.js';
import { propuestas, cierre } from '../../src/motor.js';
import {
  escapar, n1, corto, recorte, baseDe, nombreEn, nombreMundo, ritmo, atributos, ordenPlano, cabeLaMatriz, textoCorto,
} from './comun.js';

/** Las dos estaciones, en orden: la lectura de cerrado de cada propuesta (motor.cerrado). */
export const ESTACIONES = Object.freeze([
  Object.freeze({ nombre: 'abierta', fase: 'consolidado', estado: 'abierta' }),
  Object.freeze({ nombre: 'cerrada', fase: 'consolidado', estado: 'cerrada' }),
]);

/** Forma de cada clase de modificación (0–9): la de la pieza en la línea. */
export const FORMAS = Object.freeze(['circulo', 'rombo', 'hoja', 'gota', 'cuadrado', 'hexagono', 'hexagono', 'hexagono', 'hexagono', 'hexagono']);

const TIPOS_DE_CELDA = new Set(['ver', 'sustituir', 'escrito', 'anclado', 'impulso', 'modificar']);

/** Si el foco tiene algo en el puesto [i][j]: los ceros finales nombran la colisión (4.0 alcanza la posición 4; 0.0 la raíz). */
export function hayPuesto(base, i, j) {
  const camino = [i, j];
  while (camino.length && camino[camino.length - 1] === 0) camino.pop();
  if (!camino.length) return base !== undefined;
  let nodo = base;
  for (const x of camino) {
    if (!Array.isArray(nodo)) return false;
    nodo = nodo[x];
  }
  return nodo !== undefined;
}

/**
 * Lo que dibuja la fábrica de un foco (bajo `camino`): las diez líneas con
 * sus puestos (la matriz de 100 del foco) y sus piezas (las celdas que
 * modifican los registros escritos sobre el foco), y las cajas de las
 * consolidaciones en sus estaciones. No escribe nada.
 */
export function datosFabrica(eje, foco, { camino = [] } = {}) {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  const base = baseDe(ev.payload, camino);
  const cabe = cabeLaMatriz(camino);
  const lineas = Array.from({ length: ARIDAD }, (_, i) => ({
    i, mundo: nombreMundo(i),
    puestos: cabe ? Array.from({ length: ARIDAD }, (_, j) => j).filter((j) => hayPuesto(base, i, j)) : [],
    piezas: [],
  }));

  const vistas = new Set();
  const enElCamino = (marco) => marco.length === camino.length && marco.every((x, k) => x === camino[k]);
  if (cabe) {
    for (const h of eje.sobre(foco)) {
      // Leído desde el camino del foco: lo que no está en él vuelve leído desde la raíz y no es de estas líneas.
      for (const ef of efectosDe(eje, h, { marco: camino })) {
        if (!TIPOS_DE_CELDA.has(ef.tipo) || !enElCamino(ef.marco)) continue;
        const clave = h.id + ':' + ef.etiqueta;
        if (vistas.has(clave)) continue;
        vistas.add(clave);
        lineas[ef.posicion].piezas.push({
          evento: h.id, autor: h.autor, i: ef.posicion, j: ef.subposicion, k: ef.clase, clase: ef.clase,
          forma: FORMAS[ef.clase], tipo: ef.tipo, celda: ef.celda, ...nombreEn(ef, 4),
        });
      }
    }
  }

  const cajas = propuestas(eje, foco, camino).map((c) => {
    // Lo que cada parte escribió sobre la propuesta: sus movimientos (cada uno mueve lo suyo).
    const partes = eje.sobre(c.id).map((x) => ({ id: x.id, autor: x.autor, movimientos: x.movimientos.filter((m) => m.token !== 'T').map((m) => ({ ...m })) }));
    const estacion = c.cerrado === true ? 1 : 0;
    return {
      consolidacion: c.id, autor: c.autor, titulo: textoCorto(c.titulo), estado: ESTACIONES[estacion].estado, cerrado: c.cerrado,
      estacion, partes, ultima: partes.find((p) => p.id === cierre(eje, c.id)?.id) ?? partes[partes.length - 1] ?? null,
    };
  });

  return {
    foco, camino: [...camino], cabe, lineas, cajas,
    totalPiezas: lineas.reduce((n, l) => n + l.piezas.length, 0),
    efectosEstacion: Object.fromEntries(ESTACIONES.map((e) => [e.nombre, nombreEn({ tipo: 'fase', fase: e.fase }, 4)])),
    orden: ordenPlano(eje),
  };
}

// ---------- render ----------

function geometria(compacto) {
  return compacto
    ? { W: 120, H: 96, top: 2, fila: 6.2, x0: 4, x1: 117, puesto: [9, 4.6], r: 2.3, cajasY: 69, caja: [35, 24], cajasX: [3, 43, 83], cubo: 5, etiquetas: false }
    : { W: 400, H: 276, top: 16, fila: 17, x0: 62, x1: 394, puesto: [24, 12], r: 4.4, cajasY: 214, caja: [104, 52], cajasX: [62, 177, 292], cubo: 11, etiquetas: true };
}

/** La forma de una clase, centrada en 0,0, de radio r. */
function forma(nombre, r, clase) {
  const k = `class="x-forma x-k${clase}"`;
  if (nombre === 'rombo') return `<path ${k} d="M0 ${-r * 1.25}L${r * 1.25} 0L0 ${r * 1.25}L${-r * 1.25} 0Z"/>`;
  if (nombre === 'hoja') return `<path ${k} d="M0 ${-r * 1.3}Q${r * 1.2} 0 0 ${r * 1.1}Q${-r * 1.2} 0 0 ${-r * 1.3}Z"/>`;
  if (nombre === 'gota') return `<path ${k} d="M0 ${-r * 1.35}Q${r * 1.15} ${r * 0.1} 0 ${r * 1.05}Q${-r * 1.15} ${r * 0.1} 0 ${-r * 1.35}Z"/>`;
  if (nombre === 'cuadrado') return `<rect ${k} x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}" rx="${r * 0.25}"/>`;
  if (nombre === 'hexagono') {
    const p = [0, 1, 2, 3, 4, 5].map((a) => `${n1(r * Math.cos((Math.PI / 3) * a))} ${n1(r * Math.sin((Math.PI / 3) * a))}`);
    return `<path ${k} d="M${p.join('L')}Z"/>`;
  }
  return `<circle ${k} r="${r}"/>`;
}

/**
 * El SVG de la fábrica, como texto. Función pura.
 *   datos: lo que devuelve datosFabrica().
 *   compacto: sin rótulos, para la celda 4 de Mapped.
 *   nuevos: Set de ids de evento que se animan (memoria().nuevos).
 */
export function svgFabrica(datos, { compacto = false, nuevos = new Set() } = {}) {
  const g = geometria(compacto);
  const r = ritmo(datos.orden, nuevos);
  const paso = (g.x1 - g.x0) / ARIDAD;
  const xSlot = (j) => g.x0 + paso * (j + 0.5);
  const yFila = (i) => g.top + g.fila * i + g.fila / 2;
  const capas = { lineas: [], puestos: [], piezas: [], estaciones: [], cajas: [] };

  if (g.etiquetas) {
    for (let j = 0; j < ARIDAD; j++) capas.lineas.push(`<text class="x-rotulo x-col" x="${n1(xSlot(j))}" y="9">${j}</text>`);
  }
  for (const l of datos.lineas) {
    const y = yFila(l.i);
    const propia = l.i === 4 ? ' x-propia' : '';
    capas.lineas.push(`<line class="x-cinta${propia}" x1="${g.x0}" y1="${n1(y)}" x2="${g.x1}" y2="${n1(y)}"/>`);
    if (g.etiquetas) {
      capas.lineas.push(`<text class="x-rotulo x-linea${propia}" x="4" y="${n1(y + 3)}">${l.i} ${escapar(recorte(l.mundo.replace(/^hilos del /, ''), 10))}</text>`);
    }
    for (const j of l.puestos) {
      const [w, h] = g.puesto;
      capas.puestos.push(`<rect class="x-puesto" x="${n1(xSlot(j) - w / 2)}" y="${n1(y - h / 2)}" width="${w}" height="${h}" rx="${compacto ? 1 : 2}"><title>${escapar(`puesto ${l.i}.${j} del foco: ya está, no se emite`)}</title></rect>`);
    }
    // Piezas: las del mismo puesto, en fila; si no caben, un contador.
    const porPuesto = new Map();
    for (const p of l.piezas) {
      if (!porPuesto.has(p.j)) porPuesto.set(p.j, []);
      porPuesto.get(p.j).push(p);
    }
    const caben = compacto ? 2 : 3;
    for (const [j, lista] of porPuesto) {
      lista.slice(0, caben).forEach((p, n) => {
        const desplaza = (n - (Math.min(lista.length, caben) - 1) / 2) * g.r * 2.3;
        const x = xSlot(j) + desplaza;
        const nuevo = r.es(p.evento);
        const viaje = n1(g.x0 - x);
        const ver = p.tipo === 'ver' ? ' x-ver' : '';
        const titulo = `${p.nombre} · celda ${p.i}.${p.j}.${p.k} (clase ${p.k}) · ${p.autor} · ${corto(p.evento)}`;
        capas.piezas.push(`<g transform="translate(${n1(x)} ${n1(yFila(l.i))})"><g class="x-pieza${ver}${nuevo ? ' x-nuevo x-avanza' : ''}" data-ir="${escapar(p.evento)}" ${atributos(p.evento, p, 4, ` data-celda="${p.i}.${p.j}.${p.k}"${nuevo ? ` style="--dx:${viaje}px;${r.estilo(p.evento)}"` : ''}`)}>`
          + `<title>${escapar(titulo)}</title><circle class="x-toque" r="${g.r + (compacto ? 2 : 4)}"/>${forma(p.forma, g.r, p.clase)}</g></g>`);
      });
      if (lista.length > caben) {
        capas.piezas.push(`<text class="x-rotulo x-mas" x="${n1(xSlot(j) + paso / 2 - 1)}" y="${n1(yFila(l.i) - g.r - 1)}" text-anchor="end">+${lista.length - caben}</text>`);
      }
    }
  }

  // Estaciones: abierta → cerrada, enlazadas a la línea 4 (la propia de la fábrica).
  const [cw, ch] = g.caja;
  const yE = g.cajasY;
  if (!compacto) {
    capas.estaciones.push(`<path class="x-enlace" d="M${g.x0 - 4} ${n1(yFila(4))}H${g.x0 - 12}V${yE + ch / 2}H${g.cajasX[0]}"/>`);
  }
  ESTACIONES.forEach((e, s) => {
    const x = g.cajasX[s];
    const cuantas = datos.cajas.filter((c) => c.estacion === s).length;
    const ef = datos.efectosEstacion[e.nombre];
    capas.estaciones.push(`<g class="x-estacion${cuantas ? ' x-ocupada' : ''}" data-estacion="${e.nombre}" data-efecto="${escapar(ef.nombre)}"${ef.decision ? ` data-decision="${escapar(ef.decision)}"` : ''}>`
      + `<title>${escapar(`${e.nombre}: ${cuantas} ${cuantas === 1 ? 'propuesta' : 'propuestas'}`)}</title>`
      + `<rect class="x-nave" x="${x}" y="${yE}" width="${cw}" height="${ch}" rx="${compacto ? 2 : 4}"/>`
      + `<circle class="x-luz" cx="${x + cw - (compacto ? 4 : 8)}" cy="${yE + (compacto ? 4 : 8)}" r="${compacto ? 2 : 3.5}"/>`
      + (g.etiquetas ? `<text class="x-rotulo x-estacion-nombre" x="${x + 6}" y="${yE + 12}">${e.nombre} · ${cuantas}</text>` : '')
      + '</g>');
    if (s < ESTACIONES.length - 1) {
      const xa = x + cw;
      const xb = g.cajasX[s + 1];
      capas.estaciones.push(`<path class="x-flecha" d="M${xa + 1} ${yE + ch / 2}H${xb - 2}M${xb - (compacto ? 3 : 5)} ${yE + ch / 2 - (compacto ? 2 : 4)}L${xb - 1} ${yE + ch / 2}L${xb - (compacto ? 3 : 5)} ${yE + ch / 2 + (compacto ? 2 : 4)}"/>`);
    }
  });

  // Cajas: cada propuesta en la estación de su lectura; si es nueva, entra; si su última parte es nueva, pasa.
  const enEstacion = ESTACIONES.map(() => 0);
  const caben = compacto ? 4 : 7;
  const distancia = g.cajasX[1] - g.cajasX[0];
  for (const c of datos.cajas) {
    const s = c.estacion;
    const n = enEstacion[s]++;
    if (n >= caben) continue;
    const x = g.cajasX[s] + (compacto ? 3 : 7) + n * (g.cubo + (compacto ? 2 : 3));
    const y = yE + ch - g.cubo - (compacto ? 3 : 8);
    const titulo = `${c.titulo} · ${c.autor} · ${c.estado.toLowerCase()} · ${corto(c.consolidacion)}`;
    let caja = `<rect class="x-caja x-e${s}" width="${g.cubo}" height="${g.cubo}" rx="${compacto ? 1 : 2}"/>`;
    // La última parte que cierra la propuesta, si es nueva, la hace pasar de «abierta» a «cerrada».
    if (c.ultima && s === 1 && r.es(c.ultima.id)) {
      caja = `<g class="x-nuevo x-pasa" style="--dx:${-distancia}px;${r.estilo(c.ultima.id)}" ${atributos(c.ultima.id, datos.efectosEstacion.cerrada, 4)}>${caja}</g>`;
    }
    const nueva = r.es(c.consolidacion);
    capas.cajas.push(`<g transform="translate(${n1(x)} ${n1(y)})"><g class="x-cajon${nueva ? ' x-nuevo x-entra' : ''}" data-ir="${escapar(c.consolidacion)}" ${atributos(c.consolidacion, datos.efectosEstacion.abierta, 4, nueva ? ` style="${r.estilo(c.consolidacion)}"` : '')}>`
      + `<title>${escapar(titulo)}</title><rect class="x-toque" x="-3" y="-3" width="${g.cubo + 6}" height="${g.cubo + 6}"/>${caja}</g></g>`);
  }
  enEstacion.forEach((n, s) => {
    if (n > caben) capas.cajas.push(`<text class="x-rotulo x-mas" x="${g.cajasX[s] + cw - 4}" y="${yE + ch - 4}" text-anchor="end">+${n - caben}</text>`);
  });

  const abiertas = datos.cajas.filter((c) => c.estacion === 0).length;
  const cerradas = datos.cajas.filter((c) => c.estacion === 1).length;
  const etiqueta = `Fábrica: ${datos.totalPiezas} piezas en las diez líneas; ${datos.cajas.length} propuestas (${abiertas} abiertas, ${cerradas} cerradas)`;
  return `<svg class="mundo mundo-fabrica${compacto ? ' compacto' : ''}" viewBox="0 0 ${g.W} ${g.H}" role="img" aria-label="${escapar(etiqueta)}" data-mundo="4" xmlns="http://www.w3.org/2000/svg">`
    + `<g class="x-capa-lineas">${capas.lineas.join('')}</g><g class="x-capa-puestos">${capas.puestos.join('')}</g>`
    + `<g class="x-capa-estaciones">${capas.estaciones.join('')}</g><g class="x-capa-piezas">${capas.piezas.join('')}</g>`
    + `<g class="x-capa-cajas">${capas.cajas.join('')}</g></svg>`;
}

/** Render sobrio de la misma lectura: una línea por línea de montaje con algo y una por estación. */
export function lineasFabrica(datos) {
  const out = [];
  if (!datos.cabe) out.push('bajo este camino no cabe la matriz: hacen falta tres dígitos tras él');
  for (const l of datos.lineas) {
    if (!l.puestos.length && !l.piezas.length) continue;
    const piezas = l.piezas.map((p) => `${p.i}.${p.j}.${p.k} ${p.nombre}`).join(', ');
    out.push(`línea ${l.i} ${l.mundo}: ${l.puestos.length} puestos del foco${piezas ? ' · piezas: ' + piezas : ''}`);
  }
  ESTACIONES.forEach((e, s) => {
    const cajas = datos.cajas.filter((c) => c.estacion === s);
    out.push(`${e.nombre}: ${cajas.length ? cajas.map((c) => c.titulo + ' (' + c.autor + ')').join(', ') : 'nada'}`);
  });
  return out;
}

