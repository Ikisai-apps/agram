// Frontend de cartón piedra: Pointed, Sequenced y Mapped sobre el eje de
// ejemplo, en el navegador, con el mismo núcleo que corre en Node. Se lee y
// se escribe desde los tres modos con su proporción; cada identidad firma
// con su clave; la fábrica consolida, autoriza y ejecuta; el eje se guarda
// en el navegador. Scened (ui/escena.js) pone varios focos en escena y solo
// lee. Render sobrio; el animado entra con Mapped y cubre la cruz entera:
// los hilos del 6 y 7 (mundos/hilos-ui.js), el cielo del 8, el camino del 9
// y la cruz con el 5 en el centro (mundos/cruz-ui.js); y la X: fábrica 4,
// ciudad 1, jardín 2, parque 3 y lente 0 (mundos/x-ui.js).

import { instalarHilos, trasPintarHilos } from './mundos/hilos-ui.js';
import { instalarCruz, trasPintarCruz } from './mundos/cruz-ui.js';
import { instalarX, trasPintarX } from './mundos/x-ui.js';
import {
  pointed, sequenced, mapped, salida, bql, encaje, motor, tiempo, autoridad, persistencia,
  indicesDe, direccion, esReferencia, escritura, maximo, PV, RAIZ, leerCamino,
} from './src/index.js';
// Frontend sobrio (ui/): encaje, fábrica, época, ejemplo y saldos viven en sus módulos; aquí solo se enganchan.
import { listaOcupantes as listaEncaje, instalarEncaje } from './ui/encaje.js';
import { botonProponer, cajaPropuesta, contextoConsolidacion, instalarFabrica, trasPintarFabrica } from './ui/fabrica.js';
import { epocaActual, nombrePV, nombresPV, leerDireccion, instalarEpocas, trasPintarEpocas } from './ui/epocas.js';
import { crearEjemplo, restaurarEjemplo, instalarEjemplos, trasPintarEjemplos } from './ui/ejemplos.js';
import { htmlSaldos } from './ui/saldos.js';
import { htmlCifras, htmlAvisos, htmlRecomendacionT } from './ui/comun.js';
import { htmlLeido, instalarLeido } from './ui/leido.js';
import { htmlOcho, instalarOcho } from './ui/ocho.js';

const estado = {
  eje: null, foco: null, camino: [], modo: 'pointed', identidad: 'huesped', en: '4',
  aviso: '', exito: '', nota: null, recomendacion: null, verOcupantes: null, claves: {}, guardado: '',
};
const $ = (sel) => document.querySelector(sel);
const CLAVE_EJE = 'agram.eje';
const CLAVE_CLAVES = 'agram.claves';
const CLAVE_FOCO = 'agram.foco';
/** Identidades de la comida y la reserva: cada una necesita su par de claves en este navegador; las que falten a otro ejemplo (la tarea) las genera ui/ejemplos.js al elegirlo. */
const IDENTIDADES_EJEMPLO = ['casa', 'cocina', 'huesped', 'recepcion'];
instalarHilos({ pintar }); // botones «animado» y «ver los hilos»
instalarCruz({ estado, pintar, irA, privadaDe, guardar, fallo, chip: chipTemporal, mensajes }); // cielo 8, camino 9 y «ver la cruz»
instalarX({ pintar, irA: (id) => irA(id) }); // «ver la X», «reproducir la llegada» y los registros del SVG de la vista

function corto(id) {
  return id.slice(0, 8);
}

function privadaDe(identidad) {
  return estado.claves[identidad]?.privada;
}

function payloadEnFoco() {
  let p = estado.eje.obtener(estado.foco).payload;
  for (const i of estado.camino) p = p[i];
  return p;
}

function irA(id, camino = []) {
  estado.foco = id;
  estado.camino = camino;
  estado.aviso = '';
  estado.exito = '';
  estado.verOcupantes = null;
  try { globalThis.localStorage?.setItem(CLAVE_FOCO, id); } catch { /* sin almacenamiento */ }
  pintar();
}

