// Frontend de cartón piedra: Pointed y Sequenced sobre el eje de ejemplo, en
// el navegador, con el mismo núcleo que corre en Node. Render sobrio; el
// animado se declara pendiente, no se simula.

import { pointed, sequenced, indicesDe, esReferencia, escritura, PV } from './src/index.js';
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';

const estado = { eje: null, foco: null, camino: [], modo: 'pointed', identidad: 'huesped', aviso: '' };
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
  pintar();
}

function textoDe(c) {
  if (c === undefined) return '—';
  if (Array.isArray(c)) return c.length + (c.length === 1 ? ' posición' : ' posiciones');
  if (esReferencia(c)) return '→ ' + corto(c.ref) + (c.dir ? ' : ' + c.dir : '');
  return String(c);
}

function pintarPointed() {
  const ev = estado.eje.obtener(estado.foco);
  const d = pointed.decupla({ ...ev, payload: payloadEnFoco() }, undefined, estado.camino.length);
  const filas = d.posiciones.map((p) => {
    const c = p.contenido;
    let accion = '';
    if (Array.isArray(c)) accion = `data-desarrollar="${p.indice}"`;
    else if (esReferencia(c)) accion = `data-ir="${c.ref}" data-dir="${c.dir ?? ''}"`;
    const clase = 'pos' + (c === undefined ? ' vacia' : '') + (accion ? ' activa' : '');
    return `<button class="${clase}" ${accion} ${accion ? '' : 'disabled'}>
      <span class="idx">${p.indice}</span><span class="pv">${p.significado}</span><span class="val">${escapar(textoDe(c))}</span></button>`;
  });
  const migas = estado.camino.length
    ? `<button class="miga" data-subir>↑ subir</button> <span class="ruta">profundidad ${estado.camino.length} · ${estado.camino.join(' › ')}</span>`
    : '';
  $('#vista').innerHTML = `
    <div class="cab">
      <div><b>${corto(ev.id)}</b> · ${escapar(ev.autor)} · ${ev.t.replace('T', ' ').slice(0, 16)}</div>
      <div class="sub">${ev.sobre ? `sobre <button class="enlace" data-ir="${ev.sobre}">${corto(ev.sobre)}</button>` : 'génesis'} ${migas}</div>
    </div>
    <div class="decupla">${filas.join('')}</div>
    ${pintarEscritura()}`;
}

function pintarEscritura() {
  const e = escritura('pointed');
  const ids = estado.eje.identidades();
  return `
    <form id="escribir" class="escribir">
      <div class="titulo">Escribir sobre el foco · Pointed escribe ${e[1]} posición de 10</div>
      <label>Quién
        <select name="identidad">${ids.map((i) => `<option ${i === estado.identidad ? 'selected' : ''}>${i}</option>`).join('')}</select>
      </label>
      <label>Una posición (un terminal)
        <input name="texto" maxlength="120" placeholder="p. ej. «servido a las 14:05»" required>
      </label>
      <button type="submit">Registrar · mueve 1 minuto de T</button>
      ${estado.aviso ? `<div class="aviso">${escapar(estado.aviso)}</div>` : ''}
    </form>`;
}

function filaSecuencia(d, i) {
  const partes = d.posiciones.filter((p) => p.contenido !== undefined).map((p) => `<span class="celda"><i>${p.indice}</i>${escapar(breve(p.contenido))}</span>`);
  return `<button class="fila" data-ir="${d.id}"><span class="n">${i}</span><span class="quien">${corto(d.id)} · ${escapar(d.autor)}</span><span class="celdas">${partes.join('')}</span></button>`;
}

function breve(c) {
  if (Array.isArray(c)) return '[' + c.length + ']';
  if (esReferencia(c)) return '→' + corto(c.ref);
  return String(c);
}

function pintarSequenced() {
  const hilo = sequenced.secuencia(estado.eje, estado.foco, { sentido: 'hilo' });
  const hijos = sequenced.secuencia(estado.eje, estado.foco, { sentido: 'hijos' });
  const bloque = (s, titulo) => `
    <section class="hilera">
      <div class="titulo">${titulo} · ${s.decuplas.length} de ${s.total}</div>
      ${s.decuplas.length ? s.decuplas.map(filaSecuencia).join('') : '<div class="nada">nada todavía</div>'}
    </section>`;
  $('#vista').innerHTML = bloque(hilo, 'Hilo hacia el génesis') + bloque(hijos, 'Escrito sobre el foco');
}

function pintarSaldos() {
  const eje = estado.eje;
  $('#saldos').innerHTML = eje.identidades().map((id) =>
    `<div class="saldo"><b>${escapar(id)}</b><span>${eje.saldo(id, 'E:EUR')} €</span><span>${Math.round(eje.saldoT(id, 'hora') * 100) / 100} h</span><span>P ${eje.saldo(id, 'P')}</span></div>`).join('');
}

function pintar() {
  document.querySelectorAll('[data-modo]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modo === estado.modo)));
  if (estado.modo === 'pointed') pintarPointed();
  else pintarSequenced();
  pintarSaldos();
}

function escapar(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

async function registrar(form) {
  const datos = new FormData(form);
  estado.identidad = datos.get('identidad');
  const texto = String(datos.get('texto') ?? '').trim();
  if (!texto) return;
  try {
    const ev = await estado.eje.escribir({
      autor: estado.identidad,
      sobre: estado.foco,
      t: new Date().toISOString(),
      movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: estado.identidad, a: null }],
      payload: texto,
      contexto: { modo: 'pointed', camino: estado.camino.join('') },
    });
    estado.aviso = '';
    irA(ev.id);
  } catch (e) {
    estado.aviso = e.message.replace(/^evento rechazado: /, '');
    pintar();
  }
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.modo) { estado.modo = b.dataset.modo; pintar(); }
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
