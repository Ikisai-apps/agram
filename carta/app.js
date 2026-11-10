// El arranque de la carta en el navegador: mi cuenta (un eje propio cuyo génesis es mi alta, con mi clave generada en
// este dispositivo: carta/cuentas.js) o el eje de ejemplo (con las claves de las identidades de prueba), el libro
// local de quien mira, el estado de la pantalla y el ciclo medir → pedir el árbol (carta/carta.js) → pintar
// (carta/dom.js) → enganchar gestos (carta/gestos.js). Lo nuevo del diario desde la última vez (estado.nuevos) es lo
// que el animado anima (efectos, actuar) y se olvida en cuanto se ha pintado.
//
// Al abrir: si hay una cuenta usada la última vez, se entra en ella; si lo último fue un ejemplo, en el ejemplo; si
// nunca se eligió nada, la pantalla de arranque ofrece crear mi cuenta, restaurar una cuenta desde su copia o probar
// con un ejemplo. Las cuentas viven en sus propias claves de localStorage (cuentas.js, CLAVES) y los ejemplos en las
// de siempre (CLAVES_EJEMPLO: la fontanería de la web antigua, antigua/ui/ejemplos.js, antigua/ui/leido.js,
// antigua/ui/comun.js; el mismo eje de ejemplo y las mismas claves sirven a las dos webs). Nada real en el
// repositorio: las identidades de ejemplo llevan claves generadas en este navegador; la de mi cuenta, también, y solo
// sale de él cifrada con una frase (la copia de seguridad).
//
// El libro compartido (etapa 3, carta/sincronia.js): una cuenta con `sync url` y `sync ledger` en su configuración y
// clave de lectura en este navegador sincroniza su eje con el servidor: al entrar (sin esperar: se pinta ya con lo
// local), tras cada escritura, al volver la red y cada 30 s con la pestaña visible; de una en una. Los ejemplos no
// sincronizan nunca. Nada de esto bloquea: se escribe en local y la cola sube lo pendiente.

import { autoridad, persistencia, local, salida, contrato, acciones, direccion, leerEvento, sincronia } from '../src/index.js';
import { arbol, enviar, preferencias, NIVEL, LATERALES, CENTROS, GEOMETRIA } from './carta.js';
import { html, htmlSincronia, trasPintar } from './dom.js';
import { instalar } from './gestos.js';
import * as opinar from './opinar.js';
import { t, idiomaDeInterfaz } from './textos.js';
import * as cuentas from './cuentas.js';
import * as sinc from './sincronia.js';
import { EJEMPLOS, crearEjemplo, restaurarEjemplo, elegirEjemplo, ejemploElegido } from '../antigua/ui/ejemplos.js';
import { alternarLeido, leidoAbierto } from '../antigua/ui/leido.js';
import { leerLocal, guardarLocal } from '../antigua/ui/comun.js';

const { CLAVES_EJEMPLO, EJEMPLO } = cuentas;
const CLAVE_EJE = CLAVES_EJEMPLO.eje;
const CLAVE_CLAVES = CLAVES_EJEMPLO.claves;
const CLAVE_FOCO = CLAVES_EJEMPLO.foco;
const CLAVE_YO = CLAVES_EJEMPLO.yo;
const IDENTIDADES_EJEMPLO = ['casa', 'cocina', 'huesped', 'recepcion'];
/** Cuántos caracteres pide, como mínimo, la frase de la copia de seguridad (una comodidad de la pantalla, no un dato de la época). */
const FRASE_MINIMA = 8;

const raiz = document.querySelector('#carta');
const estado = {
  eje: null, claves: {}, identidad: null, foco: { X: null, pv: 0 }, niveles: {}, paginas: {}, aro: null, formulario: null,
  rosetones: {}, local: null, leido: leidoAbierto(), aviso: '', exito: '', guardado: '', config: false, motivosPreferencias: [],
  vistos: new Set(), nuevos: new Set(), hermanos: null,
  // Mi cuenta: la abierta ({ nombre, idioma, identidad, alta, publica, privada }) o null en un ejemplo; la pantalla
  // de arranque ({ modo, campos, valores, motivos, ocupado }) y el diálogo de la copia ({ archivo, minimo, motivos, hecho, ocupado }).
  cuenta: null, arranque: null, copia: null,
  // El libro compartido de la cuenta abierta: su Sincronia (src/sincronia.js) o null (un ejemplo, o una cuenta sin
  // servidor, eje compartido o clave de lectura), y lo que enseña la línea de estado (sinc.lineaDeEstado) o null.
  sincronia: null, lineaSincronia: null,
};
let limpiarLottie = () => {};
let gestos = null;
let pintando = null;
let lineaPintada = null; // el HTML de la línea del libro compartido que hay en pantalla