function escapar(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function textoDe(c) {
  if (c === undefined) return '—';
  if (Array.isArray(c)) return c.length + (c.length === 1 ? ' posición' : ' posiciones');
  if (esReferencia(c)) return '→ ' + corto(c.ref) + (c.dir ? ' : ' + c.dir : '');
  return bql.desescapar(String(c));
}

function breve(c) {
  if (c === undefined) return '—';
  if (Array.isArray(c)) return '[' + c.length + ']';
  if (esReferencia(c)) return '→' + corto(c.ref);
  return bql.desescapar(String(c));
}

/** Un slot en pantalla: si es fórmula, la fórmula y su resultado con estado. */
function slot(c, evId, indices, largo = true) {
  if (!bql.esFormula(c)) return escapar(largo ? textoDe(c) : breve(c));
  const r = bql.evaluar(estado.eje, evId, indices);
  const res = r.estado === 'RESUELTO' ? '→ ' + r.texto : r.estado + (largo && r.motivo ? ': ' + r.motivo : '');
  return `<span class="formula">${escapar(c)}</span> <span class="res ${r.estado.toLowerCase()}">${escapar(res)}</span>`;
}

function direccionEn() {
  if (estado.en === '') return RAIZ;
  return direccion([...estado.camino, Number(estado.en)]);
}

function etiquetaEn() {
  return estado.en === '' ? 'la raíz del foco' : estado.en + ' ' + nombrePV(Number(estado.en), estado.camino.length);
}

/** Dónde va la décupla de Mapped cuando se escribe la salida entera: la dirección de su camino. */
function etiquetaCamino() {
  return estado.camino.length ? 'la dirección ' + direccion(estado.camino) + ' (la de su camino)' : 'la raíz del foco';
}

function fecha(t) {
  return t.replace('T', ' ').slice(0, 16);
}

function cabecera(ev) {
  const migas = estado.camino.length
    ? `<button class="miga" data-subir>↑ subir</button> <span class="ruta">profundidad ${estado.camino.length} · ${estado.camino.join(' › ')}</span>`
    : '';
  const firma = ev.firma ? `<span class="firma" title="firmado por ${escapar(ev.firmante)}">✓ firmado</span>` : '<span class="firma sin">sin firma</span>';
  return `
    <div class="cab">
      <div><b>${corto(ev.id)}</b> · ${escapar(ev.autor)} · ${fecha(ev.t)} ${firma}</div>
      <div class="sub">${ev.sobre ? `sobre <button class="enlace" data-ir="${ev.sobre}">${corto(ev.sobre)}</button>` : 'génesis'} ${migas}</div>
    </div>`;
}

function selectores() {
  const ids = estado.eje.identidades();
  return `
    <div class="dos">
      <label>Quién <small>${privadaDe(estado.identidad) ? 'firma con su clave' : 'sin clave'}</small>
        <select name="identidad">${ids.map((i) => `<option ${i === estado.identidad ? 'selected' : ''}>${i}</option>`).join('')}</select>
      </label>
      <label>En la posición
        <select name="en"><option value="" ${estado.en === '' ? 'selected' : ''}>raíz del foco</option>${nombresPV(estado.camino.length).map((n, i) => `<option value="${i}" ${String(i) === estado.en ? 'selected' : ''}>${i} ${n}</option>`).join('')}</select>
      </label>
    </div>`;
}

function mensajes() {
  // La nota de la proporción va con el éxito que la produjo (VG, 7-11 noche: la proporción propone, el máximo manda): una línea discreta, nunca error.
  const nota = estado.exito && estado.nota && estado.nota.de === estado.exito ? `<div class="pista nota">${escapar(estado.nota.texto)}</div>` : '';
  // Y la escala de T recomendada para lo que se acaba de escribir (VG, 8-11): se recomienda, no se rechaza.
  const escala = estado.exito && estado.recomendacion && estado.recomendacion.de === estado.exito ? estado.recomendacion.html : '';
  return `${estado.aviso ? `<div class="aviso">${escapar(estado.aviso)}</div>` : ''}${estado.exito ? `<div class="exito">${escapar(estado.exito)}</div>` : ''}${nota}${escala}`;
}

function listaOcupantes(indices) {
  return listaEncaje(estado.eje, estado.foco, indices, { epoca: epocaActual() }); // camino, procedencia, acuerdo y signo; orden por encaje o por llegada
}

// ---------- Pointed ----------

function pintarPointed() {
  const ev = estado.eje.obtener(estado.foco);
  const base = payloadEnFoco();
  const d = pointed.decupla({ ...ev, payload: base }, epocaActual(), estado.camino.length);
  const filas = d.posiciones.map((p) => {
    const c = p.contenido;
    // Pointed corta duro en 10 (VG, 7-11 noche): una posición cortada enseña lo que entra, pero se abre por lo que tiene.
    const entero = p.cortada && Array.isArray(base) ? base[p.indice] : c;
    const indices = [...estado.camino, p.indice];
    let accion = `data-posicion="${p.indice}"`;
    if (Array.isArray(entero)) accion = `data-desarrollar="${p.indice}"`;
    else if (esReferencia(entero)) accion = `data-ir="${entero.ref}" data-dir="${entero.dir ?? ''}"`;
    const n = encaje.ocupantes(estado.eje, estado.foco, indices).length;
    const marca = String(p.indice) === estado.en ? ' elegida' : '';
    const clase = 'pos' + (c === undefined ? ' vacia' : '') + (accion.startsWith('data-posicion') ? '' : ' activa') + (p.cortada ? ' cortada' : '') + marca;
    const abierto = estado.verOcupantes === p.indice;
    const valor = p.cortada ? (c === undefined ? 'fuera del máximo' : slot(c, estado.foco, indices)) + ' <span class="corte">· cortada</span>' : slot(c, estado.foco, indices);
    return `<div class="posfila">
      <button class="${clase}" ${accion}><span class="idx">${p.indice}</span><span class="pv">${p.significado}</span><span class="val">${valor}</span></button>
      ${n > 1 || (n === 1 && c === undefined) ? `<button class="oc ${abierto ? 'abierto' : ''}" data-ocupantes="${p.indice}" title="ocupantes de esta posición">↳ ${n}</button>` : ''}
      ${abierto ? listaOcupantes(indices) : ''}
    </div>`;
  });
  const e = escritura('pointed');
  // Un terminal no tiene posición 0 (MAPA §12): se muestra aparte, encima de las diez posiciones vacías.
  const terminal = d.terminal === undefined ? '' : `<div class="posfila"><div class="pos activa"><span class="idx">·</span><span class="pv">terminal</span><span class="val">${slot(d.terminal, estado.foco, estado.camino)}</span></div></div>`;
  $('#vista').innerHTML = cabecera(ev) + `<div class="cifras-fila">${htmlCifras('Pointed', d.alcance)}</div>${htmlAvisos(d.avisos)}<div class="decupla">${terminal}${filas.join('')}</div>${htmlAvisos(d.avisos)}
    ${htmlLeido(estado.eje, estado.foco, { epoca: epocaActual() })}
    <form id="escribir" data-modo="pointed" class="escribir">
      <div class="titulo">Escribir sobre el foco · Pointed propone ${e[1]} posición (como mucho ${maximo('pointed')}) · lo escrito va en el PV donde se escribe</div>
      ${selectores()}
      <label>Un terminal <small>(texto, número, @id o =fórmula)</small>
        <input name="texto" maxlength="160" placeholder="p. ej. «servido a las 14:05» o =LOCAL(1) + 2 EUR" required>
      </label>
      <button type="submit">Registrar en ${etiquetaEn()} · mueve 1 minuto de T</button>
      ${mensajes()}
    </form>`;
}

// ---------- Sequenced ----------

function filaSecuencia(d, i) {
  const partes = d.terminal !== undefined
    ? [`<span class="celda-s">${slot(d.terminal, d.id, [], false)}</span>`] // un terminal, sin posición 0
    : d.posiciones.filter((p) => p.contenido !== undefined).map((p) => `<span class="celda-s"><i>${p.indice}</i>${slot(p.contenido, d.id, [p.indice], false)}</span>`);
  const en = d.en && d.en !== RAIZ ? ` · en ${leerDireccion(d.en).map((x) => x.digito + ' ' + x.significado).join(' › ')}` : '';
  return `<div class="fila"><button class="abrir" data-ir="${d.id}"><span class="n">${i}</span><span class="quien">${corto(d.id)} · ${escapar(d.autor)}${en}</span><span class="celdas">${partes.join('')}</span></button><button class="ref" data-ref="${d.id}" title="insertar como referencia en la hilera">@</button></div>`;
}

function pintarSequenced() {
  const ev = estado.eje.obtener(estado.foco);
  const hilo = sequenced.secuencia(estado.eje, estado.foco, { sentido: 'hilo' });
  const hijos = sequenced.secuencia(estado.eje, estado.foco, { sentido: 'hijos' });
  const bloque = (s, titulo) => `
    <section class="hilera">
      <div class="titulo">${titulo} · ${s.decuplas.length} de ${s.total} ${htmlCifras('Sequenced', s.alcance)}</div>
      ${htmlAvisos(s.avisos)}
      ${s.decuplas.length ? s.decuplas.map(filaSecuencia).join('') : `<div class="nada">${s.corte ? 'ningún registro cabe' : 'nada todavía'}</div>`}
      ${htmlAvisos(s.avisos)}
    </section>`;
  const e = escritura('sequenced');
  const inputs = nombresPV(0).map((n, i) => `<input name="h${i}" maxlength="160" placeholder="${i} ${n}">`).join('');
  $('#vista').innerHTML = cabecera(ev) + bloque(hilo, 'Hilo hacia el génesis') + bloque(hijos, 'Escrito sobre el foco') + `
    <form id="escribir" data-modo="sequenced" class="escribir">
      <div class="titulo">Escribir una hilera sobre el foco · Sequenced propone de ${e[0]} a ${e[1]} posiciones (como mucho ${maximo('sequenced')}) · sin huecos</div>
      ${selectores()}
      <div class="hilera-inputs">${inputs}</div>
      <div class="pista">Toca «@» en una fila para meterla como referencia. Cada posición escrita mueve un minuto de T.</div>
      <button type="submit">Registrar la hilera en ${etiquetaEn()}</button>
      ${mensajes()}
    </form>`;
}

// ---------- Mapped ----------

function chip(ev, extra = '') {
  const t = Array.isArray(ev.payload) ? ev.payload[0] : ev.payload;
  return `<button class="chip" data-ir="${ev.id}"><b>${corto(ev.id)}</b> ${escapar(breve(t))}${extra}</button>`;
}

function chipTemporal(x) {
  const ev = estado.eje.obtener(x.id);
  const etiqueta = x.tipo === 'consolidacion' ? ` <i>${x.estado.toLowerCase()}</i>` : x.tipo === 'proyeccion' ? ' <i>proyección</i>' : x.tipo === 'declarado' ? ' <i>declarado</i>' : '';
  const texto = x.tipo === 'declarado' ? breve(x.contenido) : breve(Array.isArray(ev.payload) ? ev.payload[0] : ev.payload);
  return `<button class="chip" data-ir="${x.id}"><b>${corto(x.id)}</b> ${escapar(texto)}${etiqueta} <small>${x.banda}</small></button>`;
}

function celdaMapa(m, i, eje67) {
  const c = m.celdas[i];
  const marca = c.escritos ? `<span class="hijos">↳ ${c.escritos}</span>` : '';
  const propio = c.contenido !== undefined ? `<div class="val">${slot(c.contenido, m.foco, [...m.camino, i], false)}</div>` : '';
  if (i === 5) {
    const ev = estado.eje.obtener(m.foco);
    const json = JSON.stringify({ id: corto(ev.id), autor: ev.autor, firmante: ev.firmante ?? null, sobre: ev.sobre ? corto(ev.sobre) : null, en: ev.en, t: ev.t, movimientos: ev.movimientos, contexto: ev.contexto, payload: c.contenido }, null, 1);
    return `<div class="celda c5"><div class="pvn">5 ${c.significado} · 0 ${m.celdas[0].significado}</div>
      <div class="lente">${escapar(breve(m.terminal ?? m.celdas[0].contenido))}</div>
      <details><summary>estructura</summary><pre>${escapar(json)}</pre></details></div>`;
  }
  if (i === 6) {
    return `<div class="celda c6"><div class="pvn">6 ${c.significado} · ${eje67.totalPasado}</div><div class="chips">${eje67.pasado.length ? eje67.pasado.map(chipTemporal).join('') : '<span class="nada">génesis</span>'}</div>${propio}${marca}</div>`;
  }
  if (i === 7) {
    return `<div class="celda c7"><div class="pvn">7 ${c.significado} · ${eje67.totalFuturo}</div><div class="chips">${eje67.futuro.length ? eje67.futuro.map(chipTemporal).join('') : '<span class="nada">nada proyectado</span>'}</div>${marca}</div>`;
  }
  if (i === 8) {
    // La verdad del 8 es la base escrita (VG, 7-11 noche); sin ella, el respaldo al vuelo lo dice. Sin puesto ni puntuación.
    // VG, 8-11: hermanos por defecto, cantidades y cuota primero, recuentos como información; se mide aquí, al pintar (ui/ocho.js).
    return `<div class="celda c8"><div class="pvn">8 ${c.significado}</div>
      ${htmlOcho(estado.eje, m.foco, { epoca: epocaActual() })}
      <div class="pista">sin nivel ni grado: las estrellas no son verdad</div>${propio}${marca}</div>`;
  }
  if (i === 9) {
    // Con el payload: en una décupla, la regla corta; un índice de una lista (solo hojas) es un ocupante por llegada, sin PV (VG, 7-11 noche: por hojas).
    const pasos = m.camino.length ? leerCamino(m.camino, epocaActual(), { payload: estado.eje.obtener(m.foco).payload }).map((x) => `<span class="paso">${x.digito} ${escapar(x.significado)}</span>`).join(' › ') : '<span class="nada">en la raíz del foco</span>';
    const abiertas = motor.propuestas(estado.eje, m.foco, m.camino).filter((x) => x.cerrado !== true);
    const guia = abiertas.length ? `<div class="pista">${abiertas.length} propuesta${abiertas.length > 1 ? 's' : ''} abierta${abiertas.length > 1 ? 's' : ''} en la fábrica: les falta lo que anuncian</div>` : '';
    return `<div class="celda c9"><div class="pvn">9 ${c.significado}</div><div class="pasos">${pasos}</div>${guia}${propio}${marca}</div>`;
  }
  const ct = c.contenido;
  let accion = `data-posicion="${i}"`;
  if (Array.isArray(ct)) accion = `data-desarrollar="${i}"`;
  else if (esReferencia(ct)) accion = `data-ir="${ct.ref}" data-dir="${ct.dir ?? ''}"`;
  return `<button class="celda esquina c${i} ${ct === undefined ? 'vacia' : ''}" ${accion}><div class="pvn">${i} ${c.significado}</div>
    <div class="val">${slot(ct, m.foco, [...m.camino, i], false)}</div>${marca}</button>`;
}

function panelFabrica(m) {
  const lista = motor.propuestas(estado.eje, m.foco, m.camino);
  const yo = estado.identidad;
  // Encargo 3b (VG, 8-11, mapa §15 [D]): el ciclo es una sola operación, registrar; cada uno mueve lo suyo. De cada
  // propuesta, su lectura (cerrada o abierta) y lo que le falta de mí (motor.siguiente), que registro yo.
  const filas = lista.map((c) => {
    const sig = motor.siguiente(estado.eje, c.id, yo);
    const mios = sig.faltaDeMi.map((x, k) => `<button class="accion" data-registrar-siguiente="${c.id}" data-k="${k}">${escapar(x.que)} · como ${escapar(yo)}</button>`).join('');
    const espera = sig.espera.length ? `<span class="pista">espera a ${escapar([...new Set(sig.espera.map((x) => x.de))].join(', '))}</span>` : '';
    return `<div class="cons"><button class="chip" data-ir="${c.id}"><b>${corto(c.id)}</b> ${escapar(String(c.titulo))} · ${escapar(c.autor)} · <i>${c.cerrado === true ? 'cerrada' : 'abierta'}</i></button>
      ${mios}${espera}
      ${contextoConsolidacion(estado.eje, c.id)}
    </div>`;
  }).join('');
  const desc = motor.descubrir(estado.eje, m.foco, { camino: m.camino });
  const campos = desc.map((p) => {
    const opciones = p.candidatos.map((c, k) => `<option value="c${k}">${c.origen} ${corto(c.evento)} · ${escapar((c.etiqueta ?? c.texto).slice(0, 40))}</option>`).join('');
    return `<label class="celda-form"><span>${p.posicion} ${nombrePV(p.posicion, m.camino.length)}</span>
      <select name="e${p.posicion}"><option value="">— nada (se hereda del foco si existe) —</option>${opciones}<option value="nuevo">terminal nuevo ↓</option></select>
      <input name="n${p.posicion}" maxlength="120" placeholder="terminal nuevo para ${p.posicion}"></label>`;
  }).join('');
  return `
    <section class="fabrica">
      <div class="titulo">Fábrica (4) · registrar es la única operación · ${lista.length} propuesta${lista.length === 1 ? '' : 's'}</div>
      ${filas || '<div class="nada">nada consolidado sobre este foco</div>'}
      <form id="consolidar" class="escribir">
        <div class="titulo">Consolidar una acción como ${escapar(yo)}: elige por posición un candidato o escribe un terminal nuevo</div>
        <label>Título <input name="titulo" maxlength="80" value="Acción sobre ${escapar(breve(m.terminal ?? m.celdas[0].contenido))}"></label>
        <div class="decupla-form">${campos}</div>
        ${botonProponer()}${cajaPropuesta(estado.eje, m.foco, m.camino)}
        <button type="submit">Consolidar en la fábrica del foco</button>
        ${mensajes()}
      </form>
    </section>`;
}

function pintarMapped() {
  const m = mapped.mapa(estado.eje, estado.foco, { camino: estado.camino, epoca: epocaActual() });
  const ev = estado.eje.obtener(estado.foco);
  const eje67 = tiempo.ejeTemporal(estado.eje, estado.foco, { camino: estado.camino });
  const e = escritura('mapped');
  const base = payloadEnFoco();
  const celdasForm = nombresPV(estado.camino.length).map((n, i) => {
    // Lo mismo que hereda desdeMapped. [X] decidir VG (mapa §13): un foco terminal hereda su raíz en la
    // posición 0, como en main, aunque un terminal no tenga posición 0 en la décupla ni en el mapa (mapa §12).
    const hay = Array.isArray(base) ? base[i] !== undefined : i === 0 && base !== undefined;
    const ph = hay ? '← del foco: ' + breve(Array.isArray(base) ? base[i] : base) : 'vacía';
    return `<label class="celda-form"><span>${i} ${n}</span><textarea name="c${i}" rows="2" placeholder="${escapar(ph)}"></textarea></label>`;
  }).join('');
  $('#vista').innerHTML = cabecera(ev) + `<div class="cifras-fila">${htmlCifras('Mapped', m.alcance)}</div>${htmlAvisos(m.avisos)}<div class="matriz">${mapped.MATRIZ.flat().map((i) => celdaMapa(m, i, eje67)).join('')}</div>${htmlAvisos(m.avisos)}`
    + panelFabrica(m) + `
    <form id="escribir" data-modo="mapped" class="escribir">
      <div class="titulo">Escribir una décupla sobre el foco · Mapped propone de ${e[0]} a ${e[1]} posiciones (como mucho ${maximo('mapped')}) · una línea por ítem</div>
      ${selectores()}
      <div class="decupla-form">${celdasForm}</div>
      <div class="pista">Las celdas vacías anteriores a la última escrita se heredan del foco por referencia. Lo que el foco no tiene (lo lejano) no se rechaza: se ancla aparte en su posición, y entonces la décupla va en ${etiquetaCamino()}. Cada posición escrita mueve un minuto de T.</div>
      <button type="submit">Registrar la décupla en ${etiquetaEn()}</button>
      ${mensajes()}
    </form>`;
}

// ---------- común ----------

function pintarSaldos() {
  // Cada familia es una serie (T por escala, E por emisor y denominación, P por ámbito, R por emisor): ui/saldos.js.
  // R9: un eje de demostración lo dice (su génesis lleva contexto.demostracion); fuera de él, sin clave no se actúa.
  const demo = estado.eje.demostracion ? `<div class="guardado demostracion" title="contexto.demostracion del génesis">eje de demostración: aquí una identidad sin clave también escribe y mueve tokens; fuera de la demostración, sin clave no se actúa</div>` : '';
  $('#saldos').innerHTML = demo + htmlSaldos(estado.eje) + `<div class="guardado">${escapar(estado.guardado)}</div>`;
}

function pintar() {
  document.querySelectorAll('[data-modo]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modo === estado.modo)));
  if (estado.modo === 'pointed') pintarPointed();
  else if (estado.modo === 'mapped') pintarMapped();
  else if (estado.modo === 'scened') pintarScened();
  else if (estado.modo === 'clasificar') pintarClasificar();
  else pintarSequenced();
  trasPintarHilos(estado); // en animado, los hilos en las celdas 6 y 7 de Mapped
  trasPintarCruz(estado); // después de los hilos: el cielo y el camino en las celdas 8 y 9, y la cruz si está abierta
  trasPintarX(estado); // después de la cruz: en animado, la X en las celdas 1–4 y 0 de Mapped
  pintarSaldos();
  trasPintarEpocas();
  trasPintarFabrica(estado);
  trasPintarEjemplos(estado);
}

// Scened (ui/escena.js): varios focos en escena, solo lectura; aquí solo se engancha.
import { vistaEscena, instalarEscena } from './ui/escena.js';

function pintarScened() {
  instalarEscena({ estado, pintar, irA });
  $('#vista').innerHTML = cabecera(estado.eje.obtener(estado.foco)) + vistaEscena(estado.eje, estado.foco, { camino: estado.camino });
}

// Clasificar (ui/clasificar.js): la lista de la posición, fuera del árbol, y la cruceta como lente o para crear; aquí solo se engancha.
import { vistaClasificar, instalarClasificar } from './ui/clasificar.js';

function pintarClasificar() {
  $('#vista').innerHTML = cabecera(estado.eje.obtener(estado.foco)) + vistaClasificar(estado, { epoca: epocaActual() }) + mensajes();
}

function guardar() {
  const ok = persistencia.guardarLocal(estado.eje, CLAVE_EJE);
  estado.guardado = ok ? 'guardado en este navegador · ' + estado.eje.orden.length + ' registros' : 'sin almacenamiento: nada se guarda al recargar';
}

function fallo(e, form) {
  estado.aviso = String(e.message ?? e).replace(/^evento (rechazado|mal formado): /, '');
  estado.exito = '';
  pintar();
  const campo = form?.querySelector('input, textarea');
  if (campo) campo.focus();
}

async function registrar(form) {
  const datos = new FormData(form);
  const modo = form.dataset.modo;
  estado.identidad = datos.get('identidad');
  estado.en = String(datos.get('en') ?? '');
  const eje = estado.eje;
  try {
    let payload;
    let heredadas = [];
    if (modo === 'pointed') {
      payload = salida.desdePointed(eje, datos.get('texto'));
    } else if (modo === 'sequenced') {
      payload = salida.desdeSequenced(eje, PV.map((_, i) => datos.get('h' + i)));
    } else {
      const celdas = PV.map((_, i) => String(datos.get('c' + i) ?? '').split('\n'));
      const s = salida.desdeMapped(eje, celdas, estado.foco, estado.camino);
      // Lo lejano (sin base en el foco) se ancla aparte en su posición (BTML §5, MOTOR §7.3): se escribe la salida
      // entera con escribirSalida, que pone la décupla en la dirección de su camino y cada celda anclada en la suya.
      // Igual si la posición elegida es justo la del camino: así sus heredadas quedan dichas y el tope no las cuenta.
      if (s.anclados.length || direccionEn() === direccion(estado.camino)) {
        await registrarSalida(s);
        return;
      }
      ({ payload, heredadas } = s);
    }
    const ev = await salida.escribirDesde(eje, { modo, autor: estado.identidad, sobre: estado.foco, en: direccionEn(), payload }, privadaDe(estado.identidad));
    guardar();
    estado.aviso = '';
    const n = ev.movimientos[0].cantidad;
    estado.exito = 'Registrado ' + corto(ev.id) + ' en ' + etiquetaEn() + ' sobre ' + corto(estado.foco) + ' · ' + n + (n === 1 ? ' posición, 1 minuto' : ' posiciones, ' + n + ' minutos') + ' de T'
      + (heredadas.length ? ' · heredadas del foco: ' + heredadas.join(', ') : '') + (ev.firma ? ' · firmado' : '') + '.';
    const aviso = salida.proporcionDeRegistro(ev).aviso;
    estado.nota = aviso ? { de: estado.exito, texto: aviso } : null;
    estado.recomendacion = modo === 'sequenced' ? null : { de: estado.exito, html: htmlRecomendacionT(ev) }; // Pointed y Mapped
    pintar();
  } catch (e) {
    fallo(e, form);
  }
}

/** Mapped: la salida entera de desdeMapped (la décupla, si queda algo dentro, y cada celda anclada), con escribirSalida. */
async function registrarSalida(s) {
  let r;
  try {
    r = await salida.escribirSalida(estado.eje, { modo: 'mapped', autor: estado.identidad, sobre: estado.foco, salida: s }, privadaDe(estado.identidad));
  } catch (e) {
    guardar(); // escribirSalida no es atómica: si un anclado falla, lo anterior ya está en el eje y se guarda
    throw e;
  }
  guardar();
  estado.aviso = '';
  const enDe = (ev) => ev.en ?? RAIZ;
  const eventos = [r.registro, ...r.anclados].filter(Boolean);
  const n = eventos.reduce((suma, ev) => suma + ev.movimientos[0].cantidad, 0);
  const partes = [
    ...(r.registro ? ['registrado ' + corto(r.registro.id) + ' en ' + (enDe(r.registro) === direccionEn() ? etiquetaEn() : etiquetaCamino())] : []),
    ...r.anclados.map((ev) => 'anclado ' + corto(ev.id) + ' en ' + enDe(ev)),
  ].join(' · ');
  const otraPosicion = r.registro && r.anclados.length && enDe(r.registro) !== direccionEn()
    ? ' (con celdas ancladas, la décupla va en la dirección de su camino, no en ' + etiquetaEn() + ')' : '';
  estado.exito = partes[0].toUpperCase() + partes.slice(1) + otraPosicion + ' sobre ' + corto(estado.foco) + ' · '
    + n + (n === 1 ? ' posición, 1 minuto' : ' posiciones, ' + n + ' minutos') + ' de T'
    + (s.heredadas.length ? ' · heredadas del foco: ' + s.heredadas.join(', ') : '') + (eventos.some((ev) => ev.firma) ? ' · firmado' : '') + '.';
  estado.nota = r.avisos.length ? { de: estado.exito, texto: r.avisos.join(' ') } : null;
  estado.recomendacion = { de: estado.exito, html: eventos.map(htmlRecomendacionT).join('') }; // Mapped
  pintar();
}

async function consolidarDesdeFormulario(form) {
  const datos = new FormData(form);
  const desc = motor.descubrir(estado.eje, estado.foco, { camino: estado.camino });
  const elecciones = {};
  for (const p of desc) {
    const v = String(datos.get('e' + p.posicion) ?? '');
    if (!v) continue;
    if (v === 'nuevo') {
      const texto = String(datos.get('n' + p.posicion) ?? '').trim();
      if (!texto) continue;
      elecciones[p.posicion] = salida.item(estado.eje, texto);
    } else {
      elecciones[p.posicion] = { candidato: p.candidatos[Number(v.slice(1))] };
    }
  }
  try {
    const c = await motor.consolidar(estado.eje, { autor: estado.identidad, foco: estado.foco, camino: estado.camino, elecciones, titulo: String(datos.get('titulo') || 'Consolidación') }, privadaDe(estado.identidad));
    guardar();
    estado.aviso = '';
    estado.exito = 'Consolidado ' + corto(c.id) + ' en la fábrica del foco · ' + (motor.cerrado(estado.eje, c.id).cerrado ? 'cerrada' : 'abierta') + '. Cada parte registra su propio movimiento: nadie autoriza lo ajeno.';
    pintar();
  } catch (e) {
    fallo(e, form);
  }
}

/** Registra lo que a una propuesta le falta de mí (motor.siguiente): la transacción que lo cumple, como yo. */
async function registrarSiguiente(id, k) {
  try {
    const x = motor.siguiente(estado.eje, id, estado.identidad).faltaDeMi[k];
    if (!x) throw new Error('no te falta nada en ' + corto(id));
    const e = await motor.registrar(estado.eje, { ...x.transaccion, t: new Date().toISOString() }, privadaDe(estado.identidad));
    guardar();
    estado.aviso = '';
    estado.exito = 'Registrado ' + corto(e.id) + ': ' + x.que + ' · la propuesta está ' + (motor.cerrado(estado.eje, id).cerrado ? 'cerrada' : 'abierta') + '.';
    pintar();
  } catch (e) { fallo(e); }
}

function insertarRef(id) {
  const vacio = [...document.querySelectorAll('.hilera-inputs input')].find((i) => !i.value.trim());
  if (!vacio) return;
  vacio.value = '@' + corto(id);
  vacio.focus();
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.modo) { estado.modo = b.dataset.modo; estado.exito = ''; estado.aviso = ''; pintar(); }
  else if (b.dataset.ref) insertarRef(b.dataset.ref);
  else if (b.dataset.ocupantes !== undefined) { const i = Number(b.dataset.ocupantes); estado.verOcupantes = estado.verOcupantes === i ? null : i; pintar(); }
  else if (b.dataset.registrarSiguiente) registrarSiguiente(b.dataset.registrarSiguiente, Number(b.dataset.k));
  else if (b.dataset.posicion !== undefined) {
    estado.en = b.dataset.posicion; estado.exito = '';
    if (estado.modo === 'mapped') estado.modo = 'pointed'; // la mano escribe en Pointed
    pintar();
  }
  else if (b.dataset.desarrollar !== undefined) { estado.camino = [...estado.camino, Number(b.dataset.desarrollar)]; estado.verOcupantes = null; pintar(); }
  else if (b.dataset.ir) irA(b.dataset.ir, b.dataset.dir ? indicesDe(b.dataset.dir) : []);
  else if (b.dataset.subir !== undefined) { estado.camino = estado.camino.slice(0, -1); estado.verOcupantes = null; pintar(); }
  else if (b.dataset.genesis !== undefined) irA(estado.eje.genesisId);
  else if (b.dataset.reiniciar !== undefined) reiniciar();
});

