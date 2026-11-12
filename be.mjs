#!/usr/bin/env node
// Be: el mando de Core (docs/CONTRATO.md §17). Core (una IA desde la línea de comandos) lee el eje compartido de VG sin
// la pantalla, el modo «Be» de la tabla de interacciones («nombrarlo», «desde el PV…», «siguiente»), y escribe en él con
// su propia identidad, una COSA de VG (encargo core-escribe, VG 11-11): su alta la escribe VG con la plantilla «register
// a thing», que declara la clave de Core y lleva la prueba de posesión que firma Core (be.mjs identidad --crear deja la
// petición). Todo lo que Core escribe va firmado con su clave y pasa por las plantillas de la época (acciones.transaccion,
// o salida.escribirDesde para un payload BTML, como la carta). Core no tiene nada especial: es una identidad más, y lo
// que escribe sobre un registro ajeno sigue la regla general (R8, src/elegibles.js): ocupa, pero no entra en lo del
// dueño hasta que su criterio lo admite (docs/notas/CORE_IDENTIDAD.md).
//
//   node be.mjs <orden> [argumentos] [--config <ruta>] [--como <identidad>]
//
// La configuración es un JSON FUERA del repositorio ({ sync_url, eje, clave_lectura, identidad? }; también
// url/claveLectura), con --config o la variable AGRAM_BE_CONFIG; `identidad` ({ nombre, publica, privada }, en
// hexadecimal) la escribe `identidad --crear` y no se imprime nunca. La caché del eje, en ~/.agram/be/<eje>.json
// (AGRAM_BE_CACHE cambia la carpeta). Nada de eso entra en el repositorio.

import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sincronia, persistencia, contrato, acciones, autoridad, salida, elegibles, leer, leerEvento, direccion } from './src/index.js';
import { pintarPara } from './carta/texto.js';
import * as guia from './carta/guia.js';

const ORDENES = ['estado', 'ver', 'camino', 'aro', 'diario', 'opiniones', 'contexto', 'buscar', 'identidad', 'pendientes', 'escribir', 'proponer'];
/** Las banderas sin valor. */
const BANDERAS = ['nuevas', 'crear', 'pedir', 'ayuda'];
/** El nombre de la identidad de Core si la configuración no dice otro. */
const NOMBRE_CORE = 'core';
const AYUDA = `uso: node be.mjs <orden> [argumentos] [--config <ruta>] [--como <identidad>]
  estado                            el eje, cuántos registros, el último orden, las identidades
  ver <X>                           lectura, madurez y carta de texto de X (id, 8+ caracteres o su 0)
  camino <X>                        los pasos del camino de X para --como
  aro <X>                           las acciones por punto de vista de X para --como
  diario [--desde n] [--cuantos n]  las últimas entradas leídas, por llegada
  opiniones [proyecto] [--nuevas]   las opiniones ancladas en el proyecto (por defecto AGRAM)
  contexto <X> [--tope n]           el contexto que la guía manda a la IA
  buscar <texto>                    registros cuyo 0 o lectura lo contienen
  identidad                         la identidad de Core: su clave (huella), su alta, su T y lo que ha escrito en lo ajeno
                                    (aceptado o pendiente, por el criterio de cada dueño)
  pendientes                        lo que Core ha escrito en lo ajeno y su dueño aún no ha aceptado, por registro
  identidad --crear [--nombre core] [--minutos 60] [--salida <ruta>]
                                    genera el par de claves de Core (BIP-340) en la configuración (nunca se imprime) y deja
                                    la petición de alta: un archivo que VG importa en la carta (guía · importar propuestas)
                                    y acepta; su alta la escribe VG: Core es una cosa suya
  identidad --pedir [--minutos n] [--salida <ruta>]
                                    rehace la petición con la clave que ya hay
  escribir <plantilla> --sobre <X> [--valores <json>]
                                    lanza una acción del aro como Core (acciones.transaccion), firmada, y la sube
  escribir --archivo <payload.json> --sobre <X> [--en <posición>] [--modo sequenced]
                                    escribe un payload BTML como lo escribe un formulario de la carta (salida.escribirDesde)
  proponer <título> [--sobre <registro>] [--valores <json>]
                                    atajo de «escribir propose»: una propuesta en la fábrica (el 4) del registro; por defecto
                                    el proyecto de VG (su ancla de opiniones, o el registro AGRAM)
Lo que Core escribe sobre un registro ajeno queda pendiente hasta que el dueño lo acepta con la regla general: lo
admite su criterio, nombrando a «core» en el 2.3 del registro («con quién») o en su 3 (la acción «admit someone» del
aro: le da R suya y ancla en el 3). Todo pasa por las reglas.
configuración: JSON fuera del repo con { "sync_url", "eje", "clave_lectura" } (--config o AGRAM_BE_CONFIG)

primer uso (lo hace Core a mano):
  export AGRAM_BE_CONFIG=~/.agram/be/vg-config.json
  node be.mjs identidad --crear                       # deja ~/.agram/be/peticion-alta-core.json
  # VG: en la carta, guía → importar propuestas → ese archivo → aceptar («dar de alta una cosa», en su alta)
  node be.mjs identidad                               # alta: sí, T de minuto: 60
  node be.mjs proponer "AGRAM" --valores '{"content":"el sistema: núcleo, época y carta"}'
  node be.mjs proponer "Ikisai" --valores '{"content":"el ecosistema de apps"}'
  node be.mjs proponer "Mueling Sovereignty" --valores '{"content":"el proyecto"}'
  # VG: las acepta admitiendo a «core» en el proyecto («admit someone», PV3: le da R suya); Core lo ve con
  # «node be.mjs pendientes» (lo que falta) o «node be.mjs identidad» (todo)`;