/** La clave privada con que firma una identidad: la de mi cuenta si soy yo, si no la de ejemplo guardada en este navegador. */
const privadaDe = (id) => (estado.cuenta && id === estado.cuenta.identidad ? estado.cuenta.privada : estado.claves[id]?.privada);
const firmarCon = (id) => (privadaDe(id) ? (ev) => autoridad.firmar(ev, privadaDe(id)) : undefined);
const medidas = () => ({ ancho: Math.max(240, window.innerWidth), alto: Math.max(320, window.innerHeight) });
/** El idioma de quien mira: su preferencia «language». */
const idioma = () => contrato.configuracion(estado.eje, estado.identidad).language;
/** La clave de localStorage del libro local de quien mira: por cuenta, o la de los ejemplos. */
const claveLocalDe = (id) => (estado.cuenta ? cuentas.CLAVES.local(estado.cuenta.alta, id) : CLAVES_EJEMPLO.local(id));
/** El PV donde la carta pinta el camino (la geometría de VG: la cruz, abajo); ahí se abre el tutorial de un alta nueva. */
const PV_CAMINO = Number(Object.keys(GEOMETRIA).find((pv) => GEOMETRIA[pv].grupo === 'cruz' && GEOMETRIA[pv].fila === 'abajo'));
/** El nombre canónico de una acción del aro (por su id o su nombre): lo que anota el libro local. */
function canonicoDe(accion) {
  const p = acciones.plantillaDeTransaccion(accion);
  return p ? acciones.nombreDeAccion(p) : String(accion);
}
/** El nombre de una acción del aro (por su id o su nombre canónico) en el idioma de quien mira. */
function nombreDeAccion(accion) {
  const canonico = canonicoDe(accion);
  return contrato.texto(estado.eje, contrato.claves.plantilla(canonico), idioma(), { original: canonico });
}

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
  const ok = estado.cuenta ? cuentas.guardarEje(estado.cuenta, estado.eje) : persistencia.guardarLocal(estado.eje, CLAVE_EJE);
  estado.guardado = ok ? t('guardadoEnNavegador', { cuantos: estado.eje.orden.length }) : t('sinAlmacenamiento');
  guardarLibroLocal();
  // El estado de la sincronía va junto al eje, por cuenta (sin la clave de lectura, que va aparte).
  if (estado.sincronia && estado.cuenta) cuentas.guardarEstadoSincronia(estado.cuenta.alta, estado.sincronia.serializar());
}

/** Tras cada escritura en el eje: guardar y, si la cuenta comparte su eje, sincronizar sin esperar (lo pendiente es lo que el servidor no tiene). */
function trasEscribir() {
  guardar();
  if (estado.sincronia) void sincronizar();
}

/**
 * Sincroniza la cuenta en pantalla con el libro compartido, de una en una (sinc.enSerie: la que llega con otra en
 * marcha se repite al acabar). Si el eje cambió (reordenado o con algo añadido), guardar y pintar; si no, solo la
 * línea de estado (repintarlo todo cada 30 s borraría lo que se está escribiendo en un formulario).
 */
const sincronizar = sinc.enSerie(async () => {
  const S = estado.sincronia;
  const cuenta = estado.cuenta;
  const eje = estado.eje;
  if (!S || !cuenta || !eje) return;
  const informe = await sinc.pasar(S, eje, cuenta.alta);
  if (estado.sincronia !== S || estado.eje !== eje) return; // otra cuenta en pantalla: lo de esta ya quedó guardado
  estado.lineaSincronia = sinc.lineaDeEstado(S, informe);
  if (informe.reordenado || informe.anadidos.length) {
    guardar();
    marcarNuevos();
    await pintar();
  } else pintarSincronia();
}, { alFallar: (e) => console.error(e) });

/** Solo la línea del libro compartido, si cambió (así un desplegable abierto sigue abierto). */
function pintarSincronia() {
  const nuevo = htmlSincronia(estado.lineaSincronia);
  const el = raiz.querySelector('[data-sincronia]');
  if (nuevo === lineaPintada && (el || !nuevo)) return;
  lineaPintada = nuevo;
  if (el) el.outerHTML = nuevo;
  else raiz.querySelector('.barra .guardado')?.insertAdjacentHTML('afterend', nuevo);
}

