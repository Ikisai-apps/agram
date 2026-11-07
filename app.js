// Frontend de cartón piedra: Pointed, Sequenced y Mapped sobre el eje de
// ejemplo, en el navegador, con el mismo núcleo que corre en Node. Se lee y
// se escribe desde los tres modos con su proporción; cada identidad firma
// con su clave; la fábrica consolida, autoriza y ejecuta; el eje se guarda
// en el navegador. Render sobrio; el animado (mundos/) cubre la cruz entera:
// los hilos del 6 y 7, el cielo del 8 y el camino del 9 (celdas 6–9 de
// Mapped), la vista «hilos» y la vista «cruz», con el 5 en el centro.

import {
  pointed, sequenced, mapped, salida, bql, encaje, motor, tiempo, autoridad, persistencia,
  indicesDe, direccion, esReferencia, escritura, leerDireccion, PV, RAIZ,
} from './src/index.js';
import { ejemploCompra, ejemploCuenta } from './ejemplos/ikisai/compra-food.mjs';
import { ejemploReserva } from './ejemplos/ikisai/reserva-booking.mjs';
import * as hilos from './mundos/hilos.js';
import * as cielo from './mundos/cielo.js';
import * as mundoCamino from './mundos/camino.js';
import * as cruz from './mundos/cruz.js';

