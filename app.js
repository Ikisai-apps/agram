// Frontend de cartón piedra: Pointed, Sequenced y Mapped sobre el eje de
// ejemplo, en el navegador, con el mismo núcleo que corre en Node. Se lee y
// se escribe desde los tres modos con su proporción. Render sobrio; el
// animado se declara pendiente, no se simula.

import { pointed, sequenced, mapped, salida, indicesDe, direccion, esReferencia, escritura, leerDireccion, PV, RAIZ } from './src/index.js';
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';

const estado = { eje: null, foco: null, camino: [], modo: 'pointed', identidad: 'huesped', en: '4', aviso: '', exito: '' };
const $ = (sel) => document.querySelector(sel);

function corto(id) {
  return id.slice(0, 8);
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
  pintar();
}

function escapar(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function textoDe(c) {
  if (c === undefined) return '—';
  if (Array.isArray(c)) return c.length + (c.length === 1 ? ' posición' : ' posiciones');
  if (esReferencia(c)) return '→ ' + corto(c.ref) + (c.dir ? ' : ' + c.dir : '');
  return String(c);
}

function breve(c) {
  if (c === undefined) return '—';
  if (Array.isArray(c)) return '[' + c.length + ']';
  if (esReferencia(c)) return '→' + corto(c.ref);
  return String(c);
}

/** Dirección donde se anida lo escrito: la posición elegida bajo el camino actual, o la raíz. */
function direccionEn() {
  if (estado.en === '') return RAIZ;
  return direccion([...estado.camino, Number(estado.en)]);
}

function etiquetaEn() {
  return estado.en === '' ? 'la raíz del foco' : estado.en + ' ' + PV[Number(estado.en)];
}

function cabecera(ev) {
  const migas = estado.camino.length
    ? `<button class="miga" data-subir>↑ subir</button> <span class="ruta">profundidad ${estado.camino.length} · ${estado.camino.join(' › ')}</span>`
    : '';
  return `
    <div class="cab">
      <div><b>${corto(ev.id)}</b> · ${escapar(ev.autor)} · ${ev.t.replace('T', ' ').slice(0, 16)}</div>
      <div class="sub">${ev.sobre ? `sobre <button class="enlace" data-ir="${ev.sobre}">${corto(ev.sobre)}</button>` : 'génesis'} ${migas}</div>
    </div>`;
}

/** Selectores comunes de todo formulario de escritura: quién y en qué posición. */
function selectores() {
  const ids = estado.eje.identidades();
  return `
    <div class="dos">
      <label>Quién
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

// ---------- Pointed ----------

function pintarPointed() {
  const ev = estado.eje.obtener(estado.foco);
  const d = pointed.decupla({ ...ev, payload: payloadEnFoco() }, undefined, estado.camino.length);
  const filas = d.posiciones.map((p) => {
    const c = p.contenido;
    let accion = `data-posicion="${p.indice}"`;
    if (Array.isArray(c)) accion = `data-desarrollar="${p.indice}"`;
    else if (esReferencia(c)) accion = `data-ir="${c.ref}" data-dir="${c.dir ?? ''}"`;
    const escritos = estado.eje.sobre(estado.foco, direccion([...estado.camino, p.indice])).length;
    const marca = String(p.indice) === estado.en ? ' elegida' : '';
    const clase = 'pos' + (c === undefined ? ' vacia' : '') + (accion.startsWith('data-posicion') ? '' : ' activa') + marca;
    return `<button class="${clase}" ${accion}>
      <span class="idx">${p.indice}</span><span class="pv">${p.significado}</span><span class="val">${escapar(textoDe(c))}</span>${escritos ? `<span class="hijos" title="escrito en esta posición">↳ ${escritos}</span>` : ''}</button>`;
  });
  const e = escritura('pointed');
  $('#vista').innerHTML = cabecera(ev) + `<div class="decupla">${filas.join('')}</div>
    <form id="escribir" data-modo="pointed" class="escribir">
      <div class="titulo">Escribir sobre el foco · Pointed escribe ${e[1]} posición de 10 · lo escrito va en el PV donde se escribe</div>
      ${selectores()}
      <label>Un terminal <small>(texto, número o @id de otro registro)</small>
        <input name="texto" maxlength="120" placeholder="p. ej. «servido a las 14:05»" required>
      </label>
      <button type="submit">Registrar en ${etiquetaEn()} · mueve 1 minuto de T</button>
      ${mensajes()}
    </form>`;
}

// ---------- Sequenced ----------

function filaSecuencia(d, i) {
  const partes = d.posiciones.filter((p) => p.contenido !== undefined).map((p) => `<span class="celda-s"><i>${p.indice}</i>${escapar(breve(p.contenido))}</span>`);
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
  const inputs = PV.map((n, i) => `<input name="h${i}" maxlength="120" placeholder="${i} ${n}">`).join('');
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

function celdaMapa(m, i) {
  const c = m.celdas[i];
  const marca = c.escritos ? `<span class="hijos">↳ ${c.escritos}</span>` : '';
  if (i === 5) {
    const ev = estado.eje.obtener(m.foco);
    const json = JSON.stringify({ id: corto(ev.id), autor: ev.autor, sobre: ev.sobre ? corto(ev.sobre) : null, en: ev.en, t: ev.t, movimientos: ev.movimientos.length, payload: c.contenido }, null, 1);
    return `<div class="celda c5"><div class="pvn">5 ${c.significado} · 0 ${m.celdas[0].significado}</div>
      <div class="lente">${escapar(breve(m.celdas[0].contenido))}</div>
      <details><summary>estructura</summary><pre>${escapar(json)}</pre></details></div>`;
  }
  if (i === 6) {
    const hilo = [...m.hilo].reverse();
    return `<div class="celda c6"><div class="pvn">6 ${c.significado}</div><div class="chips">${hilo.length ? hilo.map((e) => chip(e)).join('') : '<span class="nada">génesis</span>'}</div>
      ${c.contenido !== undefined ? `<div class="val">${escapar(breve(c.contenido))}</div>` : ''}${marca}</div>`;
  }
  if (i === 7) {
    return `<div class="celda c7"><div class="pvn">7 ${c.significado}</div><div class="chips">${m.hijos.length ? m.hijos.map((e) => chip(e, e.en && e.en !== RAIZ ? ' <i>en ' + indicesDe(e.en).join('›') + '</i>' : '')).join('') : '<span class="nada">nada escrito después</span>'}</div>
      ${c.contenido !== undefined ? `<div class="val">${escapar(breve(c.contenido))}</div>` : ''}</div>`;
  }
  if (i === 8) {
    const d = m.medidas;
    return `<div class="celda c8"><div class="pvn">8 ${c.significado}</div><div class="medidas">
      <span>hilo <b>${d.profundidadHilo}</b></span><span>escritos <b>${d.escritos}</b></span><span>movimientos <b>${d.movimientos}</b></span><span>identidades <b>${d.identidades}</b></span><span>posiciones <b>${d.posicionesDesarrolladas}</b></span></div>
      ${c.contenido !== undefined ? `<div class="val">${escapar(breve(c.contenido))}</div>` : ''}${marca}</div>`;
  }
  if (i === 9) {
    const pasos = m.camino.length ? m.camino.map((p) => `<span class="paso">${p} ${PV[p]}</span>`).join(' › ') : '<span class="nada">en la raíz del foco</span>';
    return `<div class="celda c9"><div class="pvn">9 ${c.significado}</div><div class="pasos">${pasos}</div>
      ${c.contenido !== undefined ? `<div class="val">${escapar(breve(c.contenido))}</div>` : ''}${marca}</div>`;
  }
  const ct = c.contenido;
  let accion = `data-posicion="${i}"`;
  if (Array.isArray(ct)) accion = `data-desarrollar="${i}"`;
  else if (esReferencia(ct)) accion = `data-ir="${ct.ref}" data-dir="${ct.dir ?? ''}"`;
  return `<button class="celda esquina ${ct === undefined ? 'vacia' : ''}" ${accion}><div class="pvn">${i} ${c.significado}</div>
    <div class="val">${escapar(textoDe(ct))}</div>${marca}</button>`;
}

function pintarMapped() {
  const m = mapped.mapa(estado.eje, estado.foco, { camino: estado.camino });
  const ev = estado.eje.obtener(estado.foco);
  const e = escritura('mapped');
  const base = payloadEnFoco();
  const celdasForm = PV.map((n, i) => {
    const hay = Array.isArray(base) ? base[i] !== undefined : i === 0 && base !== undefined;
    const ph = hay ? '← del foco: ' + breve(Array.isArray(base) ? base[i] : base) : 'vacía';
    return `<label class="celda-form"><span>${i} ${n}</span><textarea name="c${i}" rows="2" placeholder="${escapar(ph)}"></textarea></label>`;
  }).join('');
  $('#vista').innerHTML = cabecera(ev) + `<div class="matriz">${mapped.MATRIZ.flat().map((i) => celdaMapa(m, i)).join('')}</div>
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
    `<div class="saldo"><b>${escapar(id)}</b><span>${eje.saldo(id, 'E:EUR')} €</span><span>${Math.round(eje.saldoT(id, 'hora') * 100) / 100} h</span><span>P ${eje.saldo(id, 'P')}</span></div>`).join('');
}