/** Abre la sincronía de la cuenta en pantalla (con servidor, eje compartido y clave de lectura) y sincroniza sin esperar. */
function abrirSincronia() {
  estado.sincronia = estado.cuenta && estado.eje ? sinc.abrir({ alta: estado.cuenta.alta, eje: estado.eje, yo: estado.cuenta.identidad }) : null;
  estado.lineaSincronia = null;
  if (estado.sincronia) void sincronizar();
}

/** El libro local de quien mira: el guardado en este navegador (vuelve a quemar cada segundo) o uno nuevo. */
function abrirLibroLocal() {
  const id = estado.identidad;
  if (!id || !estado.eje) { estado.local = null; return; }
  try {
    const datos = JSON.parse(leerLocal(claveLocalDe(id)) ?? 'null');
    estado.local = datos ? local.LibroLocal.restaurar(estado.eje, datos) : new local.LibroLocal(estado.eje, id);
  } catch {
    estado.local = new local.LibroLocal(estado.eje, id);
  }
}

function guardarLibroLocal() {
  if (estado.local) guardarLocal(claveLocalDe(estado.identidad), JSON.stringify(estado.local.serializar()));
}

/** Cada toque gasta un segundo del libro local; si no queda, el motivo que da la época se enseña y no se corta nada. */
function tocar(X, accion) {
  if (!estado.local || !X || !estado.eje?.obtener(X)) return;
  const r = accion ? estado.local.tocar(X, accion) : estado.local.ver(X);
  if (!r.ok) estado.aviso = r.motivo;
  guardarLibroLocal();
}

/** Lo nuevo desde la última vez: los ids del diario del foco que aún no se habían visto (lo que el animado anima). */
function marcarNuevos() {
  const X = estado.foco.X;
  if (!X || !estado.eje) return;
  const d = contrato.diario(estado.eje, X, 0, 100);
  estado.nuevos = new Set(d.entradas.map((e) => e.id).filter((id) => !estado.vistos.has(id) && estado.vistos.size));
  for (const e of d.entradas) estado.vistos.add(e.id);
}

/** Lo que la carta no decide y la app sabe (dom.js html, `extra`). */
function extraDe() {
  return {
    ejemplos: EJEMPLOS.map((e) => ({ id: e.id, etiqueta: e.etiqueta })), ejemplo: ejemploElegido(), guardado: estado.guardado, aviso: estado.aviso, exito: estado.exito, nuevos: estado.nuevos,
    leidoTexto: estado.leido && estado.foco.X && estado.eje ? leerTexto(estado.foco.X) : undefined,
    preferencias: estado.config && estado.eje ? preferencias(estado.eje, estado.identidad) : null, motivosPreferencias: estado.motivosPreferencias,
    claveLectura: estado.cuenta && estado.config ? cuentas.claveLectura(estado.cuenta.alta) ?? '' : undefined, sincronia: estado.lineaSincronia,
    cuentas: cuentas.cuentas(), cuenta: estado.cuenta ? { nombre: estado.cuenta.nombre, alta: estado.cuenta.alta, identidad: estado.cuenta.identidad } : null,
    arranque: estado.arranque, copia: estado.copia, opinar: opinar.estadoDe(globalThis.localStorage),
  };
}