const estado = {
  eje: null, foco: null, camino: [], modo: 'pointed', identidad: 'huesped', en: '4',
  aviso: '', exito: '', verOcupantes: null, claves: {}, guardado: '', ejemplo: 'compra',
  render: 'sobrio', reproducir: false, // sobrio o animado: dos renders de la misma lectura
  cohorte: 'hermanos', cieloAnterior: null, // el cielo del 8: cohorte elegida y la que se deja (para recomponer)
  previa: null, // el camino del 9: la última previsualización (no escribe)
};
const memoriaHilos = hilos.memoria(); // qué eventos ya se vieron en los hilos: solo lo nuevo se anima
const $ = (sel) => document.querySelector(sel);
const CLAVE_EJE = 'agram.eje';
const CLAVE_CLAVES = 'agram.claves';
const CLAVE_EJEMPLO = 'agram.ejemplo';
const CLAVE_FOCO = 'agram.foco';
/** Identidades de los dos ejemplos: cada una necesita su par de claves en este navegador. */
const IDENTIDADES_EJEMPLO = ['casa', 'cocina', 'huesped', 'recepcion'];

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
  estado.previa = null;
  estado.cieloAnterior = null;
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
  return estado.en === '' ? 'la raíz del foco' : estado.en + ' ' + PV[Number(estado.en)];
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
        <select name="en"><option value="" ${estado.en === '' ? 'selected' : ''}>raíz del foco</option>${PV.map((n, i) => `<option value="${i}" ${String(i) === estado.en ? 'selected' : ''}>${i} ${n}</option>`).join('')}</select>
      </label>
    </div>`;
}

function mensajes() {
  return `${estado.aviso ? `<div class="aviso">${escapar(estado.aviso)}</div>` : ''}${estado.exito ? `<div class="exito">${escapar(estado.exito)}</div>` : ''}`;
}

function listaOcupantes(indices) {
  const oc = encaje.ocupantes(estado.eje, estado.foco, indices);
  if (!oc.length) return '<div class="nada">sin ocupantes</div>';
  return `<div class="ocupantes">${oc.map((o) => {
    const r = bql.evaluar(estado.eje, o.evento, motor.caminoVisible(o));
    const quien = o.autor ? ' · ' + escapar(o.autor) : '';
    const camino = o.camino && o.camino.length ? ' <small>' + o.camino.join('.') + '</small>' : '';
    return `<button class="chip" data-ir="${o.evento}" ${o.origen !== 'escrito' && o.dir !== RAIZ ? `data-dir="${o.dir}"` : ''}><i>${o.origen}</i>${camino} <b>${corto(o.evento)}</b>${quien} · ${escapar(r.texto)}</button>`;
  }).join('')}</div>`;
}

// ---------- Pointed ----------

function pintarPointed() {
  const ev = estado.eje.obtener(estado.foco);
  const d = pointed.decupla({ ...ev, payload: payloadEnFoco() }, undefined, estado.camino.length);
  const filas = d.posiciones.map((p) => {
    const c = p.contenido;
    const indices = [...estado.camino, p.indice];
    let accion = `data-posicion="${p.indice}"`;
    if (Array.isArray(c)) accion = `data-desarrollar="${p.indice}"`;
    else if (esReferencia(c)) accion = `data-ir="${c.ref}" data-dir="${c.dir ?? ''}"`;
    const n = encaje.ocupantes(estado.eje, estado.foco, indices).length;
    const marca = String(p.indice) === estado.en ? ' elegida' : '';
    const clase = 'pos' + (c === undefined ? ' vacia' : '') + (accion.startsWith('data-posicion') ? '' : ' activa') + marca;
    const abierto = estado.verOcupantes === p.indice;
    return `<div class="posfila">
      <button class="${clase}" ${accion}><span class="idx">${p.indice}</span><span class="pv">${p.significado}</span><span class="val">${slot(c, estado.foco, indices)}</span></button>
      ${n > 1 || (n === 1 && c === undefined) ? `<button class="oc ${abierto ? 'abierto' : ''}" data-ocupantes="${p.indice}" title="ocupantes de esta posición">↳ ${n}</button>` : ''}
      ${abierto ? listaOcupantes(indices) : ''}
    </div>`;
  });
  const e = escritura('pointed');
  // Un terminal no tiene posición 0 (MAPA §12): se muestra aparte, encima de las diez posiciones vacías.
  const terminal = d.terminal === undefined ? '' : `<div class="posfila"><div class="pos activa"><span class="idx">·</span><span class="pv">terminal</span><span class="val">${slot(d.terminal, estado.foco, estado.camino)}</span></div></div>`;
  $('#vista').innerHTML = cabecera(ev) + `<div class="decupla">${terminal}${filas.join('')}</div>
    <form id="escribir" data-modo="pointed" class="escribir">
      <div class="titulo">Escribir sobre el foco · Pointed escribe ${e[1]} posición de 10 · lo escrito va en el PV donde se escribe</div>
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
      <div class="titulo">${titulo} · ${s.decuplas.length} de ${s.total}</div>
      ${s.decuplas.length ? s.decuplas.map(filaSecuencia).join('') : '<div class="nada">nada todavía</div>'}
    </section>`;
  const e = escritura('sequenced');
  const inputs = PV.map((n, i) => `<input name="h${i}" maxlength="160" placeholder="${i} ${n}">`).join('');
  $('#vista').innerHTML = cabecera(ev) + bloque(hilo, 'Hilo hacia el génesis') + bloque(hijos, 'Escrito sobre el foco') + `
    <form id="escribir" data-modo="sequenced" class="escribir">
      <div class="titulo">Escribir una hilera sobre el foco · Sequenced escribe de ${e[0]} a ${e[1]} posiciones de 100 · sin huecos</div>
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

