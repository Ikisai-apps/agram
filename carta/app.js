// El arranque de la carta en el navegador: el eje de ejemplo (o el guardado), las claves de las identidades de prueba,
// el libro local de quien mira, el estado de la pantalla y el ciclo medir → pedir el árbol (carta/carta.js) → pintar
// (carta/dom.js) → enganchar gestos (carta/gestos.js). La fontanería es la de la web antigua (antigua/ui/ejemplos.js,
// antigua/ui/leido.js, antigua/ui/comun.js y las mismas claves de localStorage): el mismo eje y las mismas claves
// sirven a las dos webs. Nada real: identidades de ejemplo con claves generadas en este navegador.

import { autoridad, persistencia, local, salida, contrato, acciones, direccion, leerEvento } from '../src/index.js';
import { arbol, enviar, preferencias, NIVEL, LATERALES, CENTROS } from './carta.js';
import { html, trasPintar } from './dom.js';
import { instalar } from './gestos.js';
import { EJEMPLOS, crearEjemplo, restaurarEjemplo, elegirEjemplo, ejemploElegido } from '../antigua/ui/ejemplos.js';
import { alternarLeido, leidoAbierto } from '../antigua/ui/leido.js';
import { leerLocal, guardarLocal } from '../antigua/ui/comun.js';

const CLAVE_EJE = 'agram.eje';
const CLAVE_CLAVES = 'agram.claves';
const CLAVE_FOCO = 'agram.foco';
const CLAVE_YO = 'agram.yo';
const CLAVE_LOCAL = 'agram.local.';
const IDENTIDADES_EJEMPLO = ['casa', 'cocina', 'huesped', 'recepcion'];

const raiz = document.querySelector('#carta');
const estado = {
  eje: null, claves: {}, identidad: null, foco: { X: null, pv: 0 }, niveles: {}, paginas: {}, aro: null, formulario: null,
  rosetones: {}, local: null, leido: leidoAbierto(), aviso: '', exito: '', guardado: '', config: false, motivosPreferencias: [],
  vistos: new Set(), nuevos: new Set(), hermanos: null,
};
let limpiarLottie = () => {};
let gestos = null;
let pintando = null;

const privadaDe = (id) => estado.claves[id]?.privada;
const firmarCon = (id) => (privadaDe(id) ? (ev) => autoridad.firmar(ev, privadaDe(id)) : undefined);
const medidas = () => ({ ancho: Math.max(240, window.innerWidth), alto: Math.max(320, window.innerHeight) });