async function pintar() {
  if (pintando) { pintando.otra = true; return pintando.promesa; }
  const marca = { otra: false };
  pintando = marca;
  marca.promesa = (async () => {
    let a = null;
    if (estado.eje) {
      try {
        a = await arbol(estado, estado.eje, estado.identidad, medidas());
      } catch (e) {
        a = { vacio: true, avisos: [t('noSePinta', { motivo: e.message ?? e })] };
        console.error(e);
      }
    }
    const extra = extraDe();
    limpiarLottie();
    raiz.innerHTML = html(a, extra);
    lineaPintada = htmlSincronia(extra.sincronia);
    limpiarLottie = a?.animado ? trasPintar(raiz) : () => {};
    // Lo nuevo se anima una vez: en cuanto se ha pintado con lottie-web, deja de ser nuevo (si lottie aún no está, el
    // repintado al cargarlo lo anima).
    if (a?.animado && globalThis.lottie) estado.nuevos = new Set();
    globalThis.__carta = { arbol: a, vivas: () => limpiarLottie.vivas?.() ?? 0 }; // para medir (pruebas de rendimiento)
    gestos?.observar();
    if (estado.foco.X && !estado.cuenta) guardarLocal(CLAVE_FOCO, estado.foco.X);
    document.documentElement.classList.toggle('animado', Boolean(a?.animado));
    if (a?.animado) cargarLottie();
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
    return t('noSeLee', { motivo: e.message ?? e });
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
  s.onerror = () => { estado.aviso = t('sinLottie'); pintar(); };
  document.head.appendChild(s);
}

function limpiarMensajes() {
  estado.aviso = '';
  estado.exito = '';
}

/** Enfocar un registro (o un PV de un registro como foco). */
function irA(X, pv = 0) {
  if (!estado.eje?.obtener(X)) return;
  const cambia = estado.foco.X !== X;
  estado.foco = { X, pv };
  if (cambia) { estado.niveles = {}; estado.paginas = {}; estado.aro = null; estado.formulario = null; }
  limpiarMensajes();
  tocar(X, cambia ? null : 'pv ' + pv);
  marcarNuevos();
  pintar();
}

/** Un eje nuevo en pantalla (una cuenta o un ejemplo): se olvida lo visto y lo abierto. */
function cambiarDeEje(eje, identidad) {
  guardarLibroLocal();
  estado.eje = eje;
  estado.identidad = identidad;
  estado.foco = { X: null, pv: 0 };
  estado.niveles = {};
  estado.paginas = {};
  estado.aro = null;
  estado.formulario = null;
  estado.rosetones = {};
  estado.config = false;
  estado.vistos = new Set();
  estado.nuevos = new Set();
  estado.arranque = null;
  estado.copia = null;
  estado.sincronia = null; // la del eje de antes no sigue (la de una cuenta se abre en entrarCon)
  estado.lineaSincronia = null;
  limpiarMensajes();
}

/** Descarga un texto como archivo (GitHub Pages: un enlace con `download` y un blob). */
function descargar(texto, nombre) {
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- mi cuenta ----------

/** Entra en una cuenta guardada en este navegador: su eje, su clave, mi alta como foco. false (y el motivo en el aviso) si no se abre. */
async function entrarEnCuenta(alta) {
  let r = await cuentas.abrirCuenta(alta);
  if (!r.eje && r.privada) r = await ejeDesdeElLibro(r);
  if (!r.eje) {
    estado.aviso = t('cuentaNoAbre', { nombre: r.cuenta?.nombre ?? alta.slice(0, 8), motivo: r.motivo });
    estado.arranque = { modo: 'menu' };
    await pintar();
    return false;
  }
  entrarCon(r);
  estado.guardado = t('cuentaAbierta', { nombre: r.cuenta.nombre, cuantos: r.eje.orden.length });
  irA(r.cuenta.alta);
  return true;
}

/**
 * Una cuenta cuyo eje no está en este navegador: si tiene clave de lectura y se sabe dónde se comparte (el estado
 * guardado de su sincronía), el eje nace del génesis del servidor (sinc.ejeDelServidor). Si no se puede, la cuenta
 * no se abre, como hoy, con el motivo.
 */
async function ejeDesdeElLibro(r) {
  const claveLectura = cuentas.claveLectura(r.cuenta.alta);
  const datos = cuentas.estadoSincronia(r.cuenta.alta);
  if (!claveLectura || typeof datos?.url !== 'string' || typeof datos?.eje !== 'string') return r;
  const d = await sinc.ejeDelServidor({ cuenta: r.cuenta, url: datos.url, eje: datos.eje, claveLectura });
  if (!d.eje) return { ...r, motivo: r.motivo + ' · ' + t('noBajaElEje', { motivo: d.motivo }) };
  cuentas.guardarEje(r.cuenta, d.eje);
  cuentas.guardarEstadoSincronia(r.cuenta.alta, d.sincronia.serializar());
  return { ...r, eje: d.eje };
}

/** Deja como eje en pantalla el de una cuenta abierta, creada o restaurada ({ cuenta, eje, privada }), con su sincronía. */
function entrarCon({ cuenta, eje, privada }) {
  cambiarDeEje(eje, cuenta.identidad);
  estado.cuenta = { ...cuenta, privada };
  cuentas.recordarUltima(cuenta.alta);
  abrirLibroLocal();
  abrirSincronia();
}

/** Entra en el ejemplo: el eje guardado en este navegador (si sus claves son las de esta sesión) o uno nuevo. */
async function entrarEnEjemplo() {
  estado.claves = await cargarClaves();
  let cargado = await persistencia.cargarLocal(CLAVE_EJE);
  if (cargado && estado.claves.casa && JSON.stringify(cargado.clave('casa')) !== JSON.stringify(estado.claves.casa.publica)) cargado = null; // claves de otra sesión
  let foco;
  const yo = leerLocal(CLAVE_YO) ?? 'huesped';
  if (cargado) {
    cambiarDeEje(cargado, yo);
    estado.cuenta = null;
    foco = restaurarEjemplo(cargado, estado) ?? cargado.genesisId;
    estado.guardado = t('cargadoDelNavegador', { cuantos: cargado.orden.length });
  } else {
    const apartado = persistencia.apartarLocal(CLAVE_EJE);
    cambiarDeEje(null, yo);
    estado.cuenta = null;
    const nuevo = await crearEjemplo(estado);
    estado.eje = nuevo.eje;
    foco = nuevo.foco;
    guardar();
    if (apartado) estado.aviso = t('ejeApartado', { clave: CLAVE_EJE + '.anterior' });
  }
  if (!estado.eje.identidades().includes(estado.identidad)) estado.identidad = estado.eje.identidades()[0];
  cuentas.recordarUltima(EJEMPLO);
  abrirLibroLocal();
  estado.foco = { X: foco, pv: 0 };
  tocar(foco, null);
  marcarNuevos();
  await pintar();
}

/** Lo escrito en los inputs de un formulario, por nombre. */
const valoresDe = (form) => Object.fromEntries([...form.querySelectorAll('input[name],select[name]')].filter((i) => i.type !== 'file').map((i) => [i.name, i.value]));

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
    tocar(sobre, 'lanzar ' + canonicoDe(accion));
    pintar();
  },
  cerrar() {
    if (estado.copia) estado.copia = null;
    else if (estado.arranque && estado.eje) estado.arranque = null;
    else if (estado.config) { estado.config = false; estado.motivosPreferencias = []; }
    else if (estado.formulario) estado.formulario = null;
    else if (estado.aro) estado.aro = null;
    else return;
    pintar();
  },
  async enviar(form) {
    const f = estado.formulario;
    if (!f) return;
    // Lo escrito en cada input: si no se tocó el valor legible, el crudo que trae (data-crudo); un tipo simple se lee
    // con el núcleo (contrato.desdeLegible, en el idioma de quien mira); lo demás, BTML en JSON o el texto tal cual.
    const valores = {};
    const motivos = [];
    for (const input of form.querySelectorAll('input[name]')) {
      const v = input.value.trim();
      if (v === '') continue;
      const { tipo, crudo, legible, simple, etiqueta } = input.dataset;
      if (crudo && v === legible) {
        try { valores[input.name] = JSON.parse(crudo); continue; } catch { /* se lee como lo escrito */ }
      }
      if (simple === '1') {
        const r = contrato.desdeLegible(v, tipo, { eje: estado.eje, idioma: idioma() });
        if (r.motivo) motivos.push({ regla: input.name, mensaje: (etiqueta || input.name) + ': ' + r.motivo, parametro: input.name });
        else if (r.valor !== undefined) valores[input.name] = r.valor;
      } else if (/^[[{]/.test(v)) { try { valores[input.name] = JSON.parse(v); } catch { valores[input.name] = v; } } else valores[input.name] = v;
    }
    f.valores = valores;
    if (motivos.length) { f.motivos = motivos; f.resultado = null; pintar(); return; }
    const r = await enviar(estado.eje, f.X, f.accion, valores, estado.identidad, firmarCon(estado.identidad));
    if (r.ok && r.asentado) {
      trasEscribir();
      estado.formulario = null;
      estado.exito = t('registrado', { accion: nombreDeAccion(f.accion), id: r.asentado.id.slice(0, 8) }) + (r.asentado.firma ? ' ' + t('firmado') : '');
      tocar(f.X, 'hecho ' + canonicoDe(f.accion));
      marcarNuevos();
    } else if (r.ok && r.lectura) {
      f.resultado = r.lectura.mensaje;
      f.motivos = [];
    } else if (r.ok && !r.evento) {
      f.resultado = r.pasos ? t('pasosMios', { cuantos: r.pasos.length }) : r.paso ? t('elPaso', { que: r.paso.hacer ? nombreDeAccion(r.paso.hacer.plantilla) : r.paso.falta }) : t('nadaQueHacer');
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
    // La clave de lectura, aparte: al almacén local de la cuenta, nunca al registro de preferencias (que va en el eje).
    const campoClave = form.querySelector('[data-clave-lectura]');
    if (campoClave && estado.cuenta) cuentas.guardarClaveLectura(estado.cuenta.alta, campoClave.value);
    const p = preferencias(estado.eje, estado.identidad, valores);
    if (!p) { estado.motivosPreferencias = [{ mensaje: t('sinAlta') }]; pintar(); return; }
    try {
      await salida.escribirDesde(estado.eje, { modo: 'sequenced', autor: estado.identidad, sobre: p.sobre, en: p.en, payload: p.payload }, privadaDe(estado.identidad));
      guardar();
      estado.config = false;
      estado.motivosPreferencias = [];
      estado.exito = t('configuracionGuardada');
    } catch (e) {
      estado.motivosPreferencias = [{ mensaje: String(e.message ?? e).replace(/^evento (rechazado|mal formado): /, '') }];
    }
    // El servidor, el eje compartido o la clave pueden haber cambiado: la sincronía se vuelve a abrir (y sube la configuración).
    abrirSincronia();
    pintar();
  },
  async campo(X, pv, texto) {
    try {
      const ev = await salida.escribirDesde(estado.eje, { modo: 'pointed', autor: estado.identidad, sobre: X, en: direccion([pv]), payload: salida.desdePointed(estado.eje, texto) }, privadaDe(estado.identidad));
      trasEscribir();
      estado.exito = t('escrito', { id: ev.id.slice(0, 8), pv, X: X.slice(0, 8) }) + (ev.firma ? ' ' + t('firmado') : '');
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
      const ev = await estado.local.englobar(firmarCon(estado.identidad), { nota: t('unRatoEnLaCarta') });
      trasEscribir();
      estado.exito = ev ? t('esteRatoEnElEje', { id: ev.id.slice(0, 8) }) : t('nadaQueEnglobar');
      estado.aviso = '';
      marcarNuevos();
    } catch (e) {
      estado.aviso = String(e.message ?? e).replace(/^evento (rechazado|mal formado): /, '');
    }
    pintar();
  },
  /** El selector «soy»: una de mis cuentas (cuenta:<alta>), crear o restaurar una, probar con un ejemplo, o una identidad del eje de ejemplo. */
  async quien(valor) {
    if (valor.startsWith('cuenta:')) { await entrarEnCuenta(valor.slice('cuenta:'.length)); return; }
    if (valor === 'nueva') return manejadores.arranque('crear');
    if (valor === 'restaurar') return manejadores.arranque('restaurar');
    if (valor === EJEMPLO) return manejadores.arranque(EJEMPLO);
    const id = valor;
    if (!estado.eje?.identidades().includes(id)) return;
    guardarLibroLocal();
    estado.identidad = id;
    if (!estado.cuenta) guardarLocal(CLAVE_YO, id);
    abrirLibroLocal();
    estado.aro = null;
    estado.formulario = null;
    estado.rosetones = {};
    limpiarMensajes();
    pintar();
  },
  async ejemplo(id) {
    if (estado.cuenta || !EJEMPLOS.some((e) => e.id === id) || id === ejemploElegido()) return;
    elegirEjemplo(id);
    await reiniciar();
  },
  reiniciar,
  async seguir() {
    const X = estado.foco.X;
    try {
      const r = await acciones.autoejecutar(estado.eje, X, estado.identidad, firmarCon(estado.identidad));
      trasEscribir();
      const hechos = r.hechos.map((h) => nombreDeAccion(h.paso.hacer.plantilla)).join(', ');
      estado.exito = (r.hechos.length ? t('hechos', { cuales: hechos }) : t('ningunPasoDado')) + (r.parado ? ' ' + t('paradoEn', { que: r.parado.paso.hacer ? nombreDeAccion(r.parado.paso.hacer.plantilla) : r.parado.paso.falta, motivos: r.parado.motivos.map((m) => m.mensaje).join('; ') }) : '');
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

  // ---------- mi cuenta ----------

  /** La pantalla de arranque: el menú, crear, restaurar, probar con un ejemplo o entrar en una cuenta guardada. */
  async arranque(que) {
    limpiarMensajes();
    if (que === 'crear') {
      estado.arranque = { modo: 'crear', campos: cuentas.camposDelAlta({ idioma: idiomaDeInterfaz() }), valores: {}, motivos: [] };
    } else if (que === 'restaurar') {
      estado.arranque = { modo: 'restaurar', motivos: [] };
    } else if (que === EJEMPLO) {
      estado.arranque = null;
      await entrarEnEjemplo();
      return;
    } else if (typeof que === 'string' && que.startsWith('cuenta:')) {
      await entrarEnCuenta(que.slice('cuenta:'.length));
      return;
    } else {
      estado.arranque = { modo: 'menu' };
    }
    estado.copia = null;
    estado.config = false;
    estado.formulario = null;
    estado.aro = null;
    await pintar();
  },
  /** Crear mi cuenta con el nombre y el idioma del formulario: la clave se genera aquí, el génesis es mi alta, y se entra. */
  async crear(form) {
    const ar = estado.arranque;
    if (!ar || ar.modo !== 'crear' || ar.ocupado) return;
    ar.valores = valoresDe(form);
    ar.motivos = [];
    ar.ocupado = true;
    await pintar();
    try {
      const r = await cuentas.crearCuenta({ nombre: ar.valores.nombre, idioma: ar.valores.idioma });
      const guardada = await cuentas.guardarCuenta(r);
      entrarCon(r);
      estado.guardado = guardada ? t('guardadoEnNavegador', { cuantos: r.eje.orden.length }) : t('sinAlmacenamiento');
      estado.exito = t('cuentaCreada');
      estado.niveles[PV_CAMINO] = NIVEL.tarjeta; // el tutorial del alta nueva, a la vista
      estado.foco = { X: r.cuenta.alta, pv: 0 };
      tocar(r.cuenta.alta, null);
      marcarNuevos();
      await pintar();
    } catch (e) {
      ar.ocupado = false;
      ar.motivos = [{ mensaje: String(e?.message ?? e) }];
      await pintar();
    }
  },
  /** Restaurar una cuenta desde su archivo de copia y la frase: se descifra, se revalida el eje, se guarda aquí y se entra. */
  async restaurar(form) {
    const ar = estado.arranque;
    if (!ar || ar.modo !== 'restaurar' || ar.ocupado) return;
    const archivo = form.querySelector('input[name="archivo"]')?.files?.[0];
    const { frase } = valoresDe(form);
    if (!archivo) { ar.motivos = [{ mensaje: t('sinArchivo') }]; await pintar(); return; }
    ar.motivos = [];
    ar.ocupado = true;
    await pintar();
    let texto;
    try {
      texto = await archivo.text();
    } catch (e) {
      ar.ocupado = false;
      ar.motivos = [{ mensaje: t('archivoNoLeido', { motivo: e?.message ?? e }) }];
      await pintar();
      return;
    }
    try {
      const r = await cuentas.restaurarCuenta(texto, frase);
      // Con el libro compartido (la copia lleva la clave de lectura y su eje, el servidor y el eje compartido), el eje
      // nace del génesis del servidor (sincronizar(null)) y lo de la foto que falte va detrás; si no se puede, se sigue
      // con la foto, como hoy, y se dice.
      const destino = r.claveLectura ? sincronia.destino(r.eje, r.cuenta.identidad) : null;
      let delLibro = null;
      let aviso = '';
      if (destino) {
        const d = await sinc.ejeDelServidor({ cuenta: r.cuenta, url: destino.url, eje: destino.eje, claveLectura: r.claveLectura, foto: r.eje });
        if (d.eje) { r.eje = d.eje; delLibro = d.sincronia; } else aviso = t('noBajaDelServidor', { motivo: d.motivo });
      }
      const existia = cuentas.cuentas().some((c) => c.alta === r.cuenta.alta);
      const guardada = await cuentas.guardarCuenta(r);
      if (delLibro) cuentas.guardarEstadoSincronia(r.cuenta.alta, delLibro.serializar());
      entrarCon(r);
      estado.guardado = guardada ? t('guardadoEnNavegador', { cuantos: r.eje.orden.length }) : t('sinAlmacenamiento');
      estado.exito = t('cuentaRestaurada', { nombre: r.cuenta.nombre, cuantos: r.eje.orden.length }) + (delLibro ? ' · ' + t('ejeDelServidor', { cuantos: r.eje.orden.length }) : '') + (existia ? ' · ' + t('cuentaSustituida') : '');
      estado.aviso = aviso;
      estado.foco = { X: r.cuenta.alta, pv: 0 };
      tocar(r.cuenta.alta, null);
      marcarNuevos();
      await pintar();
    } catch (e) {
      ar.ocupado = false;
      ar.motivos = [{ mensaje: String(e?.message ?? e) }];
      await pintar();
    }
  },
  /** La copia de seguridad: abrir el diálogo (null) o, con el formulario, cifrar con la frase y descargar el archivo. */
  async copia(form) {
    if (!estado.cuenta) return;
    if (!form) {
      estado.copia = { archivo: cuentas.nombreDeArchivo(estado.cuenta), minimo: FRASE_MINIMA, motivos: [], hecho: '' };
      estado.config = false;
      estado.formulario = null;
      estado.aro = null;
      limpiarMensajes();
      await pintar();
      return;
    }
    const c = estado.copia;
    if (!c || c.ocupado) return;
    const { frase, frase2 } = valoresDe(form);
    if (!frase || frase.length < FRASE_MINIMA) { c.motivos = [{ mensaje: t('fraseCorta') }]; await pintar(); return; }
    if (frase !== frase2) { c.motivos = [{ mensaje: t('frasesNoCoinciden') }]; await pintar(); return; }
    c.motivos = [];
    c.ocupado = true;
    await pintar();
    try {
      const archivo = await cuentas.exportarCuenta({ cuenta: estado.cuenta, eje: estado.eje, privada: estado.cuenta.privada, claveLectura: cuentas.claveLectura(estado.cuenta.alta) }, frase);
      descargar(cuentas.textoDeArchivo(archivo), c.archivo);
      estado.copia = null;
      estado.exito = t('copiaDescargada', { archivo: c.archivo });
    } catch (e) {
      c.ocupado = false;
      c.motivos = [{ mensaje: String(e?.message ?? e) }];
    }
    await pintar();
  },
  /** Olvidar esta cuenta en este navegador (su eje, su clave y sus libros locales); sin copia no se recupera. */
  async olvidar() {
    const c = estado.cuenta;
    if (!c) return;
    if (!globalThis.confirm(t('olvidarConfirmar', { nombre: c.nombre }))) return;
    const ids = estado.eje?.identidades?.() ?? [c.identidad];
    estado.local = null; // su libro local no se vuelve a guardar
    cambiarDeEje(null, null);
    cuentas.olvidarCuenta(c.alta, ids);
    estado.cuenta = null;
    estado.arranque = { modo: 'menu' };
    estado.aviso = t('cuentaOlvidada', { nombre: c.nombre });
    await pintar();
  },
};

/** Reiniciar el ejemplo: borra lo guardado del ejemplo en este navegador y empieza el elegido (no toca las cuentas). */
async function reiniciar() {
  if (estado.cuenta) return;
  persistencia.borrarLocal(CLAVE_EJE);
  try { globalThis.localStorage?.removeItem(CLAVE_CLAVES); } catch { /* sin almacenamiento */ }
  for (const id of estado.eje?.identidades?.() ?? []) { try { globalThis.localStorage?.removeItem(CLAVES_EJEMPLO.local(id)); } catch { /* nada */ } }
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
  gestos = instalar(raiz, manejadores);
  opinar.instalar({ raiz, cuenta: () => estado.cuenta?.nombre ?? 'ejemplo', alCambiar: () => { void pintar(); } });
  let temporizador = null;
  window.addEventListener('resize', () => { clearTimeout(temporizador); temporizador = setTimeout(pintar, 120); });
  // El libro compartido: al volver la red y cada 30 s con la pestaña visible (la cola decide si toca reintentar).
  window.addEventListener('online', () => { if (estado.sincronia) void sincronizar(); });
  setInterval(() => { if (estado.sincronia && document.visibilityState === 'visible') void sincronizar(); }, sinc.CADA);
  // Dónde entrar: la última cuenta usada; si lo último fue un ejemplo, el ejemplo; si hay cuentas y no se sabe cuál, la
  // última de la lista; si no hay nada elegido, la pantalla de arranque.
  const lista = cuentas.cuentas();
  const u = cuentas.ultima();
  if (u === EJEMPLO) await entrarEnEjemplo();
  else if (u && lista.some((c) => c.alta === u)) await entrarEnCuenta(u);
  else if (lista.length) await entrarEnCuenta(lista[lista.length - 1].alta);
  else { estado.arranque = { modo: 'menu' }; await pintar(); }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* sin SW: la web funciona igual con red */ });
  }
}

arrancar().catch((e) => {
  raiz.innerHTML = `<p class="aviso">${t('noArranca', { motivo: e.message ?? e }).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</p>`;
  console.error(e);
});
