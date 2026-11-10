#!/usr/bin/env node
// Be: el mando de Core, solo lectura (docs/CONTRATO.md §17). Core (una IA desde la línea de comandos) lee el eje
// compartido de VG sin la pantalla: el modo «Be» de la tabla de interacciones («nombrarlo», «desde el PV…», «siguiente»).
//
//   node be.mjs <orden> [argumentos] [--config <ruta>] [--como <identidad>]
//
// La configuración es un JSON FUERA del repositorio ({ sync_url, eje, clave_lectura }; también url/claveLectura), con
// --config o la variable AGRAM_BE_CONFIG. La caché del eje, en ~/.agram/be/<eje>.json (AGRAM_BE_CACHE cambia la carpeta).
// Nada de eso entra en el repositorio. Esta versión no escribe.

import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sincronia, persistencia, contrato, acciones, leer, leerEvento } from './src/index.js';
import { pintarPara } from './carta/texto.js';
import * as guia from './carta/guia.js';

const ORDENES = ['estado', 'ver', 'camino', 'aro', 'diario', 'opiniones', 'contexto', 'buscar'];
const AYUDA = `uso: node be.mjs <orden> [argumentos] [--config <ruta>] [--como <identidad>]
  estado                            el eje, cuántos registros, el último orden, las identidades
  ver <X>                           lectura, madurez y carta de texto de X (id, 8+ caracteres o su 0)
  camino <X>                        los pasos del camino de X para --como
  aro <X>                           las acciones por punto de vista de X para --como
  diario [--desde n] [--cuantos n]  las últimas entradas leídas, por llegada
  opiniones [proyecto] [--nuevas]   las opiniones ancladas en el proyecto (por defecto AGRAM)
  contexto <X> [--tope n]           el contexto que la guía manda a la IA
  buscar <texto>                    registros cuyo 0 o lectura lo contienen
configuración: JSON fuera del repo con { "sync_url", "eje", "clave_lectura" } (--config o AGRAM_BE_CONFIG)`;

class ErrorBe extends Error {}

// ---------- argumentos y configuración ----------

function argumentos(lista) {
  const pos = [];
  const f = {};
  for (let i = 0; i < lista.length; i++) {
    const a = lista[i];
    if (a === '--nuevas') f.nuevas = true;
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
  return { url: url.replace(/\/+$/, ''), eje: c.eje, claveLectura };
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
};

/** Ejecuta una orden y devuelve el texto (lanza ErrorBe con el motivo). Exportada para usarla sin proceso hijo. */
export async function ejecutar(argv, entorno = process.env) {
  const { orden, pos, f } = argumentos(argv);
  if (!orden || orden === 'ayuda') return AYUDA;
  if (!ORDENES.includes(orden)) throw new ErrorBe('orden desconocida: «' + orden + '»\n' + AYUDA);
  const cfg = configuracion(f, entorno);
  const abierto = await abrir(cfg, entorno);
  const lineas = await ordenesDe[orden]({ ...abierto, cfg, pos, f });
  if (orden === 'opiniones') guardarCache(abierto.ruta, abierto.cache);
  const texto = (Array.isArray(lineas) ? lineas : [lineas]).join('\n');
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