/** Las claves de las identidades de ejemplo guardadas en este navegador; se generan las que falten (como la web antigua). */
async function cargarClaves() {
  const claves = {};
  const exportables = {};
  try {
    const guardadas = JSON.parse(leerLocal(CLAVE_CLAVES) ?? 'null') ?? {};
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
  if (nuevas) guardarLocal(CLAVE_CLAVES, JSON.stringify(exportables));
  return claves;
}

function guardar() {
  const ok = persistencia.guardarLocal(estado.eje, CLAVE_EJE);
  estado.guardado = ok ? 'guardado en este navegador · ' + estado.eje.orden.length + ' registros' : 'sin almacenamiento: nada se guarda al recargar';
  guardarLibroLocal();
}

/** El libro local de quien mira: el guardado en este navegador (vuelve a quemar cada segundo) o uno nuevo. */
function abrirLibroLocal() {
  const id = estado.identidad;
  if (!id) { estado.local = null; return; }
  try {
    const datos = JSON.parse(leerLocal(CLAVE_LOCAL + id) ?? 'null');
    estado.local = datos ? local.LibroLocal.restaurar(estado.eje, datos) : new local.LibroLocal(estado.eje, id);
  } catch {
    estado.local = new local.LibroLocal(estado.eje, id);
  }
}

function guardarLibroLocal() {
  if (estado.local) guardarLocal(CLAVE_LOCAL + estado.identidad, JSON.stringify(estado.local.serializar()));
}

/** Cada toque gasta un segundo del libro local; si no queda, el motivo que da la época se enseña y no se corta nada. */
function tocar(X, accion) {
  if (!estado.local || !X || !estado.eje.obtener(X)) return;
  const r = accion ? estado.local.tocar(X, accion) : estado.local.ver(X);
  if (!r.ok) estado.aviso = r.motivo;
  guardarLibroLocal();
}

/** Lo nuevo desde la última vez: los ids del diario del foco que aún no se habían visto (lo que el animado anima). */
function marcarNuevos() {
  const X = estado.foco.X;
  if (!X) return;
  const d = contrato.diario(estado.eje, X, 0, 100);
  estado.nuevos = new Set(d.entradas.map((e) => e.id).filter((id) => !estado.vistos.has(id) && estado.vistos.size));
  for (const e of d.entradas) estado.vistos.add(e.id);
}

async function pintar() {
  if (pintando) { pintando.otra = true; return pintando.promesa; }
  const marca = { otra: false };
  pintando = marca;
  marca.promesa = (async () => {
    let a;
    try {
      a = await arbol(estado, estado.eje, estado.identidad, medidas());
    } catch (e) {
      a = { vacio: true, avisos: ['la carta no se ha podido pintar: ' + (e.message ?? e)] };
      console.error(e);
    }
    const extra = {
      ejemplos: EJEMPLOS.map((e) => ({ id: e.id, etiqueta: e.etiqueta })), ejemplo: ejemploElegido(), guardado: estado.guardado, aviso: estado.aviso, exito: estado.exito, nuevos: estado.nuevos,
      leidoTexto: estado.leido && estado.foco.X ? leerTexto(estado.foco.X) : undefined,
      preferencias: estado.config ? preferencias(estado.eje, estado.identidad) : null, motivosPreferencias: estado.motivosPreferencias,
    };
    limpiarLottie();
    raiz.innerHTML = html(a, extra);
    limpiarLottie = a.animado ? trasPintar(raiz) : () => {};
    gestos?.observar();
    if (estado.foco.X) guardarLocal(CLAVE_FOCO, estado.foco.X);
    document.documentElement.classList.toggle('animado', Boolean(a.animado));
    if (a.animado) cargarLottie();
  })().finally(() => {
    const otra = marca.otra;
    pintando = null;
    if (otra) pintar();
  });
  return marca.promesa;
}

function leerTexto(X) {
  try {
    return leerEvento(estado.eje, X);
  } catch (e) {
    return 'no se puede leer: ' + (e.message ?? e);
  }
}

/** lottie-web se carga solo si hace falta (render animado), desde cdnjs con su SRI (el mismo que pruebas/carta/). */
let lottiePedido = false;
function cargarLottie() {
  if (lottiePedido || globalThis.lottie) return;
  lottiePedido = true;
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js';
  s.integrity = 'sha512-jEnuDt6jfecCjthQAJ+ed0MTVA++5ZKmlUcmDGBv2vUI/REn6FuIdixLNnQT+vKusE2hhTk2is3cFvv5wA+Sgg==';
  s.crossOrigin = 'anonymous';
  s.referrerPolicy = 'no-referrer';
  s.onload = () => pintar();
  s.onerror = () => { estado.aviso = 'lottie-web no se ha podido cargar: las piezas animadas quedan como su forma sobria'; pintar(); };
  document.head.appendChild(s);
}

function limpiarMensajes() {
  estado.aviso = '';
  estado.exito = '';
}

/** Enfocar un registro (o un PV de un registro como foco). */
function irA(X, pv = 0) {
  if (!estado.eje.obtener(X)) return;
  const cambia = estado.foco.X !== X;
  estado.foco = { X, pv };
  if (cambia) { estado.niveles = {}; estado.paginas = {}; estado.aro = null; estado.formulario = null; }
  limpiarMensajes();
  tocar(X, cambia ? null : 'pv ' + pv);
  marcarNuevos();
  pintar();
}

const manejadores = {
  nivel(pv, delta, X) {
    const actual = estado.niveles[pv] ?? NIVEL.comprimido;
    const siguiente = actual + delta;
    if (siguiente > NIVEL.bloque) { irA(X ?? estado.foco.X, pv); return; } // el siguiente gesto no es un tamaño: entrar en el PV
    estado.niveles[pv] = Math.max(NIVEL.comprimido, siguiente);
    limpiarMensajes();
    tocar(X ?? estado.foco.X, 'nivel ' + pv + ' ' + estado.niveles[pv]);
    pintar();
  },
  profundidad(delta, pv, X) {
    if (pv !== null && pv !== undefined) return manejadores.nivel(pv, delta, X);
    // Sin PV: todos los laterales a la vez.
    for (const k of LATERALES) estado.niveles[k] = Math.min(NIVEL.bloque, Math.max(NIVEL.comprimido, (estado.niveles[k] ?? NIVEL.comprimido) + delta));
    tocar(estado.foco.X, 'profundidad ' + delta);
    pintar();
  },
  foco(X, pv) { irA(X, pv); },
  voltear() {
    const [anverso, reverso] = CENTROS;
    estado.foco.pv = estado.foco.pv === anverso ? reverso : anverso;
    limpiarMensajes();
    tocar(estado.foco.X, 'voltear ' + estado.foco.pv);
    pintar();
  },
  editar(X, pv) {
    const input = raiz.querySelector(`[data-centro] [data-campo="${pv}"]`);
    if (input) { input.focus(); input.select?.(); }
  },
  aro(X, pv, { desplegar } = {}) {
    if (!X) return;
    estado.aro = { X, pv: desplegar ? (estado.aro?.pv === pv ? null : pv) : null };
    estado.formulario = null;
    limpiarMensajes();
    tocar(X, 'aro' + (pv !== null && pv !== undefined ? ' ' + pv : ''));
    pintar();
  },
  lanzar(X, accion, paso) {
    const sobre = X ?? estado.aro?.X ?? estado.foco.X;
    estado.formulario = { X: sobre, accion, valores: {}, motivos: [], resultado: null, paso };
    estado.aro = null;
    limpiarMensajes();
    tocar(sobre, 'lanzar ' + accion);
    pintar();
  },
  cerrar() {
    if (estado.config) { estado.config = false; estado.motivosPreferencias = []; }
    else if (estado.formulario) estado.formulario = null;
    else if (estado.aro) estado.aro = null;
    else return;
    pintar();
  },
  async enviar(form) {
    const f = estado.formulario;
    if (!f) return;
    const valores = {};
    for (const input of form.querySelectorAll('input[name]')) {
      const v = input.value.trim();
      if (v === '') continue;
      const tipo = input.dataset.tipo;
      if (tipo === 'number') valores[input.name] = Number(v);
      else if (/^[[{]/.test(v)) { try { valores[input.name] = JSON.parse(v); } catch { valores[input.name] = v; } } else valores[input.name] = v;
    }
    f.valores = valores;
    const r = await enviar(estado.eje, f.X, f.accion, valores, estado.identidad, firmarCon(estado.identidad));
    if (r.ok && r.asentado) {
      guardar();
      estado.formulario = null;
      estado.exito = f.accion + ': registrado ' + r.asentado.id.slice(0, 8) + (r.asentado.firma ? ' · firmado' : '');
      tocar(f.X, 'hecho ' + f.accion);
      marcarNuevos();
    } else if (r.ok && r.lectura) {
      f.resultado = r.lectura.mensaje;
      f.motivos = [];
    } else if (r.ok && !r.evento) {
      f.resultado = r.pasos ? r.pasos.length + ' pasos míos' : r.paso ? 'el paso: ' + (r.paso.hacer?.plantilla ?? r.paso.falta) : 'nada que hacer';
      f.motivos = [];
    } else {
      f.motivos = r.motivos;
      f.resultado = null;
    }
    pintar();
  },
  async configurar(form) {
    if (!form) { estado.config = true; estado.motivosPreferencias = []; estado.formulario = null; estado.aro = null; pintar(); return; }
    const valores = {};
    for (const input of form.querySelectorAll('input[name]')) valores[input.name] = input.value.trim().split(/\s+/).filter(Boolean);
    const p = preferencias(estado.eje, estado.identidad, valores);
    if (!p) { estado.motivosPreferencias = [{ mensaje: 'sin alta: nadie a quien configurar' }]; pintar(); return; }
    try {
      await salida.escribirDesde(estado.eje, { modo: 'sequenced', autor: estado.identidad, sobre: p.sobre, en: p.en, payload: p.payload }, privadaDe(estado.identidad));
      guardar();
      estado.config = false;
      estado.motivosPreferencias = [];
      estado.exito = 'configuración guardada como un registro de mi alta';
    } catch (e) {
      estado.motivosPreferencias = [{ mensaje: String(e.message ?? e).replace(/^evento (rechazado|mal formado): /, '') }];
    }
    pintar();
  },
  async campo(X, pv, texto) {
    try {
      const ev = await salida.escribirDesde(estado.eje, { modo: 'pointed', autor: estado.identidad, sobre: X, en: direccion([pv]), payload: salida.desdePointed(estado.eje, texto) }, privadaDe(estado.identidad));
      guardar();
      estado.exito = 'escrito ' + ev.id.slice(0, 8) + ' en ' + pv + ' sobre ' + X.slice(0, 8) + (ev.firma ? ' · firmado' : '');
      estado.aviso = '';
      tocar(X, 'escribir ' + pv);
      marcarNuevos();
    } catch (e) {
      estado.aviso = String(e.message ?? e).replace(/^evento (rechazado|mal formado): /, '');
    }
    pintar();
  },
  cargarMas(pv) {
    estado.paginas[pv] = (estado.paginas[pv] ?? 1) + 1;
    tocar(estado.foco.X, 'cargar más ' + pv);
    pintar();
  },
  roseton(pv) {
    const alta = estado.eje.alta(estado.identidad)?.id;
    const actual = estado.rosetones[pv] ?? NIVEL.comprimido;
    if (actual >= NIVEL.tarjeta) { estado.rosetones = {}; if (alta) irA(alta, pv); return; } // el segundo toque lo hace foco
    estado.rosetones = { [pv]: NIVEL.tarjeta };
    if (alta) tocar(alta, 'rosetón ' + pv);
    pintar();
  },
  leido() {
    estado.leido = alternarLeido();
    tocar(estado.foco.X, 'leído');
    pintar();
  },
  async englobar() {
    if (!estado.local) return;
    try {
      const ev = await estado.local.englobar(firmarCon(estado.identidad), { nota: 'un rato en la carta' });
      guardar();
      estado.exito = ev ? 'este rato queda en el eje como un minuto: ' + ev.id.slice(0, 8) : 'nada que englobar';
      estado.aviso = '';
      marcarNuevos();
    } catch (e) {
      estado.aviso = String(e.message ?? e).replace(/^evento (rechazado|mal formado): /, '');
    }
    pintar();
  },
  quien(id) {
    if (!estado.eje.identidades().includes(id)) return;
    guardarLibroLocal();
    estado.identidad = id;
    guardarLocal(CLAVE_YO, id);
    abrirLibroLocal();
    estado.aro = null;
    estado.formulario = null;
    estado.rosetones = {};
    limpiarMensajes();
    pintar();
  },
  async ejemplo(id) {
    if (!EJEMPLOS.some((e) => e.id === id) || id === ejemploElegido()) return;
    elegirEjemplo(id);
    await reiniciar();
  },
  reiniciar,
  async seguir() {
    const X = estado.foco.X;
    try {
      const r = await acciones.autoejecutar(estado.eje, X, estado.identidad, firmarCon(estado.identidad));
      guardar();
      const hechos = r.hechos.map((h) => h.paso.hacer.plantilla).join(', ');
      estado.exito = (r.hechos.length ? 'hechos: ' + hechos : 'ningún paso dado') + (r.parado ? ' · parado en «' + (r.parado.paso.hacer?.plantilla ?? r.parado.paso.falta) + '»: ' + r.parado.motivos.map((m) => m.mensaje).join('; ') : '');
      estado.aviso = '';
      tocar(X, 'seguir');
      marcarNuevos();
    } catch (e) {
      estado.aviso = String(e.message ?? e);
    }
    pintar();
  },
  hermano(delta, pv) {
    // Cambiar de PV (la franja) o de hermano: con un PV abierto, el siguiente lateral; en el centro, el hermano del foco.
    if (pv !== null && pv !== undefined) {
      const i = LATERALES.indexOf(pv);
      const siguiente = LATERALES[(i + delta + LATERALES.length) % LATERALES.length];
      estado.niveles = { [siguiente]: Math.max(NIVEL.tarjeta, estado.niveles[pv] ?? NIVEL.tarjeta) };
      tocar(estado.foco.X, 'pv ' + siguiente);
      pintar();
      return;
    }
    const ev = estado.eje.obtener(estado.foco.X);
    if (!ev?.sobre) return;
    const hermanos = estado.eje.sobre(ev.sobre).map((h) => h.id);
    const i = hermanos.indexOf(ev.id);
    const otro = hermanos[(i + delta + hermanos.length) % hermanos.length];
    if (otro && otro !== ev.id) irA(otro, 0);
  },
  saltar(pv) {
    if (CENTROS.includes(pv)) { estado.foco.pv = pv; pintar(); return; }
    estado.niveles[pv] = Math.max(NIVEL.tarjeta, estado.niveles[pv] ?? NIVEL.comprimido);
    pintar();
    raiz.querySelector(`[data-pv="${pv}"]`)?.focus();
  },
};

async function reiniciar() {
  persistencia.borrarLocal(CLAVE_EJE);
  try { globalThis.localStorage?.removeItem(CLAVE_CLAVES); } catch { /* sin almacenamiento */ }
  for (const id of estado.eje?.identidades?.() ?? []) { try { globalThis.localStorage?.removeItem(CLAVE_LOCAL + id); } catch { /* nada */ } }
  estado.claves = await cargarClaves();
  const { eje, foco } = await crearEjemplo(estado);
  estado.eje = eje;
  estado.niveles = {};
  estado.paginas = {};
  estado.vistos = new Set();
  estado.nuevos = new Set();
  abrirLibroLocal();
  guardar();
  irA(foco);
}

// ---------- arranque ----------

async function arrancar() {
  estado.claves = await cargarClaves();
  let cargado = await persistencia.cargarLocal(CLAVE_EJE);
  if (cargado && estado.claves.casa && JSON.stringify(cargado.clave('casa')) !== JSON.stringify(estado.claves.casa.publica)) cargado = null; // claves de otra sesión
  let foco;
  estado.identidad = leerLocal(CLAVE_YO) ?? 'huesped';
  if (cargado) {
    estado.eje = cargado;
    foco = restaurarEjemplo(cargado, estado) ?? cargado.genesisId;
    estado.guardado = 'cargado del navegador · ' + cargado.orden.length + ' registros';
  } else {
    const apartado = persistencia.apartarLocal(CLAVE_EJE);
    const nuevo = await crearEjemplo(estado);
    estado.eje = nuevo.eje;
    foco = nuevo.foco;
    guardar();
    if (apartado) estado.aviso = 'El eje guardado en este navegador no se ha podido abrir (formato anterior o claves de otra sesión). Queda apartado en «' + CLAVE_EJE + '.anterior» y se empieza con el ejemplo.';
  }
  if (!estado.eje.identidades().includes(estado.identidad)) estado.identidad = estado.eje.identidades()[0];
  abrirLibroLocal();
  gestos = instalar(raiz, manejadores);
  let temporizador = null;
  window.addEventListener('resize', () => { clearTimeout(temporizador); temporizador = setTimeout(pintar, 120); });
  estado.foco = { X: foco, pv: 0 };
  tocar(foco, null);
  marcarNuevos();
  await pintar();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* sin SW: la web funciona igual con red */ });
  }
}

arrancar().catch((e) => {
  raiz.innerHTML = `<p class="aviso">La carta no ha podido arrancar: ${String(e.message ?? e).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</p>`;
  console.error(e);
});