function celdaMapa(m, i, eje67, comp, anim) {
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
  if ((i === 6 || i === 7) && anim) {
    const total = i === 6 ? eje67.totalPasado : eje67.totalFuturo;
    const svg = hilos.svgHilos(anim.datos, { ventana: i === 6 ? 'pasado' : 'futuro', compacto: true, nuevos: anim.nuevos });
    return `<div class="celda c${i}"><div class="pvn">${i} ${c.significado} · ${total}</div>${svg}<button class="ver-hilos" data-modo="hilos">ver hilos</button>${i === 6 ? propio : ''}${marca}</div>`;
  }
  if (i === 8 && anim) {
    // Las seis medidas del registro en la cohorte elegida; el botón pasa a la siguiente (orden fijo, sin ordenar cohortes).
    const d = cielo.datosCielo(estado.eje, m.foco, { cohorte: estado.cohorte });
    const siguiente = cielo.COHORTES[(cielo.COHORTES.indexOf(estado.cohorte) + 1) % cielo.COHORTES.length];
    return `<div class="celda c8"><div class="pvn">8 ${c.significado} · ${estado.cohorte}${d.escrita || d.estado !== 'RESUELTO' ? '' : ' · sin escribir'}</div>`
      + `${cielo.svgCielo(d, { compacto: true, anterior: estado.cieloAnterior })}<button class="ver-hilos" data-cohorte="${siguiente}" title="cohorte: ${cielo.COHORTES.join(', ')}">→ ${siguiente}</button>${propio}${marca}</div>`;
  }
  if (i === 9 && anim) {
    const d = datosCaminoActual(m.foco, m.camino);
    return `<div class="celda c9"><div class="pvn">9 ${c.significado} · ${d.pasos.length} paso${d.pasos.length === 1 ? '' : 's'}</div>`
      + `${mundoCamino.svgCamino(d, { compacto: true, nuevos: anim.nuevos, previsto: estado.previa?.clave })}<button class="ver-hilos" data-modo="cruz">ver cruz</button>${propio}${marca}</div>`;
  }
  if (i === 6) {
    return `<div class="celda c6"><div class="pvn">6 ${c.significado} · ${eje67.totalPasado}</div><div class="chips">${eje67.pasado.length ? eje67.pasado.map(chipTemporal).join('') : '<span class="nada">génesis</span>'}</div>${propio}${marca}</div>`;
  }
  if (i === 7) {
    return `<div class="celda c7"><div class="pvn">7 ${c.significado} · ${eje67.totalFuturo}</div><div class="chips">${eje67.futuro.length ? eje67.futuro.map(chipTemporal).join('') : '<span class="nada">nada proyectado</span>'}</div>${marca}</div>`;
  }
  if (i === 8) {
    const d = m.medidas;
    return `<div class="celda c8"><div class="pvn">8 ${c.significado}</div>
      <div class="medidas"><span>entre hermanos <b>${comp.posicion} de ${comp.de}</b></span><span>hilo <b>${d.profundidadHilo}</b></span><span>escritos <b>${d.escritos}</b></span><span>movimientos <b>${d.movimientos}</b></span><span>posiciones <b>${d.posicionesDesarrolladas}</b></span></div>
      <div class="pista">sin nivel ni grado: las estrellas no son verdad</div>${propio}${marca}</div>`;
  }
  if (i === 9) {
    const pasos = m.camino.length ? m.camino.map((p) => `<span class="paso">${p} ${PV[p]}</span>`).join(' › ') : '<span class="nada">en la raíz del foco</span>';
    const pendientes = motor.consolidaciones(estado.eje, m.foco, m.camino).filter((x) => x.estado !== 'EJECUTADO');
    const guia = pendientes.length ? `<div class="pista">${pendientes.length} consolidación${pendientes.length > 1 ? 'es' : ''} por ${pendientes.some((x) => x.estado === 'AUTORIZADO') ? 'ejecutar' : 'autorizar'} en la fábrica</div>` : '';
    return `<div class="celda c9"><div class="pvn">9 ${c.significado}</div><div class="pasos">${pasos}</div>${guia}${propio}${marca}</div>`;
  }
  const ct = c.contenido;
  let accion = `data-posicion="${i}"`;
  if (Array.isArray(ct)) accion = `data-desarrollar="${i}"`;
  else if (esReferencia(ct)) accion = `data-ir="${ct.ref}" data-dir="${ct.dir ?? ''}"`;
  return `<button class="celda esquina ${ct === undefined ? 'vacia' : ''}" ${accion}><div class="pvn">${i} ${c.significado}</div>
    <div class="val">${slot(ct, m.foco, [...m.camino, i], false)}</div>${marca}</button>`;
}