document.addEventListener('change', (e) => {
  if (e.target.name === 'identidad') { estado.identidad = e.target.value; pintar(); }
});

document.addEventListener('submit', (e) => {
  if (e.target.id === 'escribir') { e.preventDefault(); registrar(e.target); }
  else if (e.target.id === 'consolidar') { e.preventDefault(); consolidarDesdeFormulario(e.target); }
});

// ---------- arranque: claves, eje guardado o ejemplo ----------

/** Claves de las identidades de ejemplo: las guardadas en este navegador, y se generan las que falten (p. ej. una sesión anterior sin `recepcion`). */
async function cargarClaves() {
  const claves = {};
  const exportables = {};
  try {
    const guardadas = JSON.parse(globalThis.localStorage?.getItem(CLAVE_CLAVES) ?? 'null') ?? {};
    for (const [id, par] of Object.entries(guardadas)) {
      claves[id] = { publica: par.publica, privada: await autoridad.importarPrivada(par.privada) };
      exportables[id] = par;
    }
  } catch { /* sin claves guardadas o ilegibles: se generan */ }
  let nuevas = false;
  for (const id of IDENTIDADES_EJEMPLO) {
    if (claves[id]) continue;
    claves[id] = await autoridad.generarClaves();
    exportables[id] = { publica: claves[id].publica, privada: await autoridad.exportarPrivada(claves[id].privada) };
    nuevas = true;
  }
  if (nuevas) {
    try { globalThis.localStorage?.setItem(CLAVE_CLAVES, JSON.stringify(exportables)); } catch { /* sin almacenamiento */ }
  }
  return claves;
}

