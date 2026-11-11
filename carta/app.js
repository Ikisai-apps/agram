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
import { arbol, enviar, medidasDePantalla, preferencias, ampliar, ampliarTodos, NIVEL, LATERALES, CENTROS, GEOMETRIA } from './carta.js';
import { html, htmlSincronia, htmlGuia, trasPintar, variablesDeColor } from './dom.js';
import { instalar } from './gestos.js';
import * as opinar from './opinar.js';
import { t, idiomaDeInterfaz } from './textos.js';
import * as cuentas from './cuentas.js';
import * as sinc from './sincronia.js';
import * as guia from './guia.js';
import * as externa from './externa.js';
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
  eje: null, claves: {}, identidad: null, foco: { X: null, pv: 0 }, niveles: {}, recientes: [], paginas: {}, profundidad: {}, aro: null, formulario: null,
  rosetones: {}, local: null, leido: leidoAbierto(), aviso: '', exito: '', guardado: '', config: false, motivosPreferencias: [],
  vistos: new Set(), nuevos: new Set(), hermanos: null,
  // Sequenced (el móvil en vertical): si el menú de la barra de una línea está abierto.
  menu: false,
  // Mi cuenta: la abierta ({ nombre, idioma, identidad, alta, publica, privada }) o null en un ejemplo; la pantalla
  // de arranque ({ modo, campos, valores, motivos, ocupado }) y el diálogo de la copia ({ archivo, minimo, motivos, hecho, ocupado }).
  cuenta: null, arranque: null, copia: null,
  // El libro compartido de la cuenta abierta: su Sincronia (src/sincronia.js) o null (un ejemplo, o una cuenta sin
  // servidor, eje compartido o clave de lectura), y lo que enseña la línea de estado (sinc.lineaDeEstado) o null.
  sincronia: null, lineaSincronia: null,
  // La guía del PV9: la conversación de la alta en pantalla, lo escrito sin enviar y lo que está pasando.
  guia: { alta: null, historial: [], borrador: '', pensando: false, pendiente: '', error: '' },
};
let limpiarLottie = () => {};
let gestos = null;
let pintando = null;
let lineaPintada = null; // el HTML de la línea del libro compartido que hay en pantalla
let ultimo = null; // el último árbol pintado: si es Mapped (no apilada), los pasos de tamaño son los de la época

/** La clave privada con que firma una identidad: la de mi cuenta si soy yo, si no la de ejemplo guardada en este navegador. */
const privadaDe = (id) => (estado.cuenta && id === estado.cuenta.identidad ? estado.cuenta.privada : estado.claves[id]?.privada);
const firmarCon = (id) => (privadaDe(id) ? (ev) => autoridad.firmar(ev, privadaDe(id)) : undefined);
/**
 * La pantalla que mide la carta: la ventana, sin lo que ocupa la barra (en Mapped la escena es el resto, sin scroll).
 * Las medidas por tamaño de pantalla (el móvil apaisado, más bajo) las calcula carta.js medidasDePantalla.
 */
const medidas = () => {
  const barra = raiz?.querySelector?.('.barra')?.offsetHeight ?? 0;
  return medidasDePantalla(window.innerWidth, window.innerHeight - barra);
};
/** ¿Está la carta en Mapped (la matriz del ordenador)? Lo dice el último árbol (la época decide por la forma de la pantalla). */
const enMapped = () => Boolean(ultimo && !ultimo.vacio && !ultimo.apilada);
/** ¿Está la carta en Sequenced con su columna (la tarjeta con sus filas y el hilo)? */
const enSecuencia = () => Boolean(ultimo && !ultimo.vacio && ultimo.apilada && ultimo.secuencia);
/** Sequenced: a qué fila o zona del hilo llevar la pantalla tras el próximo pintado (un dígito tocado), o null. */
let irTrasPintar = null;
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
    guiaAjustes: estado.config && estado.eje ? guiaAjustesDe() : undefined,
    arranque: estado.arranque, copia: estado.copia, opinar: opinar.estadoDe(globalThis.localStorage), menu: estado.menu,
  };
}