function panelFabrica(m) {
  const lista = motor.consolidaciones(estado.eje, m.foco, m.camino);
  const yo = estado.identidad;
  const filas = lista.map((c) => {
    const puedeAut = c.estado === 'PENDIENTE DE AUTORIZACIÓN' && motor.puedeAutorizar(estado.eje, yo, c.id);
    const puedeEje = c.estado === 'AUTORIZADO' && c.autor === yo;
    return `<div class="cons"><button class="chip" data-ir="${c.id}"><b>${corto(c.id)}</b> ${escapar(String(c.titulo))} · ${escapar(c.autor)} · <i>${c.estado.toLowerCase()}</i></button>
      ${puedeAut ? `<button class="accion" data-autorizar="${c.id}">autorizar como ${escapar(yo)}</button>` : ''}
      ${puedeEje ? `<button class="accion" data-ejecutar="${c.id}">ejecutar como ${escapar(yo)}</button>` : ''}
      ${c.estado === 'PENDIENTE DE AUTORIZACIÓN' && !puedeAut ? `<span class="pista">${yo === c.autor ? 'el autor no se autoriza a sí mismo' : yo + ' no tiene poder (P) sobre este registro'}</span>` : ''}
      ${c.estado === 'AUTORIZADO' && !puedeEje ? `<span class="pista">ejecuta ${escapar(c.autor)}</span>` : ''}
    </div>`;
  }).join('');
  const desc = motor.descubrir(estado.eje, m.foco, { camino: m.camino });
  const campos = desc.map((p) => {
    const opciones = p.candidatos.map((c, k) => `<option value="c${k}">${c.origen} ${corto(c.evento)} · ${escapar(c.texto.slice(0, 40))}</option>`).join('');
    return `<label class="celda-form"><span>${p.posicion} ${PV[p.posicion]}</span>
      <select name="e${p.posicion}"><option value="">— nada (se hereda del foco si existe) —</option>${opciones}<option value="nuevo">terminal nuevo ↓</option></select>
      <input name="n${p.posicion}" maxlength="120" placeholder="terminal nuevo para ${p.posicion}"></label>`;
  }).join('');
  return `
    <section class="fabrica">
      <div class="titulo">Fábrica (4) · consolidar no es ejecutar · ${lista.length} consolidación${lista.length === 1 ? '' : 'es'}</div>
      ${filas || '<div class="nada">nada consolidado sobre este foco</div>'}
      <form id="consolidar" class="escribir">
        <div class="titulo">Consolidar una acción como ${escapar(yo)}: elige por posición un candidato o escribe un terminal nuevo</div>
        <label>Título <input name="titulo" maxlength="80" value="Acción sobre ${escapar(breve(m.terminal ?? m.celdas[0].contenido))}"></label>
        <div class="decupla-form">${campos}</div>
        <button type="submit">Consolidar en la fábrica del foco</button>
        ${mensajes()}
      </form>
    </section>`;
}

function pintarMapped() {
  const m = mapped.mapa(estado.eje, estado.foco, { camino: estado.camino });
  const ev = estado.eje.obtener(estado.foco);
  const eje67 = tiempo.ejeTemporal(estado.eje, estado.foco, { camino: estado.camino });
  const comp = tiempo.comparar(estado.eje, estado.foco);
  const anim = estado.render === 'animado' ? hilosAnimados() : null;
  const e = escritura('mapped');
  const base = payloadEnFoco();
  const celdasForm = PV.map((n, i) => {
    // Lo mismo que hereda desdeMapped. [X] decidir VG (mapa §13): un foco terminal hereda su raíz en la
    // posición 0, como en main, aunque un terminal no tenga posición 0 en la décupla ni en el mapa (mapa §12).
    const hay = Array.isArray(base) ? base[i] !== undefined : i === 0 && base !== undefined;
    const ph = hay ? '← del foco: ' + breve(Array.isArray(base) ? base[i] : base) : 'vacía';
    return `<label class="celda-form"><span>${i} ${n}</span><textarea name="c${i}" rows="2" placeholder="${escapar(ph)}"></textarea></label>`;
  }).join('');
  $('#vista').innerHTML = cabecera(ev) + `<div class="matriz">${mapped.MATRIZ.flat().map((i) => celdaMapa(m, i, eje67, comp, anim)).join('')}</div>`
    + panelFabrica(m) + `
    <form id="escribir" data-modo="mapped" class="escribir">
      <div class="titulo">Escribir una décupla sobre el foco · Mapped escribe de ${e[0]} a ${e[1]} posiciones de 1000 · una línea por ítem</div>
      ${selectores()}
      <div class="decupla-form">${celdasForm}</div>
      <div class="pista">Las celdas vacías anteriores a la última escrita se heredan del foco por referencia; si el foco tampoco las tiene, es un hueco y se rechaza. Cada posición escrita mueve un minuto de T.</div>
      <button type="submit">Registrar la décupla en ${etiquetaEn()}</button>
      ${mensajes()}
    </form>`;
}