class ErrorBe extends Error {}

// ---------- argumentos y configuración ----------

function argumentos(lista) {
  const pos = [];
  const f = {};
  for (let i = 0; i < lista.length; i++) {
    const a = lista[i];
    if (a.startsWith('--') && BANDERAS.includes(a.slice(2))) f[a.slice(2)] = true;
    else if (a.startsWith('--')) {
      if (i + 1 >= lista.length) throw new ErrorBe('falta el valor de ' + a);
      f[a.slice(2)] = lista[++i];
    } else pos.push(a);
  }
  return { orden: pos[0], pos: pos.slice(1), f };
}

function configuracion(f, entorno) {
  const ruta = f.config ?? entorno.AGRAM_BE_CONFIG;
  if (!ruta) throw new ErrorBe('falta la configuración: --config <ruta> o AGRAM_BE_CONFIG (un JSON fuera del repo con sync_url, eje y clave_lectura)');
  let c;
  try {
    c = JSON.parse(readFileSync(ruta, 'utf8'));
  } catch (e) {
    throw new ErrorBe('no se puede leer la configuración ' + ruta + ': ' + e.message);
  }
  const url = c.sync_url ?? c.url;
  const claveLectura = c.clave_lectura ?? c.claveLectura;
  if (typeof url !== 'string' || !url || typeof c.eje !== 'string' || !c.eje || typeof claveLectura !== 'string' || !claveLectura) {
    throw new ErrorBe('la configuración necesita sync_url (o url), eje y clave_lectura (o claveLectura)');
  }
  const identidad = c.identidad && typeof c.identidad === 'object' && !Array.isArray(c.identidad) ? c.identidad : null;
  return { url: url.replace(/\/+$/, ''), eje: c.eje, claveLectura, identidad, ruta: resolve(ruta), crudo: c };
}

/** Guarda la configuración entera (atómica, solo para su dueño): la usa `identidad --crear` para añadir las claves. */
function guardarConfiguracion(ruta, datos) {
  const tmp = ruta + '.tmp';
  writeFileSync(tmp, JSON.stringify(datos, null, 2) + '\n', { mode: 0o600 });
  renameSync(tmp, ruta);
}

// ---------- la caché ----------

const rutaCache = (eje, entorno) => join(entorno.AGRAM_BE_CACHE ?? join(homedir(), '.agram', 'be'), eje.replace(/[^a-z0-9._-]/gi, '_') + '.json');

function leerCache(ruta) {
  try {
    return JSON.parse(readFileSync(ruta, 'utf8'));
  } catch {
    return null;
  }
}

function guardarCache(ruta, datos) {
  mkdirSync(dirname(ruta), { recursive: true });
  const tmp = ruta + '.tmp';
  writeFileSync(tmp, JSON.stringify(datos), { mode: 0o600 });
  renameSync(tmp, ruta);
}

/**
 * Abre el eje: la caché (si es de este servidor y eje) y lo nuevo del servidor, con las reglas enteras; sin caché,
 * `sincronizar(null)` lo crea desde el génesis del servidor. Sin red, la caché, y lo dice.
 * → { eje, S, cache, avisos, ruta }.
 */
async function abrir(cfg, entorno) {
  const ruta = rutaCache(cfg.eje, entorno);
  let cache = leerCache(ruta);
  if (cache && (cache.version !== 1 || cache.url !== cfg.url || cache.eje !== cfg.eje)) cache = null;
  let eje = null;
  let S = null;
  if (cache) {
    try {
      eje = await persistencia.restaurar(cache.datos);
      S = sincronia.Sincronia.restaurar(cache.sincronia, { claveLectura: cfg.claveLectura });
    } catch {
      eje = null;
      S = null;
      cache = null; // caché ilegible: se baja de nuevo
    }
  }
  S ??= new sincronia.Sincronia({ url: cfg.url, eje: cfg.eje, claveLectura: cfg.claveLectura });
  const informe = await S.sincronizar(eje, { subir: false });
  const avisos = [];
  if (informe.errores.length) throw new ErrorBe(informe.errores.join('\n'));
  eje = informe.eje ?? eje;
  if (informe.sinRed) {
    if (!eje) throw new ErrorBe('sin red y sin caché de «' + cfg.eje + '»: no hay nada que leer');
    avisos.push('sin red: leo la caché (' + (cache?.actualizado ?? 'sin fecha') + ', hasta el orden ' + S.desde + ')');
  }
  if (!eje) throw new ErrorBe('el eje «' + cfg.eje + '» está vacío en el servidor');
  if (S.rechazados.length) avisos.push(S.rechazados.length + ' registros del servidor no entran en este eje por las reglas (se ignoran)');
  const nueva = {
    version: 1,
    url: cfg.url,
    eje: cfg.eje,
    actualizado: informe.sinRed ? (cache?.actualizado ?? null) : new Date().toISOString(),
    sincronia: S.serializar(),
    datos: persistencia.serializar(eje),
    opinionesVistas: cache?.opinionesVistas ?? {},
  };
  if (!informe.sinRed || !cache) guardarCache(ruta, nueva);
  return { eje, S, cache: nueva, avisos, ruta };
}

