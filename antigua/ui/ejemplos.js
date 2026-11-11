// Selector de ejemplo: comida (compra del menú), reserva (Booking) o tarea
// (Tasks), tres dominios con datos inventados sobre el mismo núcleo. Cada
// ejemplo vive en su módulo de ejemplos/ikisai y se carga al elegirlo, con
// import() dinámico: si el módulo no está en el repositorio (o un ejemplo
// nuevo lleva `pr`: llega con esa PR), se avisa y se sigue con el que había;
// nada se rompe. La reserva (#21) y la tarea (#34) ya están en main. Cada
// ejemplo dice qué identidades firman; las claves que falten se generan y se
// guardan junto a las demás en este navegador.

import { autoridad } from '../../src/index.js';
import { escapar, leerLocal, guardarLocal, franjaAjustes } from './comun.js';

const CLAVE_EJEMPLO = 'agram.ejemplo';
const CLAVE_FOCO = 'agram.foco';
const CLAVE_CLAVES = 'agram.claves';

/** Los ejemplos: id, etiqueta, módulo, PR que lo trae, identidades que firman, con quién se empieza y cómo se construye. */
export const EJEMPLOS = Object.freeze([
  {
    id: 'compra',
    etiqueta: 'comida',
    modulo: '../../ejemplos/ikisai/compra-food.mjs',
    identidades: ['casa', 'cocina', 'huesped'],
    identidad: 'huesped',
    async crear(m, claves) {
      const { eje, compra } = await m.ejemploCompra({ claves });
      await m.ejemploCuenta(eje, compra, claves.cocina?.privada);
      // El jardín y el parque (encargo «datos», issue #11): votos y umbral en el 2, paquetes en el 3.
      if (m.ejemploJardinYParque) await m.ejemploJardinYParque(eje, { compra }, Object.fromEntries(Object.entries(claves).map(([k, v]) => [k, v?.privada])));
      return { eje, foco: compra.id };
    },
  },
  {
    id: 'reserva',
    etiqueta: 'reserva',
    modulo: '../../ejemplos/ikisai/reserva-booking.mjs',
    identidades: ['casa', 'recepcion', 'huesped'],
    identidad: 'huesped',
    async crear(m, claves) {
      const { eje, reserva } = await m.ejemploReserva({ claves });
      return { eje, foco: reserva.id };
    },
  },
  {
    id: 'tarea',
    etiqueta: 'tarea',
    modulo: '../../ejemplos/ikisai/tarea-tasks.mjs',
    identidades: ['casa', 'organizadora', 'proveedor'],
    identidad: 'organizadora',
    async crear(m, claves) {
      const { eje, tarea } = await m.ejemploTarea({ claves });
      return { eje, foco: tarea.id };
    },
  },
]);

const porId = (id) => EJEMPLOS.find((x) => x.id === id);

let elegido = 'compra';
/** Ejemplos cuyo módulo no se pudo cargar en esta sesión: id → motivo. */
const ausentes = new Map();
/** Ejemplos cuyo módulo sí se ha cargado en esta sesión. */
const cargados = new Set();

export function ejemploElegido() {
  return elegido;
}

/** Elige el ejemplo que construirá crearEjemplo (sin construirlo). Un id desconocido no cambia nada. */
export function elegirEjemplo(id) {
  if (porId(id)) elegido = id;
  return elegido;
}

/**
 * ¿El fallo es que el módulo no está? En Node, ERR_MODULE_NOT_FOUND; en el
 * navegador, un TypeError al traerlo. Un módulo que está pero pide al
 * núcleo algo que aún no tiene da otro error (SyntaxError), y se dice tal cual.
 */
function noEsta(e) {
  return e?.code === 'ERR_MODULE_NOT_FOUND' || e instanceof TypeError;
}

/** Carga el módulo de un ejemplo; null (y el motivo en `ausentes`) si no está o no carga. */
export async function cargarModulo(def, importar = (ruta) => import(ruta)) {
  try {
    const m = await importar(def.modulo);
    ausentes.delete(def.id);
    cargados.add(def.id);
    return m;
  } catch (e) {
    const motivo = noEsta(e)
      ? 'aún no está en este repositorio' + (def.pr ? ' (llega con la PR #' + def.pr + ')' : '')
      : 'no carga con este núcleo: ' + String(e?.message ?? e);
    ausentes.set(def.id, motivo);
    return null;
  }
}

export function motivoAusente(id) {
  return ausentes.get(id);
}

/** Claves de las identidades del ejemplo: las que falten se generan y se guardan con las demás. */
async function asegurarClaves(claves, identidades) {
  const faltan = identidades.filter((id) => !claves[id]);
  if (!faltan.length) return;
  let guardadas = {};
  try { guardadas = JSON.parse(leerLocal(CLAVE_CLAVES) ?? '{}') ?? {}; } catch { guardadas = {}; }
  for (const id of faltan) {
    claves[id] = await autoridad.generarClaves();
    guardadas[id] = { publica: claves[id].publica, privada: await autoridad.exportarPrivada(claves[id].privada) };
  }
  guardarLocal(CLAVE_CLAVES, JSON.stringify(guardadas));
}

/** Nota bajo el selector: el último ejemplo que no se pudo abrir y por qué. */
let nota = '';