// ---------- Hilos (6 y 7): sobrio o animado, la misma lectura ----------

function hilosAnimados() {
  const datos = hilos.datosHilos(estado.eje, estado.foco, { camino: estado.camino });
  const nuevos = memoriaHilos.nuevos(estado.eje, { reproducir: estado.reproducir });
  estado.reproducir = false;
  return { datos, nuevos };
}

function pintarHilos() {
  const ev = estado.eje.obtener(estado.foco);
  let cuerpo;
  if (estado.render === 'animado') {
    const { datos, nuevos } = hilosAnimados();
    cuerpo = hilos.htmlHilos(datos, { nuevos });
  } else {
    const e = tiempo.ejeTemporal(estado.eje, estado.foco, { camino: estado.camino });
    const lista = (l, vacio) => `<div class="chips">${l.length ? l.map(chipTemporal).join('') : `<span class="nada">${vacio}</span>`}</div>`;
    cuerpo = `<section class="hilos-listas"><div class="titulo">6 ${PV[6]} · ${e.totalPasado}</div>${lista(e.pasado, 'génesis')}<div class="titulo">7 ${PV[7]} · ${e.totalFuturo}</div>${lista(e.futuro, 'nada proyectado')}</section>`;
  }
  $('#vista').innerHTML = cabecera(ev) + `<div class="pista">Hilos del foco (6 y 7) · render ${estado.render} · el mismo eje temporal en los dos</div>` + cuerpo;
}

// ---------- Cruz: hilos 6 y 7, cielo 8 y camino 9 alrededor del 5 ----------

function datosCaminoActual(foco = estado.foco, camino = estado.camino) {
  return mundoCamino.datosCamino(estado.eje, foco, { camino, identidad: estado.identidad });
}

function pintarCruz() {
  const ev = estado.eje.obtener(estado.foco);
  const animado = estado.render === 'animado';
  const anim = animado ? hilosAnimados() : null; // una sola lectura de la memoria: lo nuevo se anima en los cuatro brazos
  const nuevos = anim?.nuevos ?? new Set();
  const lista = (l, vacio) => `<div class="chips">${l.length ? l.map(chipTemporal).join('') : `<span class="nada">${vacio}</span>`}</div>`;
  const e = anim ? null : tiempo.ejeTemporal(estado.eje, estado.foco, { camino: estado.camino });
  const dCielo = cielo.datosCielo(estado.eje, estado.foco, { cohorte: estado.cohorte });
  const p = payloadEnFoco();
  const partes = {
    c8: animado ? cielo.htmlCielo(dCielo, { anterior: estado.cieloAnterior }) : cielo.htmlCieloSobrio(dCielo),
    c6: anim ? hilos.svgHilos(anim.datos, { ventana: 'pasado', compacto: true, nuevos }) : lista(e.pasado, 'génesis'),
    c5: cruz.htmlCentro(ev, { lente: breve(Array.isArray(p) ? p[0] : p), existe: (id) => Boolean(estado.eje.obtener(id)) }),
    c7: anim ? hilos.svgHilos(anim.datos, { ventana: 'futuro', compacto: true, nuevos }) : lista(e.futuro, 'nada proyectado'),
    c9: mundoCamino.htmlCamino(datosCaminoActual(), { animado, nuevos, previa: estado.previa, identidades: estado.eje.identidades() }),
  };
  $('#vista').innerHTML = cabecera(ev) + `<div class="pista">La cruz del foco · render ${estado.render} · el 5 en el centro; cielo, hilos y camino leen el mismo eje</div>`
    + mensajes() + cruz.htmlCruz(partes);
}

function cambiarCohorte(cohorte) {
  if (cohorte === estado.cohorte) return;
  try { estado.cieloAnterior = cielo.datosCielo(estado.eje, estado.foco, { cohorte: estado.cohorte }); } catch { estado.cieloAnterior = null; }
  estado.cohorte = cohorte;
  pintar();
}