// ---------- ayudas de lectura ----------

const corto = (id) => String(id).slice(0, 8);
const aplanar = (x) => (Array.isArray(x) ? x.flatMap(aplanar) : [x]);
/** El 0 de un registro, como texto (su primera hoja de texto). */
const cero = (ev) => String(aplanar(typeof ev?.payload === 'string' ? ev.payload : ev?.payload?.[0]).find((x) => typeof x === 'string' || typeof x === 'number') ?? '');
const etiquetaDe = (eje, id) => (id && eje.obtener(id) ? corto(id) + ' «' + cero(eje.obtener(id)) + '»' : String(id ?? '-'));
const sangrar = (texto, n = 2) => String(texto).split('\n').map((l) => ' '.repeat(n) + l).join('\n');

function registro(eje, texto) {
  if (!texto) throw new ErrorBe('falta el registro (id, 8 o más caracteres de su id, o su 0)');
  const id = acciones.registroDe(eje, texto);
  if (!id || !eje.obtener(id)) throw new ErrorBe('no encuentro el registro «' + texto + '» (o es ambiguo: prueba con más caracteres del id)');
  return id;
}

function quien(eje, f) {
  const yo = f.como ?? eje.obtener(eje.genesisId).autor;
  if (!eje.alta(yo)) throw new ErrorBe('«' + yo + '» no tiene alta en este eje. Identidades: ' + eje.identidades().join(', '));
  return yo;
}

const idiomaDe = (eje, yo) => contrato.configuracion(eje, yo).language ?? 'en';
const traducir = (eje, idioma, nombre) => contrato.texto(eje, contrato.claves.plantilla(nombre), idioma, { original: nombre });

/** Los ids de una opinión y de todas sus respuestas, en hilo. */
const idsDeHilo = (o) => [o.id, ...o.respuestas.flatMap(idsDeHilo)];

// ---------- escribir como Core (encargo core-escribe, VG 11-11) ----------

/** El instante de lo que Core escribe: ahora, en segundos. */
const ahora = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
/** Los motivos de las reglas, en el idioma de Be. */
const IDIOMA = 'es';
const textoMotivos = (motivos) => motivos.map((m) => '  · ' + m.mensaje).join('\n');

/** La identidad de Core de la configuración, comprobada: { nombre, publica, privada } (la privada es la pareja de la pública). */
function identidadDe(cfg) {
  const i = cfg.identidad;
  if (!i) throw new ErrorBe('la configuración no tiene identidad de Core: node be.mjs identidad --crear');
  if (typeof i.nombre !== 'string' || !i.nombre) throw new ErrorBe('la identidad de la configuración no tiene nombre');
  let publica;
  try {
    publica = autoridad.publicaDe(i.privada);
  } catch {
    throw new ErrorBe('la clave privada de la identidad de la configuración no vale (32 bytes en hexadecimal)');
  }
  if (publica !== i.publica) throw new ErrorBe('la clave pública de la identidad de la configuración no es la pareja de su privada');
  return { nombre: i.nombre, publica, privada: i.privada };
}

/** Core en este eje, listo para escribir: con alta y con su clave declarada en ella. Si no, qué falta. */
function coreEnEje(eje, cfg) {
  const yo = identidadDe(cfg);
  if (!eje.alta(yo.nombre)) throw new ErrorBe('«' + yo.nombre + '» aún no tiene alta en este eje: la da VG al aceptar la petición (node be.mjs identidad --pedir la rehace)');
  if (eje.clave(yo.nombre) !== yo.publica) throw new ErrorBe('«' + yo.nombre + '» tiene alta en este eje con otra clave: esta configuración no puede escribir como ella');
  return yo;
}

/** El dueño del eje (el autor del génesis: VG) y su proyecto: el ancla de sus opiniones o, si no la fija, el registro AGRAM. */
function proyectoDe(eje) {
  const dueno = eje.obtener(eje.genesisId).autor;
  const P = acciones.proyectoDeOpiniones(eje, dueno) ?? acciones.registroDe(eje, 'AGRAM');
  return { dueno, proyecto: P && eje.obtener(P) ? P : null };
}