/** Construye el eje del ejemplo elegido en el selector de ui/ejemplos.js (comida, reserva o tarea), que guarda la elección en el navegador. */
async function ejemploNuevo() {
  return crearEjemplo(estado); // el elegido en el selector (comida, reserva o tarea), con las claves que le falten
}

async function reiniciar() {
  persistencia.borrarLocal(CLAVE_EJE);
  try { globalThis.localStorage?.removeItem(CLAVE_CLAVES); } catch { /* sin almacenamiento */ }
  estado.claves = await cargarClaves();
  const { eje, foco } = await ejemploNuevo();
  estado.eje = eje;
  estado.camino = [];
  estado.verOcupantes = null;
  guardar();
  irA(foco);
}

instalarEjemplos({ reiniciar });
instalarEpocas({ pintar });
instalarEncaje({ pintar });
instalarLeido({ pintar }); // conmutador «leído»: el registro (Pointed) o la posición en foco (Clasificar) como texto
instalarOcho({ pintar }); // botones de cohorte de la celda 8 de Mapped: hermanos, proyecto, todo el eje
instalarFabrica({ estado, pintar });
instalarClasificar({ estado, pintar, guardar, fallo, privadaDe, epoca: epocaActual });
estado.claves = await cargarClaves();
let cargado = await persistencia.cargarLocal(CLAVE_EJE);
let foco;
if (cargado && estado.claves.casa && JSON.stringify(cargado.clave('casa')) !== JSON.stringify(estado.claves.casa.publica)) cargado = null; // claves de otra sesión
if (cargado) {
  estado.eje = cargado;
  // Vuelve al foco donde se quedó (guardado al navegar) con una identidad que exista en el eje; si no hay o ya no existe, al génesis.
  foco = restaurarEjemplo(cargado, estado) ?? cargado.genesisId;
  estado.guardado = 'cargado del navegador · ' + cargado.orden.length + ' registros';
} else {
  // Lo que había y no se puede abrir (formato anterior, claves de otra sesión) se aparta antes de guardar el ejemplo encima.
  const apartado = persistencia.apartarLocal(CLAVE_EJE);
  const nuevo = await ejemploNuevo();
  estado.eje = nuevo.eje;
  foco = nuevo.foco;
  guardar();
  if (apartado) estado.aviso = 'El eje guardado en este navegador no se ha podido abrir (formato anterior o claves de otra sesión). Queda apartado en «' + CLAVE_EJE + '.anterior» y se empieza con el ejemplo.';
}
estado.foco = foco;
pintar();
