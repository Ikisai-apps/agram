// Frontend de cartón piedra: Pointed, Sequenced y Mapped sobre el eje de
// ejemplo, en el navegador, con el mismo núcleo que corre en Node. Se lee y
// se escribe desde los tres modos con su proporción; cada identidad firma
// con su clave; la fábrica consolida, autoriza y ejecuta; el eje se guarda
// en el navegador. Render sobrio; el animado se declara pendiente.

import {
  pointed, sequenced, mapped, salida, bql, encaje, motor, tiempo, autoridad, persistencia,
  indicesDe, direccion, esReferencia, escritura, leerDireccion, PV, RAIZ,
} from './src/index.js';
import { ejemploCompra, ejemploCuenta } from './ejemplos/ikisai/compra-food.mjs';

const estado = {
  eje: null, foco: null, camino: [], modo: 'pointed', identidad: 'huesped', en: '4',
  aviso: '', exito: '', verOcupantes: null, claves: {}, guardado: '',
};
const $ = (sel) => document.querySelector(sel);
const CLAVE_EJE = 'agram.eje';
const CLAVE_CLAVES = 'agram.claves';

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
    const r = o.origen === 'escrito' ? bql.evaluar(estado.eje, o.evento, [0]) : bql.evaluar(estado.eje, o.evento, o.dir);
    const quien = o.autor ? ' · ' + escapar(o.autor) : '';
    return `<button class="chip" data-ir="${o.evento}" ${o.origen !== 'escrito' && o.dir !== RAIZ ? `data-dir="${o.dir}"` : ''}><i>${o.origen}</i> <b>${corto(o.evento)}</b>${quien} · ${escapar(r.texto)}</button>`;
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
  $('#vista').innerHTML = cabecera(ev) + `<div class="decupla">${filas.join('')}</div>
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
  const partes = d.posiciones.filter((p) => p.contenido !== undefined).map((p) => `<span class="celda-s"><i>${p.indice}</i>${slot(p.contenido, d.id, [p.indice], false)}</span>`);
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

function celdaMapa(m, i, eje67, comp) {
  const c = m.celdas[i];
  const marca = c.escritos ? `<span class="hijos">↳ ${c.escritos}</span>` : '';
  const propio = c.contenido !== undefined ? `<div class="val">${slot(c.contenido, m.foco, [...m.camino, i], false)}</div>` : '';
  if (i === 5) {
    const ev = estado.eje.obtener(m.foco);
    const json = JSON.stringify({ id: corto(ev.id), autor: ev.autor, firmante: ev.firmante ?? null, sobre: ev.sobre ? corto(ev.sobre) : null, en: ev.en, t: ev.t, movimientos: ev.movimientos, contexto: ev.contexto, payload: c.contenido }, null, 1);
    return `<div class="celda c5"><div class="pvn">5 ${c.significado} · 0 ${m.celdas[0].significado}</div>
      <div class="lente">${escapar(breve(m.celdas[0].contenido))}</div>
      <details><summary>estructura</summary><pre>${escapar(json)}</pre></details></div>`;
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
      ${c.estado === 'PENDIENTE DE AUTORIZACIÓN' && !puedeAut ? `<span class="pista">${yo === c.autor ? 'el autor no se autoriza a sí mismo' : yo + ' no tiene poder (P)'}</span>` : ''}
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
        <label>Título <input name="titulo" maxlength="80" value="Acción sobre ${escapar(breve(m.celdas[0].contenido))}"></label>
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
  const e = escritura('mapped');
  const base = payloadEnFoco();
  const celdasForm = PV.map((n, i) => {
    const hay = Array.isArray(base) ? base[i] !== undefined : i === 0 && base !== undefined;
    const ph = hay ? '← del foco: ' + breve(Array.isArray(base) ? base[i] : base) : 'vacía';
    return `<label class="celda-form"><span>${i} ${n}</span><textarea name="c${i}" rows="2" placeholder="${escapar(ph)}"></textarea></label>`;
  }).join('');
  $('#vista').innerHTML = cabecera(ev) + `<div class="matriz">${mapped.MATRIZ.flat().map((i) => celdaMapa(m, i, eje67, comp)).join('')}</div>`
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

// ---------- común ----------

function pintarSaldos() {
  const eje = estado.eje;
  $('#saldos').innerHTML = eje.identidades().map((id) =>
    `<div class="saldo"><b>${escapar(id)}</b><span>${eje.clave(id) ? '🔑 ' + autoridad.huella(eje.clave(id)) : 'sin clave'}</span><span>${eje.saldo(id, 'E:EUR')} €</span><span>${Math.round(eje.saldoT(id, 'hora') * 100) / 100} h</span><span>P ${eje.saldo(id, 'P')}</span></div>`).join('')
    + `<div class="guardado">${escapar(estado.guardado)}</div>`;
}

function pintar() {
  document.querySelectorAll('[data-modo]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modo === estado.modo)));
  if (estado.modo === 'pointed') pintarPointed();
  else if (estado.modo === 'mapped') pintarMapped();
  else pintarSequenced();
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
    estado.exito = 'Autorizado ' + corto(id) + ' por ' + estado.identidad + '. Ahora ejecuta su autor.';
    pintar();
  } catch (e) { fallo(e); }
}

async function ejecutarDesdeBoton(id) {
  try {
    const e = await motor.ejecutar(estado.eje, { autor: estado.identidad, consolidacion: id }, privadaDe(estado.identidad));
    guardar();
    estado.aviso = '';
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
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.modo) { estado.modo = b.dataset.modo; estado.exito = ''; estado.aviso = ''; pintar(); }
  else if (b.dataset.ref) insertarRef(b.dataset.ref);
  else if (b.dataset.ocupantes !== undefined) { const i = Number(b.dataset.ocupantes); estado.verOcupantes = estado.verOcupantes === i ? null : i; pintar(); }
  else if (b.dataset.autorizar) autorizarDesdeBoton(b.dataset.autorizar);
  else if (b.dataset.ejecutar) ejecutarDesdeBoton(b.dataset.ejecutar);
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

async function cargarClaves() {
  try {
    const guardadas = JSON.parse(globalThis.localStorage?.getItem(CLAVE_CLAVES) ?? 'null');
    if (guardadas) {
      const claves = {};
      for (const [id, par] of Object.entries(guardadas)) claves[id] = { publica: par.publica, privada: await autoridad.importarPrivada(par.privada) };
      return claves;
    }
  } catch { /* sin claves guardadas */ }
  const claves = {};
  const exportables = {};
  for (const id of ['casa', 'cocina', 'huesped']) {
    claves[id] = await autoridad.generarClaves();
    exportables[id] = { publica: claves[id].publica, privada: await autoridad.exportarPrivada(claves[id].privada) };
  }
  try { globalThis.localStorage?.setItem(CLAVE_CLAVES, JSON.stringify(exportables)); } catch { /* sin almacenamiento */ }
  return claves;
}

async function ejemploNuevo() {
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

estado.claves = await cargarClaves();
let cargado = await persistencia.cargarLocal(CLAVE_EJE);
let foco;
if (cargado && estado.claves.casa && JSON.stringify(cargado.clave('casa')) !== JSON.stringify(estado.claves.casa.publica)) cargado = null; // claves de otra sesión
if (cargado) {
  estado.eje = cargado;
  foco = cargado.orden[3] ?? cargado.genesisId;
  estado.guardado = 'cargado del navegador · ' + cargado.orden.length + ' registros';
} else {
  const nuevo = await ejemploNuevo();
  estado.eje = nuevo.eje;
  foco = nuevo.foco;
  guardar();
}
estado.foco = foco;
$('#pv').textContent = PV.map((n, i) => i + ' ' + n).join(' · ');
pintar();