function pintar() {
  document.querySelectorAll('[data-modo]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modo === estado.modo)));
  if (estado.modo === 'pointed') pintarPointed();
  else if (estado.modo === 'mapped') pintarMapped();
  else pintarSequenced();
  pintarSaldos();
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
    const ev = await salida.escribirDesde(eje, { modo, autor: estado.identidad, sobre: estado.foco, en: direccionEn(), payload });
    estado.aviso = '';
    const n = ev.movimientos[0].cantidad;
    estado.exito = 'Registrado ' + corto(ev.id) + ' en ' + etiquetaEn() + ' sobre ' + corto(estado.foco) + ' · ' + n + (n === 1 ? ' posición, 1 minuto' : ' posiciones, ' + n + ' minutos') + ' de T'
      + (heredadas.length ? ' · heredadas del foco: ' + heredadas.join(', ') : '') + '. Se ve en «escrito sobre el foco» y en la celda 7.';
    pintar();
  } catch (e) {
    estado.aviso = e.message.replace(/^evento (rechazado|mal formado): /, '');
    estado.exito = '';
    pintar();
    const campo = form.querySelector('input[name="texto"], input[name="h0"], textarea[name="c0"]');
    if (campo) campo.focus();
  }
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
  else if (b.dataset.posicion !== undefined) {
    estado.en = b.dataset.posicion; estado.exito = '';
    if (estado.modo === 'mapped') estado.modo = 'pointed'; // la mano escribe en Pointed
    pintar();
  }
  else if (b.dataset.desarrollar !== undefined) { estado.camino = [...estado.camino, Number(b.dataset.desarrollar)]; pintar(); }
  else if (b.dataset.ir) irA(b.dataset.ir, b.dataset.dir ? indicesDe(b.dataset.dir) : []);
  else if (b.dataset.subir !== undefined) { estado.camino = estado.camino.slice(0, -1); pintar(); }
  else if (b.dataset.genesis !== undefined) irA(estado.eje.genesisId);
});

document.addEventListener('submit', (e) => {
  if (e.target.id === 'escribir') { e.preventDefault(); registrar(e.target); }
});

const { eje, compra } = await ejemploCompra();
estado.eje = eje;
estado.foco = compra.id;
$('#pv').textContent = PV.map((n, i) => i + ' ' + n).join(' · ');
pintar();