// ---------- la guía del PV9 ----------

const almacenLocal = () => { try { return globalThis.localStorage; } catch { return undefined; } };
/** El alta de quien mira: por ella van la conversación (agram.guia.<alta>) y la clave de la API (agram.ia.<alta>). */
const altaDeGuia = () => (estado.eje && estado.identidad ? estado.eje.alta(estado.identidad)?.id ?? null : null);

/** Descarga un archivo { nombre, tipo, contenido } (el mismo gesto que el de exportar opiniones; con su tipo, no solo JSON). */
function descargarArchivo({ nombre, tipo, contenido }) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Dónde se guardan las propuestas importadas: por cuenta (su alta) o «ejemplo» (agram.propuestas.<alta|ejemplo>). */
const dondePropuestas = () => (estado.cuenta ? estado.cuenta.alta : 'ejemplo');
const propuestasPendientes = () => (estado.eje && estado.identidad ? externa.leerPropuestas(almacenLocal(), dondePropuestas()) : []);

/** Lo que pinta htmlGuia: la conversación de quien mira (cargada al cambiar de alta), lo que está pasando y las preguntas hechas de la época. */
function datosGuia() {
  const alta = altaDeGuia();
  if (!alta) return null;
  const g = estado.guia;
  const aj = guia.ajustes(estado.eje, estado.identidad);
  if (g.alta !== alta) Object.assign(g, { alta, historial: guia.cargarHistorial(almacenLocal(), alta, aj.historial), borrador: '', pensando: false, pendiente: '', error: '' });
  // Las propuestas importadas: las que tratan de este registro están en el camino; aquí, el resto y las que no se entienden.
  const evaluadas = externa.evaluarTodas(estado.eje, estado.identidad, propuestasPendientes());
  const propuestas = {
    aqui: evaluadas.filter((e) => e.sobre === estado.foco.X).length,
    fuera: evaluadas.filter((e) => e.sobre !== estado.foco.X).map((e) => (e.sobre ? { ...e, sobreTexto: contrato.legible(estado.eje, { ref: e.sobre }, null, { idioma: idioma() }).texto } : e)),
  };
  return { historial: g.historial, pensando: g.pensando, pendiente: g.pendiente, error: g.error, borrador: g.borrador, preguntas: guia.preguntasRapidas(estado.eje, idioma()), via: aj.via, propuestas };
}

/** Repinta solo la sección de la guía (repintarlo todo borraría lo que se está escribiendo y el desplazamiento). */
function pintarGuia() {
  const el = raiz.querySelector('[data-guia]');
  if (!el) return;
  const campo = el.querySelector('[data-guia-pregunta]');
  if (campo && !estado.guia.pensando && document.activeElement === campo) estado.guia.borrador = campo.value;
  const nuevo = htmlGuia(datosGuia());
  for (const g of raiz.querySelectorAll('[data-guia]')) g.outerHTML = nuevo;
  raiz.querySelector('.guia-historial')?.lastElementChild?.scrollIntoView?.({ block: 'nearest' });
}

/** Los ajustes de la guía para el formulario de configuración: los campos de la época y la clave de la API de este navegador. */
function guiaAjustesDe() {
  const a = guia.ajustesEditables(estado.eje, estado.identidad);
  return a ? { ...a, claveIa: guia.claveIa(almacenLocal(), altaDeGuia()) ?? '' } : undefined;
}

/**
 * Ancla el aro abierto al elemento pulsado (VG: «el aro se abre sobre el elemento»). Solo en Mapped y si hay ancla (la caja del elemento
 * al abrirlo, de gestos.js): un position:fixed calculado aquí con las medidas del propio CSS (--sitio-ancho, --sitio-alto, --hueco), con el
 * centro del tamaño del elemento (no menos que el mínimo del CSS), y recortado para que no se salga de la ventana. En el móvil apilado
 * no hay sitio: sigue centrado (CSS). Nada de esto está en el árbol ni en los datos.
 */