/** Previsualiza un paso del camino: la operación real sobre una copia del eje; no escribe. Se ve en la cruz. */
async function previsualizarPaso(clave) {
  if (estado.previa?.clave === clave && estado.modo === 'cruz') { estado.previa = null; pintar(); return; }
  try {
    estado.previa = await mundoCamino.previsualizar(estado.eje, datosCaminoActual(), clave, { identidad: estado.identidad, privadaDe });
    estado.aviso = '';
  } catch (e) {
    estado.previa = null;
    estado.aviso = String(e.message ?? e);
  }
  estado.exito = '';
  estado.modo = 'cruz';
  pintar();
  document.querySelector(`.paso-c[data-clave="${CSS.escape(clave)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/** Consolida lo que propone el camino (motor.proponer), como quien mira: lo mismo que enseña su previsualización. */
async function consolidarPropuesta() {
  try {
    const { elecciones } = motor.proponer(estado.eje, estado.foco, { camino: estado.camino });
    const titulo = mundoCamino.tituloPropuesta(estado.eje, estado.foco, estado.camino);
    const c = await motor.consolidar(estado.eje, { autor: estado.identidad, foco: estado.foco, camino: estado.camino, elecciones, titulo }, privadaDe(estado.identidad));
    guardar();
    estado.aviso = '';
    estado.previa = null;
    estado.exito = 'Consolidado ' + corto(c.id) + ' desde la propuesta del camino · ' + motor.estadoDe(estado.eje, c.id).toLowerCase() + '. Autoriza quien tiene poder y no es el autor.';
    pintar();
  } catch (e) { fallo(e); }
}

// ---------- común ----------

function pintarSaldos() {
  const eje = estado.eje;
  // Cada familia es una serie: T por escala (tokens distintos, sin conversión), E por denominación, P por ámbito, R por emisor.
  const ESCALA = { segundo: 's', minuto: 'min', hora: 'h', dia: 'd', semana: 'sem', ciclo: 'cic', anio: 'a' };
  const tiempos = (id) => eje.tiempos(id).reverse().map((x) => x.cantidad + ' ' + ESCALA[x.escala]).join(' · ') || 'T 0'; // de la escala mayor a la menor
  // Las series «<plaza>@<noche>» (Booking: una por plaza y noche, nombrada con el id de la habitación) son muchas: se resumen por emisor.
  const esPlazaNoche = (denominacion) => denominacion.includes('@');
  const porEmisor = (lista) => {
    const m = new Map();
    for (const x of lista) m.set(x.emisor, { cantidad: (m.get(x.emisor)?.cantidad ?? 0) + x.cantidad, series: (m.get(x.emisor)?.series ?? 0) + 1 });
    return [...m];
  };
  const recursos = (id) => { // cada serie de E es de su emisor
    const deEmisor = (emisor) => (emisor === id ? '' : ' de ' + escapar(emisor));
    const todas = eje.recursos(id);
    const sueltas = todas.filter((x) => !esPlazaNoche(x.denominacion)).map((x) => x.cantidad + ' ' + (x.denominacion === 'EUR' ? '€' : escapar(x.denominacion)) + deEmisor(x.emisor));
    const plazas = porEmisor(todas.filter((x) => esPlazaNoche(x.denominacion))).map(([emisor, x]) => x.cantidad + ' plaza·noche' + deEmisor(emisor));
    return [...sueltas, ...plazas].join(' · ') || 'E 0';
  };
  const series = eje.series();
  const plazaNoche = (s) => s.token === 'E' && esPlazaNoche(s.denominacion);
  const emitidas = series.filter((s) => !plazaNoche(s)).map((s) => escapar(s.token + ':' + (s.token === 'P' && s.serie !== 'genesis' ? corto(s.serie) : s.serie)) + ' ' + s.emitido + (s.token === 'E' || s.token === 'R' ? '' : ' de ' + escapar(s.emisor)))
    .concat(porEmisor(series.filter(plazaNoche).map((s) => ({ emisor: s.emisor, cantidad: s.emitido }))).map(([emisor, x]) => escapar('E:' + emisor + '/<plaza>@<noche>') + ' ' + x.cantidad + ' en ' + x.series + ' series'));
  $('#saldos').innerHTML = eje.identidades().map((id) =>
    `<div class="saldo"><b>${escapar(id)}</b><span>${eje.clave(id) ? '🔑 ' + autoridad.huella(eje.clave(id)) : 'sin clave'}</span><span>${recursos(id)}</span><span>${tiempos(id)}</span><span>${eje.poderes(id).length ? eje.poderes(id).map((p) => 'P ' + p.cantidad + '@' + (p.ambito === 'genesis' ? 'eje' : corto(p.ambito))).join(' ') : 'P 0'}${eje.reputaciones(id).length ? ' · ' + eje.reputaciones(id).map((r) => 'R ' + r.cantidad + ' de ' + escapar(r.emisor)).join(' ') : ''}</span></div>`).join('')
    + `<div class="guardado">series emitidas · ${emitidas.join(' · ')}</div>`
    + `<div class="guardado">${escapar(estado.guardado)}</div>`;
}

function pintar() {
  document.querySelectorAll('[data-modo]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modo === estado.modo)));
  document.querySelectorAll('[data-render]').forEach((b) => b.setAttribute('aria-pressed', String(estado.render === 'animado')));
  if (estado.modo === 'pointed') pintarPointed();
  else if (estado.modo === 'mapped') pintarMapped();
  else if (estado.modo === 'hilos') pintarHilos();
  else if (estado.modo === 'cruz') pintarCruz();
  else pintarSequenced();
  estado.cieloAnterior = null; // la recomposición del cielo se ve una vez, al cambiar de cohorte
  pintarSaldos();
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
      ({ payload, heredadas } = salida.desdeMapped(eje, celdas, estado.foco, estado.camino));
    }
    const ev = await salida.escribirDesde(eje, { modo, autor: estado.identidad, sobre: estado.foco, en: direccionEn(), payload }, privadaDe(estado.identidad));
    guardar();
    estado.aviso = '';
    const n = ev.movimientos[0].cantidad;
    estado.exito = 'Registrado ' + corto(ev.id) + ' en ' + etiquetaEn() + ' sobre ' + corto(estado.foco) + ' · ' + n + (n === 1 ? ' posición, 1 minuto' : ' posiciones, ' + n + ' minutos') + ' de T'
      + (heredadas.length ? ' · heredadas del foco: ' + heredadas.join(', ') : '') + (ev.firma ? ' · firmado' : '') + '.';
    pintar();
  } catch (e) {
    fallo(e, form);
  }
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
    estado.exito = 'Consolidado ' + corto(c.id) + ' en la fábrica del foco · ' + motor.estadoDe(estado.eje, c.id).toLowerCase() + '. Autoriza quien tiene poder y no es el autor.';
    pintar();
  } catch (e) {
    fallo(e, form);
  }
}

async function autorizarDesdeBoton(id) {
  try {
    await motor.autorizar(estado.eje, { autorizante: estado.identidad, consolidacion: id }, privadaDe(estado.identidad));
    guardar();
    estado.aviso = '';
    estado.previa = null;
    estado.exito = 'Autorizado ' + corto(id) + ' por ' + estado.identidad + '. Ahora ejecuta su autor.';
    pintar();
  } catch (e) { fallo(e); }
}

async function ejecutarDesdeBoton(id) {
  try {
    const e = await motor.ejecutar(estado.eje, { autor: estado.identidad, consolidacion: id }, privadaDe(estado.identidad));
    guardar();
    estado.aviso = '';
    estado.previa = null;
    estado.exito = 'Ejecutado ' + corto(e.id) + ' con evidencia: consolidación y autorización en su hilo.';
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
  // En los mundos animados, los nodos del SVG llevan data-ir (hilos, camino) o data-previsualizar (las piedras del camino).
  const b = e.target.closest('button, svg [data-ir], svg [data-previsualizar]');
  if (!b) return;
  if (b.dataset.modo) { estado.modo = b.dataset.modo; estado.exito = ''; estado.aviso = ''; pintar(); }
  else if (b.dataset.render !== undefined) { estado.render = estado.render === 'animado' ? 'sobrio' : 'animado'; pintar(); }
  else if (b.dataset.reproducir !== undefined) { estado.reproducir = true; pintar(); }
  else if (b.dataset.cohorte) cambiarCohorte(b.dataset.cohorte);
  else if (b.dataset.previsualizar) previsualizarPaso(b.dataset.previsualizar);
  else if (b.dataset.consolidarPropuesta !== undefined) consolidarPropuesta();
  else if (b.dataset.ref) insertarRef(b.dataset.ref);
  else if (b.dataset.ocupantes !== undefined) { const i = Number(b.dataset.ocupantes); estado.verOcupantes = estado.verOcupantes === i ? null : i; pintar(); }
  else if (b.dataset.autorizar) autorizarDesdeBoton(b.dataset.autorizar);
  else if (b.dataset.ejecutar) ejecutarDesdeBoton(b.dataset.ejecutar);
  else if (b.dataset.posicion !== undefined) {
    estado.en = b.dataset.posicion; estado.exito = '';
    if (estado.modo === 'mapped' || estado.modo === 'cruz') estado.modo = 'pointed'; // la mano escribe en Pointed
    pintar();
  }
  else if (b.dataset.desarrollar !== undefined) { estado.camino = [...estado.camino, Number(b.dataset.desarrollar)]; estado.verOcupantes = null; pintar(); }
  else if (b.dataset.ir) irA(b.dataset.ir, b.dataset.dir ? indicesDe(b.dataset.dir) : []);
  else if (b.dataset.subir !== undefined) { estado.camino = estado.camino.slice(0, -1); estado.verOcupantes = null; pintar(); }
  else if (b.dataset.genesis !== undefined) irA(estado.eje.genesisId);
  else if (b.dataset.reiniciar !== undefined) reiniciar();
  else if (b.dataset.ejemplo !== undefined) { estado.ejemplo = estado.ejemplo === 'reserva' ? 'compra' : 'reserva'; reiniciar(); }
});

document.addEventListener('change', (e) => {
  if (e.target.name === 'identidad') { estado.identidad = e.target.value; estado.previa = null; pintar(); }
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

/** El botón dice la acción, no el estado: desde la compra se cambia a la reserva y al revés. */
function pintarBotonEjemplo() {
  $('[data-ejemplo]').textContent = estado.ejemplo === 'reserva' ? 'cambiar a comida' : 'cambiar a reserva';
}

/** Construye el eje del ejemplo elegido (estado.ejemplo: compra de comida o reserva de alojamiento) y guarda la elección en el navegador. */
async function ejemploNuevo() {
  try { globalThis.localStorage?.setItem(CLAVE_EJEMPLO, estado.ejemplo); } catch { /* sin almacenamiento */ }
  pintarBotonEjemplo();
  if (estado.ejemplo === 'reserva') {
    const { eje, reserva } = await ejemploReserva({ claves: estado.claves });
    return { eje, foco: reserva.id };
  }
  const { eje, compra } = await ejemploCompra({ claves: estado.claves });
  await ejemploCuenta(eje, compra, estado.claves.cocina?.privada);
  return { eje, foco: compra.id };
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

try { estado.ejemplo = globalThis.localStorage?.getItem(CLAVE_EJEMPLO) === 'reserva' ? 'reserva' : 'compra'; } catch { /* sin almacenamiento */ }
pintarBotonEjemplo();
estado.claves = await cargarClaves();
let cargado = await persistencia.cargarLocal(CLAVE_EJE);
let foco;
if (cargado && estado.claves.casa && JSON.stringify(cargado.clave('casa')) !== JSON.stringify(estado.claves.casa.publica)) cargado = null; // claves de otra sesión
if (cargado) {
  estado.eje = cargado;
  // Vuelve al foco donde se quedó (guardado al navegar); si no hay o ya no existe, al génesis.
  let recordado = null;
  try { recordado = globalThis.localStorage?.getItem(CLAVE_FOCO); } catch { /* sin almacenamiento */ }
  foco = recordado && cargado.obtener(recordado) ? recordado : cargado.genesisId;
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
$('#pv').textContent = PV.map((n, i) => i + ' ' + n).join(' · ');
pintar();