/** Una plantilla de transacción por su nombre canónico o el de Be (español), sin mayúsculas. */
function plantillaPorNombre(eje, nombre) {
  const q = String(nombre ?? '').trim().toLowerCase();
  const p = acciones.plantillasDeTransaccion().find((x) => x.nombre.toLowerCase() === q || traducir(eje, IDIOMA, x.nombre).toLowerCase() === q);
  if (!p) throw new ErrorBe('no hay ninguna acción «' + nombre + '» en la época');
  return p;
}

/** --valores: un objeto JSON por el nombre canónico del parámetro o por su etiqueta; una referencia, por id, 8+ caracteres o su 0. */
function valoresDe(eje, plantilla, texto) {
  if (texto === undefined) return {};
  let v;
  try {
    v = JSON.parse(texto);
  } catch (e) {
    throw new ErrorBe('--valores no es JSON: ' + e.message);
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new ErrorBe('--valores es un objeto JSON: {"parámetro": valor}');
  const pedidos = acciones.parametros(plantilla, { idioma: IDIOMA });
  const fuera = {};
  for (const [k, valor] of Object.entries(v)) {
    const p = pedidos.find((x) => x.nombre.toLowerCase() === k.toLowerCase() || x.etiqueta.toLowerCase() === k.toLowerCase());
    if (!p) throw new ErrorBe('«' + k + '» no es un parámetro de «' + acciones.nombreDeAccion(plantilla) + '»: ' + pedidos.map((x) => x.nombre).join(', '));
    fuera[p.nombre] = p.tipo === 'ref' && typeof valor === 'string' ? acciones.registroDe(eje, valor) ?? valor : valor;
  }
  return fuera;
}

/** Una posición «1.2» como dirección. */
function direccionDe(texto) {
  const d = String(texto).split('.').map(Number);
  if (!d.length || d.length > 10 || !d.every((x) => Number.isInteger(x) && x >= 0 && x <= 9)) throw new ErrorBe('--en es una posición: dígitos separados por puntos (1.2)');
  return direccion(d);
}

/**
 * Una acción del aro como Core: la construye y la valida acciones.transaccion (las plantillas y las reglas, firmada con
 * su clave) y la asienta en el eje local, como la carta (carta.enviar). → el evento asentado.
 */
async function lanzar(eje, nombre, X, valores, yo, t) {
  const r = await acciones.transaccion(eje, nombre, { X, ...valores }, yo.nombre, { t, idioma: IDIOMA, firmar: (ev) => autoridad.firmar(ev, yo.privada) });
  if (!r.ok || !r.evento) throw new ErrorBe('«' + nombre + '» no pasa:\n' + textoMotivos(r.motivos));
  return eje.anadir(r.evento);
}

/** Sube lo escrito (lo que el eje tiene y el servidor no: la cola de la sincronía) y guarda la caché. → líneas. */
async function subirLoEscrito({ eje, S, ruta, cache }) {
  const informe = await S.sincronizar(eje);
  guardarCache(ruta, { ...cache, actualizado: new Date().toISOString(), sincronia: S.serializar(), datos: persistencia.serializar(eje) });
  if (informe.errores.length) return ['no se pudo subir: ' + informe.errores.join('; ') + ' (queda en la caché, en la cola)'];
  if (informe.sinRed) return ['sin red: queda en la cola de la caché y sube con la próxima orden que escriba'];
  const rechazados = S.rechazados.filter((r) => r.de === 'servidor');
  if (informe.pendientes.length) return ['subidos ' + informe.subidos.length + '; pendientes ' + informe.pendientes.length + (rechazados.length ? ' · el servidor rechaza: ' + rechazados.map((r) => corto(r.id) + ' ' + r.motivo).join('; ') : '')];
  return ['subido al eje compartido: ' + informe.subidos.length + (informe.subidos.length === 1 ? ' registro' : ' registros')];
}

/**
 * Si un escrito está aceptado en el registro ajeno sobre el que va, por la regla general (R8, src/elegibles.js): entra en
 * lo del dueño si su criterio admite al autor (lo nombra en el 2.3 del registro, «con quién», o en su 3; o «cualquiera»).
 * Lo mismo para cualquier identidad: no hay nada propio de Core.
 */
function aceptacionDe(eje, ev) {
  const X = eje.obtener(ev.sobre);
  if (!X) return '?';
  if (X.autor === ev.autor) return 'en lo suyo';
  const el = elegibles.elegibles(eje, X.id);
  if (el.vetados?.has(ev.autor)) return 'vetado: ' + el.dueno + ' lo ha vetado (su 3.5)';
  if (el.todos) return 'aceptado (el criterio de ' + el.dueno + ' admite a cualquiera)';
  // La admisión baja por el árbol (encargo pv3): admitido arriba, en lo del mismo dueño.
  if (el.heredados?.has(ev.autor)) return 'aceptado (' + el.dueno + ' admite a ' + ev.autor + ' en lo de arriba: baja por el árbol)';
  if (el.autores.has(ev.autor)) return 'aceptado (' + el.dueno + ' admite a ' + ev.autor + (el.origen === 'lista' ? ' en el 2.3' : ' en su 3') + ')';
  return 'pendiente: ' + el.dueno + ' no lo ha aceptado';
}

/** Crea el par de claves de Core en la configuración (nunca lo imprime). No pisa una identidad que ya esté. */
async function crearIdentidad(cfg, f) {
  if (cfg.identidad) throw new ErrorBe('la configuración ya tiene identidad («' + cfg.identidad.nombre + '»): no se pisa una clave. Para rehacer la petición: node be.mjs identidad --pedir');
  const nombre = f.nombre ?? NOMBRE_CORE;
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(nombre)) throw new ErrorBe('el nombre de la identidad va en minúsculas, cifras, punto, guion o subrayado: ' + nombre);
  const { publica, privada } = await autoridad.generarClaves();
  guardarConfiguracion(cfg.ruta, { ...cfg.crudo, identidad: { nombre, publica, privada } });
  cfg.identidad = { nombre, publica, privada };
  return ['identidad de Core creada: ' + nombre + ' · clave ' + autoridad.huella(publica) + '… (el par está en ' + cfg.ruta + '; no se imprime)'];
}