function situarAro() {
  const fondo = raiz.querySelector('.aro-fondo');
  const aro = fondo?.querySelector('.aro');
  const ancla = estado.aro?.ancla;
  if (!aro || !ancla || !enMapped()) return;
  // Primero la clase: sin ella el CSS del aro centrado (min(112px, 29vw)) no es un número y las medidas saldrían a 0.
  fondo.classList.add('anclado');
  aro.classList.add('anclado');
  const estilo = getComputedStyle(aro);
  const px = (v) => parseFloat(estilo.getPropertyValue(v)) || 0;
  const sitioAncho = px('--sitio-ancho');
  const sitioAlto = px('--sitio-alto');
  const hueco = px('--hueco');
  const vw = document.documentElement.clientWidth || globalThis.innerWidth || 0;
  const vh = globalThis.innerHeight || 0;
  const MARGEN = 8;
  // el centro es el elemento, recortado a lo que deja libre la ventana tras los sitios de los lados (y no menos que el mínimo del CSS)
  const caja = (desde, largo, total, sitio, minimo) => {
    const ini = Math.max(desde, MARGEN + sitio + hueco);
    const fin = Math.min(desde + largo, total - MARGEN - sitio - hueco);
    const tam = Math.max(fin - ini, minimo);
    return [Math.round(fin - ini >= minimo ? ini : (ini + fin) / 2 - tam / 2), Math.round(tam)];
  };
  const [centroX, centroAncho] = caja(ancla.x, ancla.ancho, vw, sitioAncho, px('--centro-ancho'));
  const [centroY, centroAlto] = caja(ancla.y, ancla.alto, vh, sitioAlto, px('--centro-alto'));
  const ancho = centroAncho + 2 * sitioAncho + 2 * hueco;
  const alto = centroAlto + 2 * sitioAlto + 2 * hueco;
  const dentro = (v, tam, total) => Math.round(Math.min(Math.max(v, MARGEN), Math.max(MARGEN, total - tam - MARGEN)));
  aro.style.setProperty('--centro-ancho', centroAncho + 'px');
  aro.style.setProperty('--centro-alto', centroAlto + 'px');
  aro.style.left = dentro(centroX - sitioAncho - hueco, ancho, vw) + 'px';
  aro.style.top = dentro(centroY - sitioAlto - hueco, alto, vh) + 'px';
}