/**
 * Construye el eje del ejemplo elegido con las claves de `estado.claves`
 * (completa las que falten) y deja como identidad una que exista en él.
 * Si el módulo del elegido no está o falla al construirse, vuelve a la
 * comida y lo dice en el aviso. Devuelve { eje, foco }.
 */
export async function crearEjemplo(estado, { importar } = {}) {
  nota = '';
  const def = porId(elegido) ?? EJEMPLOS[0];
  let r = null;
  const m = await cargarModulo(def, importar);
  if (m) {
    try {
      await asegurarClaves(estado.claves, def.identidades);
      r = await def.crear(m, estado.claves);
    } catch (e) {
      if (def === EJEMPLOS[0]) throw e;
      ausentes.set(def.id, 'no se ha podido construir con este núcleo: ' + String(e.message ?? e));
    }
  }
  let usado = def;
  if (!r) {
    if (def === EJEMPLOS[0]) throw new Error('no se ha podido cargar el ejemplo «' + def.etiqueta + '»');
    nota = 'El ejemplo «' + def.etiqueta + '» ' + ausentes.get(def.id) + '. Sigue la comida.';
    estado.aviso = nota;
    usado = EJEMPLOS[0];
    const base = await cargarModulo(usado, importar);
    if (!base) throw new Error('no se ha podido cargar el ejemplo «' + usado.etiqueta + '»');
    await asegurarClaves(estado.claves, usado.identidades);
    r = await usado.crear(base, estado.claves);
  }
  elegido = usado.id;
  guardarLocal(CLAVE_EJEMPLO, elegido);
  if (!r.eje.identidades().includes(estado.identidad)) estado.identidad = usado.identidad;
  guardarLocal(CLAVE_FOCO, r.foco);
  refrescarSelector();
  return r;
}

/**
 * Al abrir un eje guardado: el foco donde se quedó (si sigue en el eje) y
 * una identidad que exista en él. Devuelve el foco o null.
 */
export function restaurarEjemplo(eje, estado) {
  const def = porId(elegido) ?? EJEMPLOS[0];
  const ids = eje.identidades();
  if (!ids.includes(estado.identidad)) estado.identidad = ids.includes(def.identidad) ? def.identidad : ids[0];
  const foco = leerLocal(CLAVE_FOCO);
  return foco && eje.obtener(foco) ? foco : null;
}

/** Rehace el selector si está en la página (en Node no hay página). */
function refrescarSelector() {
  const caja = globalThis.document?.querySelector('.ajuste-ejemplo');
  if (caja) caja.innerHTML = selector();
}

/**
 * Texto de la opción de un ejemplo. Saber si su módulo está obliga a
 * pedirlo (y, si falta, el navegador deja un 404 en la consola), así que no
 * se pide hasta que se elige; mientras tanto la opción ya dice de qué PR
 * llega, para que nadie lo elija a ciegas. Si se pidió y no estaba, queda
 * «(no disponible)» y apagada en esta sesión; si cargó, solo su nombre.
 */
export function etiquetaOpcion(def) {
  if (ausentes.has(def.id)) return def.etiqueta + ' (no disponible)';
  if (def.pr && !cargados.has(def.id)) return def.etiqueta + ' (PR #' + def.pr + ')';
  return def.etiqueta;
}

function selector() {
  const opciones = EJEMPLOS.map((x) => {
    const motivo = ausentes.get(x.id);
    return `<option value="${x.id}" ${x.id === elegido ? 'selected' : ''} ${motivo ? 'disabled' : ''}>${escapar(etiquetaOpcion(x))}</option>`;
  }).join('');
  return `<label class="ajuste" title="cambia de ejemplo: borra lo guardado en este navegador y empieza el elegido">ejemplo <select name="ejemplo">${opciones}</select></label>`
    + (nota ? `<span class="nota-ajuste">${escapar(nota)}</span>` : '');
}

/**
 * Pone el selector en la franja de ajustes. Al elegir: si el módulo del
 * ejemplo no está, se dice bajo el selector y se queda el que había, sin
 * borrar nada; si está, se empieza de cero con él (reiniciar).
 */
export function instalarEjemplos({ reiniciar }) {
  elegirEjemplo(leerLocal(CLAVE_EJEMPLO));
  const caja = document.createElement('span');
  caja.className = 'ajuste-ejemplo';
  caja.innerHTML = selector();
  franjaAjustes().prepend(caja);
  document.addEventListener('change', async (e) => {
    if (e.target.name !== 'ejemplo' || !e.target.closest('.ajustes')) return;
    const def = porId(e.target.value);
    if (!def || def.id === elegido) return;
    nota = '';
    if (!(await cargarModulo(def))) {
      nota = 'El ejemplo «' + def.etiqueta + '» ' + ausentes.get(def.id) + '. Sigue el que había.';
      refrescarSelector();
      return;
    }
    elegido = def.id;
    await reiniciar(); // crearEjemplo rehace el selector
  });
}

/** Tras cada pintado: recuerda el foco, para volver a él al recargar. */
export function trasPintarEjemplos(estado) {
  if (estado.foco) guardarLocal(CLAVE_FOCO, estado.foco);
}