/**
 * La petición de alta de Core: lo que VG importa en la carta y acepta. Es la plantilla «register a thing» sobre el alta
 * de VG, construida como la construirá la carta de VG (acciones.transaccion con VG como quien la lanza y este instante),
 * con la prueba de posesión que firma Core sobre su id. Va como una propuesta del formato de la guía (carta/externa.js)
 * con su instante `t`: con otro, el id cambia y la prueba no vale.
 */
async function peticionDeAlta(eje, cfg, f, yo) {
  const dueno = eje.obtener(eje.genesisId).autor;
  const altaDueno = eje.alta(dueno).id;
  const t = ahora();
  const parametros = { thing: yo.nombre, key: yo.publica, ...(f.minutos !== undefined ? { minutes: Number(f.minutos) } : {}) };
  const r = await acciones.transaccion(eje, 'register a thing', { X: altaDueno, ...parametros }, dueno, { t, idioma: IDIOMA, firmar: (ev) => autoridad.firmarPosesion(ev, yo.nombre, yo.privada) });
  // Lo único que le falta es la firma de VG.
  const otros = r.motivos.filter((m) => m.regla !== 'who has a key signs');
  if (!r.evento || otros.length) throw new ErrorBe('la petición de alta no pasaría las reglas:\n' + textoMotivos(otros.length ? otros : r.motivos));
  const minutos = r.evento.movimientos.find((m) => m.a === yo.nombre)?.cantidad;
  const archivo = {
    formato: 'agram-peticion-alta',
    version: 1,
    propuestas: [{
      accion: 'register a thing',
      sobre: altaDueno,
      parametros: { thing: yo.nombre, minutes: minutos, key: yo.publica, proof: r.evento.posesion[yo.nombre] },
      t,
      porque: 'Core pide su alta como cosa de ' + dueno + ': escribirá con su propia clave, firmado, y solo propuestas dentro de tu proyecto, que aceptas desde el aro. Le das ' + minutos + ' minutos de T para escribir.',
    }],
  };
  const ruta = resolve(f.salida ?? join(dirname(cfg.ruta), 'peticion-alta-' + yo.nombre + '.json'));
  writeFileSync(ruta, JSON.stringify(archivo, null, 2) + '\n');
  return [
    'petición de alta: ' + ruta,
    '  VG: en la carta, guía → importar propuestas → este archivo; aparece en el camino de tu alta («' + traducir(eje, IDIOMA, 'register a thing') + '»): aceptar.',
    '  Da de alta a «' + yo.nombre + '» como cosa de ' + dueno + ' con ' + minutos + ' minutos de T; la petición lleva su instante (' + t + ') y vale mientras «' + yo.nombre + '» no tenga alta.',
  ];
}

// ---------- las órdenes ----------