async function pintar() {
  if (pintando) { pintando.otra = true; return pintando.promesa; }
  const marca = { otra: false };
  pintando = marca;
  marca.promesa = (async () => {
    let a = null;
    if (estado.eje) {
      try {
        a = await arbol(estado, estado.eje, estado.identidad, medidas(), { sugerencias: externa.sugerenciasDe(propuestasPendientes()), firmar: firmarCon(estado.identidad) });
      } catch (e) {
        a = { vacio: true, avisos: [t('noSePinta', { motivo: e.message ?? e })] };
        console.error(e);
      }
    }
    if (a && !a.vacio) a.guia = datosGuia();
    const extra = extraDe();
    limpiarLottie();
    for (const [k, v] of Object.entries(variablesDeColor(a?.colores))) document.documentElement.style.setProperty(k, v);
    // Sequenced: la tarjeta del foco se queda donde estaba al repintar (lo que crece encima, el pasado, no la mueve).
    const antes = enSecuencia() ? raiz.querySelector('.secuencia-ahora > .nucleo')?.getBoundingClientRect().top ?? null : null;
    const mismoFoco = ultimo?.X === a?.X;
    ultimo = a;
    document.documentElement.classList.toggle('mapped', enMapped());
    raiz.innerHTML = html(a, extra);
    situarAro();
    if (enSecuencia()) colocarSecuencia(antes, mismoFoco);
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

/**
 * Sequenced: el hilo es el scroll. Al llegar a un foco, la tarjeta arriba (bajo la barra) y el pasado encima, fuera de la
 * pantalla; al repintar el mismo foco, la tarjeta donde estaba; tras tocar un dígito, su fila (o su zona del hilo) a la vista.
 */
function colocarSecuencia(antes, mismoFoco) {
  const nucleo = raiz.querySelector('.secuencia-ahora > .nucleo');
  if (!nucleo) return;
  const barra = raiz.querySelector('.barra')?.offsetHeight ?? 0;
  const ahora = nucleo.getBoundingClientRect().top;
  if (antes !== null && mismoFoco) window.scrollBy({ top: ahora - antes, behavior: 'instant' });
  else window.scrollTo({ top: Math.max(0, window.scrollY + ahora - barra), behavior: 'instant' });
  const ir = irTrasPintar;
  irTrasPintar = null;
  if (ir === null) return;
  const zona = raiz.querySelector(`[data-hilo-zona="${ir}"]`);
  const fila = raiz.querySelector(`[data-fila-pv="${ir}"]`);
  if (zona) zona.scrollIntoView({ block: zona.classList.contains('zona-antes') ? 'end' : 'start', behavior: 'smooth' });
  else if (fila) {
    const y = window.scrollY + fila.getBoundingClientRect().top - barra - 4;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    fila.querySelector('[data-fila]')?.focus({ preventScroll: true });
  }
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
  if (cambia) { estado.niveles = {}; estado.recientes = []; estado.paginas = {}; estado.profundidad = {}; estado.aro = null; estado.formulario = null; }
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
  estado.recientes = [];
  estado.paginas = {};
  estado.profundidad = {};
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

/**
 * Escribe mis preferencias con estos valores sobre las de ahora, como un registro más en el 9 de mi alta (la plantilla
 * «preferences»): lo que hace la configuración al guardar y lo que hace un interruptor de la barra al tocarlo.
 */
async function escribirPreferencias(valores) {
  const p = preferencias(estado.eje, estado.identidad, valores);
  if (!p) throw new Error(t('sinAlta'));
  await salida.escribirDesde(estado.eje, { modo: 'sequenced', autor: estado.identidad, sobre: p.sobre, en: p.en, payload: p.payload }, privadaDe(estado.identidad));
}

const manejadores = {
  nivel(pv, delta, X) {
    if (enMapped()) {
      // Mapped: los pasos de la época (carta.ampliar): sube o baja ese PV; pasado el tope, a pantalla completa; si compite
      // con otro tocado antes en su fila o columna, gana el más reciente y el otro baja un paso.
      const r = ampliar(estado, pv, delta, { pvs: ultimo?.pvs });
      estado.niveles = r.niveles;
      estado.recientes = r.recientes;
      limpiarMensajes();
      tocar(X ?? estado.foco.X, 'tamaño ' + pv + ' ' + (r.completa ? 'completa' : estado.niveles[pv]));
      if (r.completa) { irA(X ?? estado.foco.X, pv); return; }
      pintar();
      return;
    }
    if (enSecuencia()) {
      // Sequenced: una fila cerrada se abre (bloque) y una abierta, con otro paso, entra en el PV; hacia abajo, se cierra.
      const abierta = (estado.niveles[pv] ?? NIVEL.comprimido) >= NIVEL.tarjeta;
      if (delta > 0 && abierta) { irA(X ?? estado.foco.X, pv); return; }
      estado.niveles[pv] = delta > 0 ? NIVEL.bloque : NIVEL.comprimido;
      limpiarMensajes();
      tocar(X ?? estado.foco.X, 'fila ' + pv + ' ' + estado.niveles[pv]);
      pintar();
      return;
    }
    const actual = estado.niveles[pv] ?? NIVEL.comprimido;
    const siguiente = actual + delta;
    if (siguiente > NIVEL.bloque) { irA(X ?? estado.foco.X, pv); return; } // el siguiente gesto no es un tamaño: entrar en el PV
    estado.niveles[pv] = Math.max(NIVEL.comprimido, siguiente);
    limpiarMensajes();
    tocar(X ?? estado.foco.X, 'nivel ' + pv + ' ' + estado.niveles[pv]);
    pintar();
  },
  /** Sequenced: abrir o cerrar la fila de un PV (cerrada = comprimido, abierta = bloque); las del hilo llevan a su zona. */
  fila(pv) {
    if (ultimo?.secuencia?.filas?.find((f) => f.pv === pv)?.hilo) { manejadores.digito(pv); return; }
    const abierta = (estado.niveles[pv] ?? NIVEL.comprimido) >= NIVEL.tarjeta;
    estado.niveles[pv] = abierta ? NIVEL.comprimido : NIVEL.bloque;
    if (abierta) { estado.profundidad[pv] = []; estado.paginas[pv] = 1; }
    limpiarMensajes();
    tocar(estado.foco.X, 'fila ' + pv + ' ' + estado.niveles[pv]);
    pintar();
  },
  /** Sequenced: la fila de dígitos. Lleva a la fila de ese PV y la abre; los del hilo, al pasado o al futuro. */
  digito(pv) {
    const f = ultimo?.secuencia?.filas?.find((x) => x.pv === pv);
    if (!f) return;
    if (!f.hilo) estado.niveles[pv] = NIVEL.bloque;
    if (estado.foco.pv !== CENTROS[0]) estado.foco.pv = CENTROS[0]; // las filas están en el anverso
    irTrasPintar = pv;
    tocar(estado.foco.X, 'dígito ' + pv);
    pintar();
  },
  /** Sequenced: abrir o cerrar el menú de la barra de una línea. */
  menu() {
    estado.menu = !estado.menu;
    pintar();
  },
  /** Mapped: los puntitos del foco suben un paso todos los PV (hasta el 3×3); su mando, los baja. */
  todos(delta) {
    const r = ampliarTodos(estado, delta, { pvs: ultimo?.pvs });
    estado.niveles = r.niveles;
    estado.recientes = r.recientes;
    limpiarMensajes();
    tocar(estado.foco.X, 'todos ' + delta);
    pintar();
  },
  /** Un interruptor de la barra: escribe esa preferencia (sobrio o animado) como lo hace la configuración, y repinta. */
  async preferencia(clave, valor) {
    if (!clave || !estado.eje) return;
    try {
      await escribirPreferencias({ [clave]: valor });
      guardar();
      estado.aviso = '';
    } catch (e) {
      estado.aviso = String(e.message ?? e).replace(/^evento (rechazado|mal formado): /, '');
    }
    abrirSincronia();
    pintar();
  },
  /** Mapped, sin scroll: la página siguiente o la anterior de los ocupantes de un PV. */
  pagina(pv, delta) {
    estado.paginas[pv] = Math.max(1, (estado.paginas[pv] ?? 1) + delta);
    tocar(estado.foco.X, 'página ' + pv + ' ' + estado.paginas[pv]);
    pintar();
  },
  /** Mapped, pantalla completa: entrar en una celda de la rejilla de un PV baja un nivel de profundidad. */
  celda(pv, X) {
    estado.profundidad[pv] = [...(estado.profundidad[pv] ?? []), X];
    estado.paginas[pv] = 1;
    tocar(estado.foco.X, 'celda ' + pv + ' ' + estado.profundidad[pv].length);
    pintar();
  },
  /** Mapped, pantalla completa: volver un nivel de profundidad. */
  subir(pv) {
    estado.profundidad[pv] = (estado.profundidad[pv] ?? []).slice(0, -1);
    estado.paginas[pv] = 1;
    tocar(estado.foco.X, 'subir ' + pv);
    pintar();
  },
  profundidad(delta, pv, X) {
    if (pv !== null && pv !== undefined) return manejadores.nivel(pv, delta, X);
    if (enMapped()) return manejadores.todos(delta);
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
  aro(X, pv, { desplegar, ancla } = {}) {
    if (!X) return;
    // `ancla`: la caja del elemento pulsado en la ventana (de gestos.js, al abrir); al desplegar un sitio se conserva la de antes. Es estado de pantalla, no del árbol.
    // Desplegar un sitio en un aro abierto sobre otro registro (o cerrado) lo abre ya desplegado; en el mismo, lo pliega si ya lo estaba.
    const mismo = estado.aro?.X === X;
    estado.aro = { X, pv: desplegar ? (mismo && estado.aro?.pv === pv ? null : pv) : null, ancla: ancla ?? (desplegar && mismo ? estado.aro.ancla : null), editar: false };
    estado.formulario = null;
    limpiarMensajes();
    tocar(X, 'aro' + (pv !== null && pv !== undefined ? ' ' + pv : ''));
    pintar();
  },
  /** Mantener el centro del aro: editarlo (el input con su valor, la lista del 0 debajo y la del 5 encima); el foco, en el input. */
  async editarAro() {
    if (!estado.aro) return;
    estado.aro = { ...estado.aro, pv: null, editar: true };
    tocar(estado.aro.X, 'aro editar');
    await pintar();
    // Las dos listas, recortadas a la ventana (la del 5 crece hacia arriba y la del 0 hacia abajo: con scroll si no caben).
    const MARGEN = 8;
    for (const lista of raiz.querySelectorAll('.aro-edicion .opciones')) {
      const r = lista.getBoundingClientRect();
      const sobra = Math.max(MARGEN - r.top, r.bottom - (globalThis.innerHeight - MARGEN), 0);
      if (sobra > 0) lista.style.maxHeight = Math.max(60, r.height - sobra) + 'px';
    }
    const input = raiz.querySelector('.aro [data-campo]');
    if (input) { input.focus(); input.select?.(); }
  },
  /** Un clic en el centro del aro: cerrarlo y entrar en el elemento (su anverso). */
  aroEntrar(X) {
    if (!X) return;
    estado.aro = null;
    irA(X, CENTROS[0]);
  },
  /** Un valor de una lista del aro (contrato.opciones): se escribe en la posición pv de X como cualquier campo, y el aro se cierra. */
  opcion(X, pv, valor) {
    if (!X || valor === undefined || valor === '') return;
    estado.aro = null;
    return manejadores.campo(X, pv, valor);
  },
  /** Las teclas 1-4 y 6-9 con el aro abierto: lanzar la acción por defecto de ese sitio (si no tiene, nada). */
  aroTecla(pv) {
    const hueco = ultimo?.aro?.huecos?.find((h) => h.pv === pv);
    if (estado.aro && hueco?.accion) manejadores.lanzar(estado.aro.X, hueco.accion.id);
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
    else if (enMapped() && estado.profundidad[estado.foco.pv]?.length) estado.profundidad[estado.foco.pv].pop(); // subir un nivel de la rejilla
    else if (enMapped() && LATERALES.includes(estado.foco.pv)) estado.foco = { ...estado.foco, pv: CENTROS[0] }; // salir de la pantalla completa
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
      if (f.propuesta) externa.quitarPropuesta(almacenLocal(), dondePropuestas(), f.propuesta);
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
    // Lo de la guía: la clave de la API, también aparte (solo en este navegador); los demás ajustes son un registro más.
    const campoIa = form.querySelector('[data-clave-ia]');
    if (campoIa && altaDeGuia()) guia.guardarClaveIa(almacenLocal(), altaDeGuia(), campoIa.value);
    const valoresGuia = Object.fromEntries([...form.querySelectorAll('[data-guia-campo]')].map((i) => [i.dataset.guiaCampo, i.value]));
    if (!preferencias(estado.eje, estado.identidad, valores)) { estado.motivosPreferencias = [{ mensaje: t('sinAlta') }]; pintar(); return; }
    try {
      await escribirPreferencias(valores);
      const ajustesGuia = guia.ajustesEditables(estado.eje, estado.identidad, valoresGuia);
      if (ajustesGuia?.cambiado) await salida.escribirDesde(estado.eje, { modo: 'sequenced', autor: estado.identidad, sobre: ajustesGuia.sobre, en: ajustesGuia.en, payload: ajustesGuia.payload }, privadaDe(estado.identidad));
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
      estado.aro = null; // lo escrito desde el centro del aro en edición: hecho, se cierra
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
      if (enMapped() || enSecuencia()) return; // en Mapped y en la columna de Sequenced cada PV tiene su sitio: deslizar sobre uno no lo cambia por otro
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
    if (enSecuencia()) return manejadores.digito(pv); // las teclas 0-9, como la fila de dígitos
    if (CENTROS.includes(pv)) { estado.foco.pv = pv; pintar(); return; }
    estado.niveles[pv] = Math.max(NIVEL.tarjeta, estado.niveles[pv] ?? NIVEL.comprimido);
    pintar();
    raiz.querySelector(`[data-pv="${pv}"]:not(.ocupante):not(.rejilla-celda)`)?.focus();
  },

  // ---------- la guía del PV9 (carta/guia.js): solo lectura ----------

  /** Pregunta a la guía con el contexto exacto de la pantalla; la respuesta se guarda en la conversación de esta alta. */
  async guiaPreguntar(pregunta) {
    const texto = String(pregunta ?? '').trim();
    const g = estado.guia;
    const eje = estado.eje;
    const yo = estado.identidad;
    const alta = altaDeGuia();
    if (!texto || g.pensando || !alta) return;
    datosGuia();
    Object.assign(g, { pensando: true, pendiente: texto, error: '', borrador: '' });
    pintarGuia();
    const aj = guia.ajustes(eje, yo);
    let r;
    try {
      const destino = guia.destinoDe(eje, yo);
      r = await guia.preguntar({
        via: aj.via, url: destino?.url, ejeCompartido: destino?.eje, claveLectura: cuentas.claveLectura(alta), claveIa: guia.claveIa(almacenLocal(), alta),
        modelo: aj.modelo, instrucciones: guia.instrucciones(eje, estado.foco.X, yo), historial: g.alta === alta ? g.historial : [], pregunta: texto, maximo: aj.historial,
        contexto: await guia.contexto(estado, eje, yo, { ...medidas(), cuenta: Boolean(estado.cuenta), tope: aj.contexto }),
      });
    } catch (e) {
      r = { ok: false, motivo: String(e?.message ?? e) };
    }
    if (r.ok) {
      const h = [...guia.cargarHistorial(almacenLocal(), alta, aj.historial), { role: 'user', content: texto }, { role: 'assistant', content: r.texto }].slice(-aj.historial);
      guia.guardarHistorial(almacenLocal(), alta, h, aj.historial);
      if (g.alta === alta) g.historial = h;
    } else if (g.alta === alta) {
      g.error = r.motivo;
      g.borrador = texto;
    }
    if (g.alta === alta) Object.assign(g, { pensando: false, pendiente: '' });
    pintarGuia();
  },
  /** Descargar el markdown con las instrucciones de la guía y el contexto exacto de la pantalla (carta/externa.js). */
  async guiaExportar() {
    if (!estado.eje || !estado.foco.X) return;
    try {
      const archivo = await externa.exportar(estado, estado.eje, estado.identidad, { ...medidas(), cuenta: Boolean(estado.cuenta) });
      descargarArchivo(archivo);
      estado.exito = t('externaDescargado', { archivo: archivo.nombre });
      estado.aviso = '';
    } catch (e) {
      estado.aviso = String(e?.message ?? e);
    }
    pintar();
  },
  /** Elegir el archivo de propuestas (el input oculto de la guía); lo que se elija llega a guiaArchivo. */
  guiaImportar() {
    raiz.querySelector('[data-guia-archivo]')?.click();
  },
  /** El texto de un archivo de propuestas: las que se entienden y las que no entran como pendientes. */
  guiaArchivo(texto) {
    const r = externa.importar(texto);
    if (!r.ok) { estado.aviso = r.motivo; estado.exito = ''; }
    else if (externa.anadirPropuestas(almacenLocal(), dondePropuestas(), r.propuestas)) { estado.exito = t('externaImportadas', { cuantas: r.propuestas.length }); estado.aviso = ''; }
    else { estado.aviso = t('sinAlmacenamiento'); estado.exito = ''; }
    pintar();
  },
  /**
   * Una propuesta importada: aceptar (lanzarla con sus parámetros: acciones.transaccion, las reglas y la firma; si algo no
   * pasa, el formulario con el motivo), modificar (el formulario con los parámetros rellenos) o rechazar (descartarla).
   */
  async propuesta(que, id) {
    const p = externa.leerPropuestas(almacenLocal(), dondePropuestas()).find((x) => x.id === id);
    if (!p || !estado.eje) return;
    if (que === 'rechazar') {
      externa.quitarPropuesta(almacenLocal(), dondePropuestas(), id);
      limpiarMensajes();
      pintar();
      return;
    }
    const e = externa.evaluar(estado.eje, estado.identidad, p);
    if (!e.valida) return;
    let motivos = [];
    if (que === 'aceptar') {
      const r = await enviar(estado.eje, e.sobre, e.accion, e.parametros, estado.identidad, firmarCon(estado.identidad));
      if (r.ok && r.asentado) {
        trasEscribir();
        externa.quitarPropuesta(almacenLocal(), dondePropuestas(), id);
        estado.exito = t('registrado', { accion: nombreDeAccion(e.accion), id: r.asentado.id.slice(0, 8) }) + (r.asentado.firma ? ' ' + t('firmado') : '');
        estado.aviso = '';
        tocar(e.sobre, 'hecho ' + canonicoDe(e.accion));
        marcarNuevos();
        pintar();
        return;
      }
      motivos = r.motivos ?? []; // lo que no pasa se enseña en el formulario, para cambiarlo
    }
    estado.formulario = { X: e.sobre, accion: e.accion, valores: e.parametros, motivos, resultado: null, propuesta: id };
    estado.aro = null;
    limpiarMensajes();
    tocar(e.sobre, 'lanzar ' + canonicoDe(e.accion));
    pintar();
  },
  /** Una de las preguntas hechas de la época (los botones rápidos). */
  guiaRapida(i) {
    const q = guia.preguntasRapidas(estado.eje, idioma())[i];
    if (q) return manejadores.guiaPreguntar(q);
  },
  /** Vaciar la conversación de esta alta. */
  guiaVaciar() {
    const alta = altaDeGuia();
    if (!alta) return;
    guia.vaciarHistorial(almacenLocal(), alta);
    Object.assign(estado.guia, { historial: [], error: '' });
    pintarGuia();
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
  estado.recientes = [];
  estado.paginas = {};
  estado.profundidad = {};
  estado.vistos = new Set();
  estado.nuevos = new Set();
  abrirLibroLocal();
  guardar();
  irA(foco);
}

// ---------- arranque ----------

async function arrancar() {
  gestos = instalar(raiz, manejadores);
  opinar.instalar({
    raiz, cuenta: () => estado.cuenta?.nombre ?? 'ejemplo', alCambiar: () => { void pintar(); },
    // Con «opinions anchor» (los ajustes de la guía), cada opinión se escribe además como un registro anclado en el proyecto.
    async alGuardar(opinion) {
      const r = await externa.anclarOpinion(estado.eje, estado.identidad, opinion, { firmar: firmarCon(estado.identidad) });
      if (r.ok) trasEscribir();
      return r;
    },
  });
  // El archivo de propuestas que elige la persona (el input oculto de la guía).
  raiz.addEventListener('change', async (e) => {
    if (!e.target.matches?.('[data-guia-archivo]')) return;
    const archivo = e.target.files?.[0];
    let texto = null;
    try { texto = archivo ? await archivo.text() : null; } catch { estado.aviso = t('externaNoSeLee'); pintar(); }
    e.target.value = '';
    if (texto !== null) manejadores.guiaArchivo(texto);
  });
  let temporizador = null;
  // Repintar solo si cambia el ancho y no hay un campo con el foco: el teclado del móvil solo cambia el alto y
  // dispara resize, y un repintado entero cerraba el teclado y perdía el archivo elegido (VG, 10-11, al restaurar).
  let anchoAnterior = window.innerWidth;
  window.addEventListener('resize', () => {
    const editando = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? '');
    if (editando || window.innerWidth === anchoAnterior) return;
    anchoAnterior = window.innerWidth;
    clearTimeout(temporizador); temporizador = setTimeout(pintar, 120);
  });
  // Lo escrito en la pregunta de la guía se recuerda (un repintado entero no lo pierde).
  raiz.addEventListener('input', (e) => { if (e.target.matches?.('[data-guia-pregunta]')) estado.guia.borrador = e.target.value; });
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