const ordenesDe = {
  estado({ eje, S, cfg }) {
    const out = ['eje: ' + cfg.eje, 'registros: ' + eje.orden.length, 'último orden del servidor: ' + S.desde, 'génesis: ' + corto(eje.genesisId) + ' · ' + eje.obtener(eje.genesisId).autor, 'identidades (altas):'];
    for (const i of eje.identidades()) {
      const alta = eje.alta(i);
      out.push('  ' + i + (alta ? ' · alta ' + corto(alta.id) + ' · 0: «' + cero(eje.obtener(alta.id)) + '»' : ''));
    }
    const proyecto = acciones.registroDe(eje, 'AGRAM');
    out.push(proyecto ? 'proyecto AGRAM: ' + corto(proyecto) + ' (' + eje.sobre(proyecto).length + ' anclados directos)' : 'proyecto AGRAM: no hay ningún registro con ese 0');
    return out;
  },

  async ver({ eje, pos, f }) {
    const X = registro(eje, pos[0]);
    const yo = quien(eje, f);
    const m = contrato.madurez(eje, X);
    return [
      '# ' + corto(X) + ' · como ' + yo, X, '',
      '## lectura', leerEvento(eje, X), '',
      '## madurez', m?.nombre ? 'nivel ' + m.nivel + '/' + m.de + ' · ' + m.nombre : 'sin nivel', '',
      '## carta de texto (tamaño 3)', await pintarPara(eje, X, 3, yo),
    ];
  },

  async camino({ eje, pos, f }) {
    const X = registro(eje, pos[0]);
    const yo = quien(eje, f);
    const idioma = idiomaDe(eje, yo);
    const c = await acciones.camino(eje, X, yo);
    const out = ['camino de ' + corto(X) + ' «' + cero(eje.obtener(X)) + '» como ' + yo + ' · ' + c.pasos.length + ' pasos' + (c.niveles ? ' · niveles: ' + c.niveles.join(' → ') : '')];
    c.pasos.forEach((p, i) => {
      const estado = p.hecho ? 'hecho' : p.espera ? 'espera a ' + p.espera : p.hacer ? 'hacer: ' + traducir(eje, idioma, p.hacer.plantilla) + ' (' + p.hacer.plantilla + ')' : '';
      out.push((i + 1) + '. [' + p.fuente + '] ' + estado + (p.falta ? '\n     falta: ' + p.falta : ''));
    });
    return out;
  },

  aro({ eje, pos, f }) {
    const X = registro(eje, pos[0]);
    const yo = quien(eje, f);
    const idioma = idiomaDe(eje, yo);
    const out = ['aro de ' + corto(X) + ' «' + cero(eje.obtener(X)) + '» como ' + yo];
    for (let pv = 0; pv <= 9; pv++) {
      const lista = acciones.acciones(eje, X, pv, yo);
      if (!lista.length) continue;
      out.push('PV' + pv + ':');
      for (const a of lista) {
        const faltan = a.parametros.filter((p) => p.falta).map((p) => p.nombre);
        out.push('  ' + (a.porDefecto ? '* ' : '- ') + a.nombre + ' · ' + traducir(eje, idioma, a.nombre) + (faltan.length ? ' · falta: ' + faltan.join(', ') : ''));
      }
    }
    if (out.length === 1) out.push('(sin acciones para esta identidad)');
    return out;
  },

  diario({ eje, S, f }) {
    const n = Math.max(1, Number(f.cuantos ?? 10));
    const total = eje.orden.length;
    const desde = f.desde !== undefined ? Math.max(1, Number(f.desde)) : Math.max(1, total - n + 1);
    const ids = eje.orden.slice(desde - 1, desde - 1 + n);
    const out = ['diario: ' + ids.length + ' entradas de ' + total + ' (llegada ' + desde + ' a ' + (desde + ids.length - 1) + ')'];
    ids.forEach((id, i) => {
      out.push('', '#' + (desde + i) + (S.orden(id) !== undefined ? ' · orden ' + S.orden(id) : '') + (S.recibido(id) ? ' · recibido ' + S.recibido(id) : ''));
      out.push(sangrar(leerEvento(eje, id)));
    });
    return out;
  },

  opiniones({ eje, pos, f, cache }) {
    const P = pos[0] ? registro(eje, pos[0]) : acciones.registroDe(eje, 'AGRAM');
    if (!P) throw new ErrorBe('no hay ningún registro AGRAM: indica el proyecto (id, 8 caracteres o su 0)');
    const vistas = new Set(cache.opinionesVistas[P] ?? []);
    const todas = acciones.opiniones(eje, P);
    const lista = f.nuevas ? todas.filter((o) => idsDeHilo(o).some((id) => !vistas.has(id))) : todas;
    const out = ['opiniones en ' + corto(P) + ' «' + cero(eje.obtener(P)) + '»: ' + lista.length + (f.nuevas ? ' nuevas (de ' + todas.length + ')' : '')];
    const respuestas = (l, n) => l.flatMap((r) => [' '.repeat(n) + '↳ ' + r.t + ' · ' + r.autor + ' · ' + corto(r.id) + (f.nuevas && !vistas.has(r.id) ? ' · NUEVA' : '') + ' · ' + r.texto, ...respuestas(r.respuestas, n + 2)]);
    for (const o of lista) {
      out.push('', o.t + ' · ' + o.autor + ' · ' + corto(o.id));
      if (o.clasificacion.length) out.push('  clasificación: ' + o.clasificacion.join(' · '));
      out.push('  sobre: ' + etiquetaDe(eje, o.sobre) + (o.ruta.length ? ' · ruta: ' + o.ruta.join(' > ') : ''));
      out.push('  texto: ' + o.texto);
      if (o.respuestas.length) out.push('  respuestas (' + o.respuestas.length + '):', ...respuestas(o.respuestas, 4));
    }
    // Todo lo listado queda marcado como visto: --nuevas enseña solo lo posterior a la última vez.
    cache.opinionesVistas[P] = [...new Set([...vistas, ...todas.flatMap(idsDeHilo)])];
    return out;
  },

  async contexto({ eje, pos, f }) {
    const X = registro(eje, pos[0]);
    const yo = quien(eje, f);
    return [await guia.contexto({ foco: { X, pv: 0 }, niveles: {} }, eje, yo, { cuenta: true, ...(f.tope ? { tope: Number(f.tope) } : {}) })];
  },

  buscar({ eje, pos }) {
    const q = pos.join(' ').trim().toLowerCase();
    if (!q) throw new ErrorBe('falta el texto que buscar');
    const hallados = [];
    for (const id of eje.orden) {
      const ev = eje.obtener(id);
      const c = cero(ev);
      if (c.toLowerCase().includes(q) || leer(ev.payload, { eje }).toLowerCase().includes(q)) hallados.push(corto(id) + ' · ' + ev.autor + ' · ' + ev.t + ' · 0: «' + c + '»');
    }
    return [hallados.length + ' registros con «' + pos.join(' ') + '»', ...hallados.slice(0, 50), ...(hallados.length > 50 ? ['… y ' + (hallados.length - 50) + ' más: afina la búsqueda'] : [])];
  },

  async identidad({ eje, cfg, f }) {
    const yo = identidadDe(cfg);
    const out = ['identidad de Core: ' + yo.nombre + ' · clave ' + autoridad.huella(yo.publica) + '…'];
    const alta = eje.alta(yo.nombre);
    if (!alta) {
      out.push('alta: aún no');
      if (f.crear || f.pedir) out.push(...(await peticionDeAlta(eje, cfg, f, yo)));
      else out.push('  la da VG al aceptar la petición: node be.mjs identidad --pedir la hace');
      return out;
    }
    const ev = eje.obtener(alta.id);
    if (eje.clave(yo.nombre) !== yo.publica) out.push('OJO: «' + yo.nombre + '» tiene alta en este eje con otra clave: esta configuración no escribe como ella');
    out.push('alta: ' + corto(alta.id) + ' · la escribió ' + ev.autor + (eje.esPersona(yo.nombre) === false ? ' (es una cosa suya)' : '') + ' · sobre ' + etiquetaDe(eje, ev.sobre));
    out.push('T de minuto: ' + eje.saldoT(yo.nombre, 'minuto'));
    if (f.crear || f.pedir) out.push('(ya tiene alta: no hace falta petición)');
    const { proyecto } = proyectoDe(eje);
    out.push('proyecto de VG: ' + (proyecto ? etiquetaDe(eje, proyecto) : 'ninguno (ni ancla de opiniones ni registro AGRAM)'));
    // Lo que ha escrito sobre registros ajenos, y si cada dueño lo ha aceptado (la regla general, R8).
    const ajenos = eje.orden.map((id) => eje.obtener(id)).filter((e) => e.autor === yo.nombre && e.sobre && eje.obtener(e.sobre)?.autor !== yo.nombre);
    out.push('escrito en lo ajeno: ' + ajenos.length);
    for (const e of ajenos) out.push('  ' + corto(e.id) + ' «' + cero(e) + '» sobre ' + etiquetaDe(eje, e.sobre) + ' en ' + e.en + ' · ' + aceptacionDe(eje, e));
    return out;
  },

  /**
   * Lo que Core tiene pendiente de aceptación, por registro: sus escritos sobre registros ajenos que el criterio del
   * dueño aún no admite (la regla general, R8, como en `identidad`), agrupados por el registro sobre el que van.
   */
  async pendientes({ eje, cfg }) {
    const yo = coreEnEje(eje, cfg);
    const porRegistro = new Map();
    for (const id of eje.orden) {
      const e = eje.obtener(id);
      if (e.autor !== yo.nombre || !e.sobre) continue;
      const X = eje.obtener(e.sobre);
      if (!X || X.autor === yo.nombre) continue;
      const el = elegibles.elegibles(eje, X.id);
      if (el.todos || el.autores.has(e.autor)) continue;
      if (!porRegistro.has(X.id)) porRegistro.set(X.id, []);
      porRegistro.get(X.id).push(e);
    }
    const n = [...porRegistro.values()].reduce((s, l) => s + l.length, 0);
    const out = ['pendiente de aceptación: ' + n + (n === 1 ? ' escrito' : ' escritos') + ' en ' + porRegistro.size + (porRegistro.size === 1 ? ' registro' : ' registros')];
    for (const [X, lista] of porRegistro) {
      out.push(etiquetaDe(eje, X) + ' · de ' + eje.obtener(X).autor + ' · ' + lista.length);
      for (const e of lista) out.push('  ' + corto(e.id) + ' «' + cero(e) + '» en ' + e.en + ' · ' + e.t);
    }
    if (n) out.push('(lo acepta el dueño admitiendo a ' + yo.nombre + ' en ese registro: «admit someone», que le da R suya)');
    return out;
  },

  async escribir(ctx) {
    const { eje, cfg, pos, f } = ctx;
    const yo = coreEnEje(eje, cfg);
    if (f.sobre === undefined) throw new ErrorBe('falta --sobre <X>: el registro sobre el que se escribe');
    const X = registro(eje, f.sobre);
    const t = ahora();
    let ev;
    let que;
    if (f.archivo !== undefined) {
      if (pos.length) throw new ErrorBe('o una plantilla o --archivo, no las dos');
      let payload;
      try {
        payload = JSON.parse(readFileSync(f.archivo, 'utf8'));
      } catch (e) {
        throw new ErrorBe('no se puede leer el payload ' + f.archivo + ': ' + e.message);
      }
      try {
        ev = await salida.escribirDesde(eje, { modo: f.modo ?? 'sequenced', autor: yo.nombre, sobre: X, en: f.en === undefined ? undefined : direccionDe(f.en), payload, t }, yo.privada);
      } catch (e) {
        throw new ErrorBe('el registro no pasa: ' + String(e.message ?? e).replace(/^evento (rechazado|mal formado): /, ''));
      }
      que = 'payload (' + (f.modo ?? 'sequenced') + ')';
    } else {
      if (!pos.length) throw new ErrorBe('falta la plantilla (una acción del aro) o --archivo <payload.json>');
      if (f.en !== undefined) throw new ErrorBe('con una plantilla, dónde ancla lo dice la plantilla (su 5): --en solo va con --archivo');
      const p = plantillaPorNombre(eje, pos.join(' '));
      ev = await lanzar(eje, p.nombre, X, valoresDe(eje, p.plantilla, f.valores), yo, t);
      que = p.nombre;
    }
    return ['escrito: ' + corto(ev.id) + ' «' + cero(ev) + '» · ' + que + ' · por ' + yo.nombre + ' · sobre ' + etiquetaDe(eje, ev.sobre) + ' en ' + ev.en, 'estado: ' + aceptacionDe(eje, ev), ...(await subirLoEscrito(ctx))];
  },

  async proponer(ctx) {
    const { eje, cfg, pos, f } = ctx;
    const yo = coreEnEje(eje, cfg);
    const titulo = pos.join(' ').trim();
    if (!titulo) throw new ErrorBe('falta el título de la propuesta');
    const P = f.sobre !== undefined ? registro(eje, f.sobre) : proyectoDe(eje).proyecto;
    if (!P) throw new ErrorBe('no hay proyecto de VG (ni ancla de opiniones ni registro AGRAM): indica dónde con --sobre <registro>');
    const valores = valoresDe(eje, acciones.plantillaDeTransaccion('propose'), f.valores);
    const propuesta = await lanzar(eje, 'propose', P, { ...valores, title: titulo }, yo, ahora());
    return [
      'propuesta: ' + corto(propuesta.id) + ' «' + cero(propuesta) + '» en la fábrica de ' + etiquetaDe(eje, P) + ' · por ' + yo.nombre,
      'estado: ' + aceptacionDe(eje, propuesta),
      ...(await subirLoEscrito(ctx)),
    ];
  },
};

/** Ejecuta una orden y devuelve el texto (lanza ErrorBe con el motivo). Exportada para usarla sin proceso hijo. */
export async function ejecutar(argv, entorno = process.env) {
  const { orden, pos, f } = argumentos(argv);
  if (!orden || orden === 'ayuda' || f.ayuda) return AYUDA;
  if (!ORDENES.includes(orden)) throw new ErrorBe('orden desconocida: «' + orden + '»\n' + AYUDA);
  const cfg = configuracion(f, entorno);
  // Las claves de Core se crean antes de abrir el eje: sin red también se crean, y la petición se hace después.
  const previas = orden === 'identidad' && f.crear ? await crearIdentidad(cfg, f) : [];
  let abierto;
  try {
    abierto = await abrir(cfg, entorno);
  } catch (e) {
    if (!previas.length || !(e instanceof ErrorBe)) throw e;
    return [...previas, 'no se pudo abrir el eje para hacer la petición: ' + e.message, 'cuando se pueda: node be.mjs identidad --pedir'].join('\n');
  }
  const lineas = await ordenesDe[orden]({ ...abierto, cfg, pos, f });
  if (orden === 'opiniones') guardarCache(abierto.ruta, abierto.cache);
  const texto = [...previas, ...(Array.isArray(lineas) ? lineas : [lineas])].join('\n');
  return abierto.avisos.length ? abierto.avisos.map((a) => '(' + a + ')').join('\n') + '\n' + texto : texto;
}

const esPrincipal = process.argv[1] && existsSync(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (esPrincipal) {
  try {
    console.log(await ejecutar(process.argv.slice(2)));
  } catch (e) {
    console.error(e instanceof ErrorBe ? e.message : 'error: ' + (e?.stack ?? e));
    process.exitCode = 1;
  }
}
