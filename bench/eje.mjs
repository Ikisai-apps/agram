// Banco de rendimiento del núcleo de AGRAM. Sin dependencias: Node y el
// propio núcleo. Construye ejes de 1.000, 5.000 y 20.000 registros con un
// generador con semilla (identidades con y sin clave, escritos sobre focos al
// azar con colisiones, referencias, fórmulas BQL y ciclos del motor) y mide
// lo que cuesta escribir, validar, leer y guardar a cada tamaño. Las bases
// del 8 (src/bases.js, de la PR #44, en main desde la #55) se miden si el
// módulo tiene esa API (calcularBase, escribirBase, situar); si no, se saltan.
//
// Uso (desde la raíz):
//   npm run bench
//   node bench/eje.mjs --tamanos 1000,5000 --semilla 7 --json salida.json
//   node bench/eje.mjs --solo bases,confluir   (construir va siempre)
//
// No escribe nada en el repositorio. La tabla sale por la salida estándar en
// Markdown; docs/notas/RENDIMIENTO.md recoge una pasada comentada.
// Las claves ECDSA salen de Web Crypto (no de la semilla): los ids cambian
// de una pasada a otra, la forma del eje no.

import { pathToFileURL } from 'node:url';
import { Eje } from '../src/eje.js';
import { generarClaves, firmar, verificar } from '../src/autoridad.js';
import { crearEvento, verificarId } from '../src/evento.js';
import { direccion } from '../src/btml.js';
import { contarPosiciones } from '../src/modos.js';
import { ocupantes, arbol } from '../src/encaje.js';
import { consultar, evaluar, esFormula } from '../src/bql.js';
import { serializar, restaurar } from '../src/persistencia.js';
import { mapa } from '../src/mapped.js';
import { ejeTemporal, confluir } from '../src/tiempo.js';
import { medir } from '../src/bases.js'; // la única medida del 8 (tiempo.medidasDe se retira: VG, 7-11 noche)
import { consolidar, autorizar, ejecutar, liberar, pesoAutorizacion } from '../src/motor.js';

// ---------- argumentos ----------

/** Secciones que se pueden pedir con --solo (construir va siempre). */
const SECCIONES = ['validar', 'ocupantes', 'bql', 'confluir', 'bases', 'persistencia', 'escribir'];

function argumentos(argv) {
  const a = { tamanos: [1000, 5000, 20000], semilla: 20261107, json: null, solo: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--tamanos') a.tamanos = argv[++i].split(',').map((x) => Number(x.replace(/[._]/g, '')));
    else if (k === '--semilla') a.semilla = Number(argv[++i]);
    else if (k === '--json') a.json = argv[++i];
    else if (k === '--solo') a.solo = argv[++i].split(',');
    else throw new Error('argumento desconocido: ' + k + ' (--tamanos 1000,5000 --semilla N --json fichero --solo ' + SECCIONES.join(',') + ')');
  }
  if (!a.tamanos.every((n) => Number.isInteger(n) && n >= 100)) throw new Error('--tamanos: enteros ≥ 100');
  if (!Number.isInteger(a.semilla)) throw new Error('--semilla: un entero');
  if (a.solo && !a.solo.every((x) => SECCIONES.includes(x))) throw new Error('--solo: secciones de ' + SECCIONES.join(', '));
  return a;
}

// ---------- azar con semilla ----------

function mulberry32(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Azar {
  constructor(semilla) { this.r = mulberry32(semilla); }
  num() { return this.r(); }
  ent(n) { return Math.floor(this.r() * n); }
  de(lista) { return lista[this.ent(lista.length)]; }
  prob(p) { return this.r() < p; }
  /** Índice según pesos. */
  pesado(pesos) {
    const total = pesos.reduce((s, p) => s + p, 0);
    let x = this.r() * total;
    for (let i = 0; i < pesos.length; i++) if ((x -= pesos[i]) < 0) return i;
    return pesos.length - 1;
  }
}

// ---------- medir ----------

const ahoraMs = () => performance.now();

/** Ejecuta fn (síncrona o asíncrona) varias veces: al menos `min`, hasta `presupuesto` ms. Devuelve { mediana, media, n, ultimo }. */
async function cronometrar(fn, { min = 3, max = 200, presupuesto = 300 } = {}) {
  const tiempos = [];
  let ultimo;
  const inicio = ahoraMs();
  while (tiempos.length < min || (tiempos.length < max && ahoraMs() - inicio < presupuesto)) {
    const a = ahoraMs();
    ultimo = await fn();
    tiempos.push(ahoraMs() - a);
  }
  tiempos.sort((x, y) => x - y);
  return { mediana: tiempos[Math.floor(tiempos.length / 2)], media: tiempos.reduce((s, x) => s + x, 0) / tiempos.length, n: tiempos.length, ultimo };
}

/** Una sola vez (lo caro). */
async function unaVez(fn) {
  const a = ahoraMs();
  const ultimo = await fn();
  const ms = ahoraMs() - a;
  return { mediana: ms, media: ms, n: 1, ultimo };
}

/**
 * Milisegundos por elemento de recorrer una lista con fn (síncrona o
 * asíncrona): la mediana, que aguanta mejor una máquina compartida que la
 * media (la media va en la nota de quien la pida).
 */
async function porElemento(lista, fn) {
  const tiempos = [];
  for (const x of lista) {
    const a = ahoraMs();
    await fn(x);
    tiempos.push(ahoraMs() - a);
  }
  tiempos.sort((x, y) => x - y);
  return tiempos.length ? tiempos[Math.floor(tiempos.length / 2)] : null;
}

// ---------- generador del eje ----------

const T0 = Date.parse('2026-01-01T00:00:00Z');
const MINUTO = 60_000;
const DIA = 86_400_000;
const GENESIS = 'g0';
const PALABRAS = ['rojo', 'azul', 'sin humo', 'con desayuno', 'jardín', 'cocina', 'reino', 'cielo', 'camino', 'plaza'];
/** Pesos de las diez posiciones al anclar un escrito (1–4 y 7 más usadas). */
const PESOS_PV = [1, 4, 3, 2, 3, 1, 1, 2, 1, 1];

/**
 * Construye un eje de `n` registros. Devuelve el eje, lo necesario para
 * seguir escribiendo (claves privadas, escritores) y lo medido al construir.
 * Forma del eje: génesis; un proyecto por cada ~3·√n registros, cada uno con
 * su cosa con clave (la identidad que escribe su base del 8); identidades
 * (n/40, personas: viven de su asignación de T del día; el 85 % con clave; el 20 % con P para
 * autorizar); y el resto, escritos sobre focos al azar (6 % sobre una «plaza»
 * donde todo colisiona, 12 % sobre otros focos calientes, 37 % sobre lo
 * reciente, el resto uniforme) con referencias, fórmulas BQL y, un 3 % de
 * las veces, un ciclo del motor (consolidar → autorizar → ejecutar).
 */
async function construir(n, semilla) {
  const az = new Azar(semilla);
  const privadas = new Map(); // identidad → CryptoKey privada
  const fases = new Map(); // tipo → { n, total, crear, firmar, anadir }
  let paso = 0;
  // Un evento no puede ser anterior a su foco (src/ciclo.js): con fecha futura, el t no baja del de los focos que se le pasan.
  const instante = (...focos) => {
    paso++;
    const t = T0 + paso * MINUTO;
    const suelo = Math.max(0, ...focos.map((f) => Date.parse(eje.obtener(f)?.t) || 0));
    return new Date(Math.max(suelo, az.prob(0.05) ? t + 30 * DIA : t)).toISOString(); // un 5 % con fecha futura: proyecciones
  };
  const anotar = (tipo, total, crear = 0, firma = 0, anadir = 0) => {
    const f = fases.get(tipo) ?? { n: 0, total: 0, crear: 0, firmar: 0, anadir: 0 };
    f.n++; f.total += total; f.crear += crear; f.firmar += firma; f.anadir += anadir;
    fases.set(tipo, f);
  };

  const inicio = ahoraMs();
  const claveG = await generarClaves();
  privadas.set(GENESIS, claveG.privada);
  const eje = await Eje.genesis({
    demostracion: true,
    identidad: GENESIS,
    tipo: 'persona',
    emision: [
      { token: 'E', denominacion: 'EUR', cantidad: 1e12 },
      { token: 'P', ambito: 'genesis', cantidad: 1e6 },
    ],
    foco: ['Banco de rendimiento', ['recursos', 10, '5 EUR'], ['criterio', '=CONTAR(BUSCAR("1000000000"))'], 'comunicación', '=CONTAR(BUSCAR(4))'],
    t: new Date(T0).toISOString(),
    clave: claveG.publica,
    privada: claveG.privada,
  });
  const g = eje.genesisId;

  /** Crea, firma (si la identidad tiene clave) y añade, midiendo cada fase. */
  async function escribir(tipo, datos) {
    const priv = privadas.get(datos.autor);
    const a = ahoraMs();
    let ev = await crearEvento(datos);
    const b = ahoraMs();
    if (priv) ev = await firmar(ev, priv);
    const c = ahoraMs();
    const guardado = await eje.anadir(ev);
    const d = ahoraMs();
    anotar(tipo + (priv ? ' firmado' : ' sin firma'), d - a, b - a, c - b, d - c);
    return guardado;
  }

  // Altas: proyectos (una cosa con clave cada uno) y personas, de cinco en cinco.
  const nProyectos = Math.max(3, Math.round(Math.sqrt(n) / 3));
  const nIdentidades = Math.max(12, Math.round(n / 40));
  const escritores = [GENESIS];
  const autorizadores = [GENESIS];
  const proyectos = []; // { id, identidad }
  // Ningún T se acumula (VG, 8-11: no hay T acumulable; el génesis no emite T): en el banco, quienes escriben son
  // personas, cada una con su asignación del día; la raíz solo les da euros.
  const dotacion = (a) => [
    { token: 'E', emisor: GENESIS, denominacion: 'EUR', cantidad: 1e6, de: GENESIS, a },
  ];
  for (let k = 0; k < nProyectos; k++) {
    const id = 'proy' + k;
    const par = await generarClaves();
    privadas.set(id, par.privada);
    const ev = await escribir('alta', {
      autor: GENESIS, sobre: g, t: instante(g),
      // La cosa del proyecto (la identidad propia que escribe su base: src/bases.js) no tiene asignación: la raíz le da
      // unos minutos de la suya (Core, 8-11), que conserva hasta gastarlos, y no escribe nada más.
      movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: GENESIS, a: null }, { token: 'T', escala: 'minuto', cantidad: 5, de: GENESIS, a: id }, ...dotacion(id)], // escribir consume T
      payload: ['Proyecto ' + k, ['recursos', az.ent(100), (1 + az.ent(90)) + ' EUR'], ['criterios', az.de(PALABRAS)], 'comunicación', '=CONTAR(BUSCAR(4))'],
      contexto: { tipos: { [id]: 'cosa' }, claves: { [id]: par.publica } },
    });
    proyectos.push({ id: ev.id, identidad: id });
  }
  for (let k = 0; k < nIdentidades; k += 5) {
    const tipos = {};
    const claves = {};
    const movimientos = [{ token: 'T', escala: 'minuto', cantidad: 1, de: GENESIS, a: null }]; // escribir consume T
    const nombres = [];
    for (let j = k; j < Math.min(k + 5, nIdentidades); j++) {
      const id = 'p' + j;
      tipos[id] = 'persona';
      if (az.prob(0.85)) {
        const par = await generarClaves();
        privadas.set(id, par.privada);
        claves[id] = par.publica;
      }
      movimientos.push(...dotacion(id));
      if (az.prob(0.2)) { movimientos.push({ token: 'P', ambito: 'genesis', cantidad: 10, de: GENESIS, a: id }); autorizadores.push(id); }
      nombres.push(id);
      escritores.push(id);
    }
    await escribir('alta', { autor: GENESIS, sobre: g, t: instante(g), movimientos, payload: ['Altas', nombres], contexto: { tipos, ...(Object.keys(claves).length ? { claves } : {}) } });
  }

  // Focos calientes: el primer proyecto es la «plaza» donde todo colisiona.
  const superCaliente = proyectos[0].id;
  const calientes = [g, ...proyectos.slice(0, 4).map((p) => p.id)];

  const elegirFoco = () => {
    const r = az.num();
    const ids = eje.orden;
    if (r < 0.06) return superCaliente;
    if (r < 0.18) return az.de(calientes);
    if (r < 0.55) return ids[ids.length - 1 - az.ent(Math.min(60, ids.length))]; // localidad: lo reciente
    return az.de(ids);
  };
  const elegirEn = (sobre) => {
    if (sobre === superCaliente && az.prob(0.6)) return '1000000000';
    const r = az.num();
    if (r < 0.7) return direccion([az.pesado(PESOS_PV)]);
    if (r < 0.9) return direccion([az.pesado(PESOS_PV), az.ent(10)]);
    return '0000000000';
  };
  const dirDentro = (payload) => {
    const ind = [];
    let nodo = payload;
    while (Array.isArray(nodo) && ind.length < 4 && az.prob(0.6)) {
      const i = az.ent(nodo.length);
      ind.push(i);
      nodo = nodo[i];
    }
    return direccion(ind);
  };
  const referencia = () => {
    const ids = eje.orden;
    const id = az.prob(0.5) ? ids[ids.length - 1 - az.ent(Math.min(200, ids.length))] : az.de(ids);
    return az.prob(0.5) ? { ref: id } : { ref: id, dir: dirDentro(eje.obtener(id).payload) };
  };
  const FORMULAS = [
    () => '=LOCAL(' + (1 + az.ent(9)) + ') + 1',
    () => '=CONTAR(BUSCAR(' + az.ent(10) + '))',
    () => '=CONTAR(BUSCAR("' + direccion([1 + az.ent(9)]) + '"))',
    () => '=SUMAR(FILTRAR(BUSCAR(' + (1 + az.ent(9)) + '), ORIGEN() = "escrito"))',
    () => '=CONTAR(FILTRAR(BUSCAR("' + direccion([1 + az.ent(9)]) + '"), ACUERDO() = 10))',
    () => '=ELEGIR(ORDENAR(BUSCAR(' + az.ent(10) + '), DESPLAZAMIENTO()), 1)',
    () => '=REF("' + az.de(eje.orden).slice(0, 8) + '")',
    () => '=' + (1 + az.ent(50)) + ' EUR + ' + (1 + az.ent(50)) + ' EUR',
  ];
  const contenido = (prof) => {
    const r = az.num();
    if (r < 0.28) return az.ent(1000);
    if (r < 0.42) return (1 + az.ent(99)) + ' EUR';
    if (r < 0.52) return az.de(PALABRAS);
    if (r < 0.70) return referencia();
    if (r < 0.82) return az.de(FORMULAS)();
    return prof < 3 ? payload(prof) : az.ent(100);
  };
  const payload = (prof = 0) => {
    if (prof === 0 && az.prob(0.15)) return az.prob(0.5) ? az.de(PALABRAS) : az.de(FORMULAS)();
    const largo = 1 + az.ent(prof === 0 ? 10 : 5);
    const p = ['r' + paso + (prof ? '·' + prof : '')];
    for (let i = 1; i < largo; i++) p.push(contenido(prof + 1));
    return p;
  };

  // El ciclo del motor: consolidar → autorizar → ejecutar, cada uno un registro.
  let ciclos = 0;
  async function cicloMotor() {
    const foco = elegirFoco();
    const autor = az.de(escritores);
    const elecciones = { 1: referencia(), 2: az.de(PALABRAS) };
    if (az.prob(0.5)) elecciones[3] = referencia();
    let a = ahoraMs();
    const c = await consolidar(eje, { autor, foco, elecciones, t: instante(foco) }, privadas.get(autor));
    anotar('motor: consolidar', ahoraMs() - a);
    ciclos++;
    if (eje.orden.length >= n || !az.prob(0.8)) return;
    // Autorizar es bloquear P sobre el registro del recurso hasta el umbral (VG, 7-11 noche): aquí las raíces no
    // emiten P propio, así que cuenta el P del eje, y la mayoría la tiene el génesis. Bloquea lo justo para pasar
    // de la mitad y, ejecutada o no, lo libera: así sigue teniendo P para la siguiente.
    const autorizante = GENESIS;
    const { emitido } = pesoAutorizacion(eje, c.id);
    a = ahoraMs();
    await autorizar(eje, { autorizante, consolidacion: c.id, cantidad: Math.floor(emitido / 2) + 1, t: instante(foco, c.id) }, privadas.get(autorizante));
    anotar('motor: autorizar', ahoraMs() - a);
    if (eje.orden.length < n && az.prob(0.7)) {
      a = ahoraMs();
      await ejecutar(eje, { autor, consolidacion: c.id, t: instante(foco, c.id), movimientos: [{ token: 'E', emisor: GENESIS, denominacion: 'EUR', cantidad: 5, de: autor, a: az.de(escritores) }] }, privadas.get(autor));
      anotar('motor: ejecutar', ahoraMs() - a);
    }
    a = ahoraMs();
    await liberar(eje, { titular: autorizante, consolidacion: c.id, t: instante(foco, c.id) }, privadas.get(autorizante));
    anotar('motor: liberar', ahoraMs() - a);
  }

  while (eje.orden.length < n) {
    if (az.prob(0.03)) { await cicloMotor(); continue; }
    const sobre = elegirFoco();
    const autor = az.de(escritores);
    const p = payload();
    const movimientos = [{ token: 'T', escala: 'minuto', cantidad: contarPosiciones(p), de: autor, a: null }];
    if (az.prob(0.1)) movimientos.push({ token: 'E', emisor: GENESIS, denominacion: 'EUR', cantidad: 1 + az.ent(20), de: autor, a: az.de(escritores) });
    await escribir('escrito', { autor, sobre, en: elegirEn(sobre), t: instante(sobre), movimientos, payload: p });
  }

  return { eje, az, privadas, escritores, autorizadores, proyectos, superCaliente, ciclos, fases, instante, msConstruir: ahoraMs() - inicio };
}

// ---------- focos de referencia ----------

/** génesis; caliente (más hijos); mediano (mediana de hijos entre los que tienen); hoja (al azar, sin hijos); profundo (hilo más largo). */
function elegirFocos(eje, az) {
  let caliente = null;
  let max = -1;
  const conHijos = [];
  const hojas = [];
  let profundo = eje.genesisId;
  let hondura = 0;
  const alturas = new Map();
  for (const id of eje.orden) {
    const ev = eje.obtener(id);
    const h = ev.sobre === null ? 0 : alturas.get(ev.sobre) + 1;
    alturas.set(id, h);
    if (h > hondura) { hondura = h; profundo = id; }
    const k = eje.sobre(id).length;
    if (k > max) { max = k; caliente = id; }
    if (k > 0) conHijos.push([k, id]);
    else hojas.push(id);
  }
  conHijos.sort((a, b) => a[0] - b[0]);
  const mediano = conHijos[Math.floor(conHijos.length / 2)][1];
  return { 'génesis': eje.genesisId, caliente, mediano, hoja: az.de(hojas), profundo };
}

// ---------- una pasada a un tamaño ----------

async function pasada(n, semilla, solo = null) {
  const r = { n, filas: [] };
  const quiere = (seccion) => !solo || solo.includes(seccion);
  const fila = (seccion, nombre, valor, nota = '') => r.filas.push({ seccion, nombre, valor, nota });
  const log = (x) => process.stderr.write(x + '\n');

  log('— ' + n + ' registros: construyendo…');
  const b = await construir(n, semilla);
  const { eje, az } = b;
  r.heapMB = process.memoryUsage().heapUsed / 1048576;
  fila('construir', 'construir el eje entero (ms)', b.msConstruir, eje.orden.length + ' registros; ' + b.ciclos + ' ciclos del motor');
  fila('construir', 'escribir: ms por registro (media de la construcción)', b.msConstruir / eje.orden.length);
  for (const [tipo, f] of [...b.fases.entries()].sort()) {
    const desglose = f.crear ? ' (crear ' + fmt(f.crear / f.n) + ' · firmar ' + fmt(f.firmar / f.n) + ' · añadir ' + fmt(f.anadir / f.n) + ')' : '';
    fila('construir', tipo + ' (ms/registro)', f.total / f.n, f.n + ' registros' + desglose);
  }

  const focos = elegirFocos(eje, az);
  r.focos = Object.fromEntries(Object.entries(focos).map(([k, v]) => [k, { id: v.slice(0, 8), hijos: eje.sobre(v).length, hilo: eje.hilo(v).length }]));
  log('  focos: ' + Object.entries(r.focos).map(([k, v]) => k + ' ' + v.hijos + ' hijos').join(', '));

  // Validar con firmas: eventos listos para añadir que todavía no se añaden.
  const conClave = b.escritores.filter((x) => b.privadas.has(x));
  const sinClave = b.escritores.filter((x) => !b.privadas.has(x));
  const preparar = async (autores, cuantos) => {
    const lista = [];
    for (let k = 0; k < cuantos && autores.length; k++) {
      const autor = autores[k % autores.length];
      const sobre = az.de(eje.orden);
      let ev = await crearEvento({ autor, sobre, en: direccion([1 + az.ent(9)]), t: b.instante(sobre), movimientos: [{ token: 'T', escala: 'minuto', cantidad: 3, de: autor, a: null }], payload: ['banco', az.ent(1000), { ref: az.de(eje.orden) }] });
      if (b.privadas.has(autor)) ev = await firmar(ev, b.privadas.get(autor));
      lista.push(ev);
    }
    return lista;
  };
  const firmados = await preparar(conClave, 200);
  const sinFirma = await preparar(sinClave, 200);
  for (const ev of [...firmados, ...sinFirma]) {
    const e = await eje.validar(ev);
    if (e.length) throw new Error('banco: evento preparado no válido: ' + e.join('; '));
  }
  if (quiere('validar')) {
  fila('validar', 'validar firmado (ms/evento)', await porElemento(firmados, (ev) => eje.validar(ev)), firmados.length + ' eventos');
  if (sinFirma.length) fila('validar', 'validar sin firma (ms/evento)', await porElemento(sinFirma, (ev) => eje.validar(ev)), sinFirma.length + ' eventos');
  fila('validar', '· verificarId: canónico + SHA-256 (ms/evento)', await porElemento(firmados, (ev) => verificarId(ev)));
  fila('validar', '· verificar la firma, importando la clave (ms/evento)', await porElemento(firmados, (ev) => verificar(ev, eje.clave(ev.autor))));
  const ECDSA = { name: 'ECDSA', namedCurve: 'P-256' };
  const importadas = new Map();
  for (const ev of firmados) if (!importadas.has(ev.autor)) importadas.set(ev.autor, await crypto.subtle.importKey('jwk', { ...eje.clave(ev.autor), ext: true }, ECDSA, true, ['verify']));
  const aBytes = (hex) => Uint8Array.from(hex.match(/.{2}/g), (h) => parseInt(h, 16));
  const deB64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
  fila('validar', '· solo subtle.verify, con la clave ya importada (ms/evento)', await porElemento(firmados, (ev) => crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, importadas.get(ev.autor), deB64(ev.firma), aBytes(ev.id))));
  fila('validar', '· solo importar la clave pública (ms/evento)', await porElemento(firmados, (ev) => crypto.subtle.importKey('jwk', { ...eje.clave(ev.autor), ext: true }, ECDSA, true, ['verify'])));
  }

  // Ocupantes, árbol, mapa y eje temporal de cada foco.
  const ahora = new Date(T0 + (eje.orden.length + 1) * MINUTO).toISOString();
  if (quiere('ocupantes')) for (const nombre of ['génesis', 'caliente', 'mediano', 'hoja', 'profundo']) {
    const id = focos[nombre];
    const hijos = eje.sobre(id).length;
    let total = 0;
    let mayor = 0;
    const oc = await cronometrar(() => {
      total = 0; mayor = 0;
      for (let i = 0; i < 10; i++) { const k = ocupantes(eje, id, [i]).length; total += k; mayor = Math.max(mayor, k); }
    });
    fila('ocupantes', 'ocupantes de las 10 posiciones · ' + nombre + ' (ms)', oc.mediana, hijos + ' hijos; ' + total + ' ocupantes, ' + mayor + ' en la posición mayor');
    const ar = await cronometrar(() => arbol(eje, id));
    fila('ocupantes', 'arbol · ' + nombre + ' (ms)', ar.mediana, ar.ultimo.size + ' direcciones');
    const ma = await cronometrar(() => mapa(eje, id));
    fila('vistas', 'mapa · ' + nombre + ' (ms)', ma.mediana);
    const et = await cronometrar(() => ejeTemporal(eje, id, { ahora }));
    fila('vistas', 'ejeTemporal · ' + nombre + ' (ms)', et.mediana, r.focos[nombre].hilo + ' en el hilo; ' + et.ultimo.totalPasado + ' pasado, ' + et.ultimo.totalFuturo + ' futuro');
  }

  // BUSCAR / FILTRAR / ORDENAR / REF, consultadas desde la posición 9 del foco.
  if (quiere('bql')) {
  const CONSULTAS = [
    ['BUSCAR dirección, colisión entera', 'CONTAR(BUSCAR("1000000000"))'],
    ['BUSCAR índice, camino exacto', 'CONTAR(BUSCAR(1))'],
    ['FILTRAR por origen', 'CONTAR(FILTRAR(BUSCAR("1000000000"), ORIGEN() = "escrito"))'],
    ['FILTRAR leyendo ACTUAL(0), para en el primero sin 0', 'CONTAR(FILTRAR(BUSCAR("1000000000"), ACTUAL(0) = "x"))'],
    ['ORDENAR + ELEGIR', 'ELEGIR(ORDENAR(BUSCAR("1000000000"), DESPLAZAMIENTO(), "desc"), 3)'],
  ];
  for (const nombre of ['caliente', 'mediano', 'génesis']) {
    const id = focos[nombre];
    for (const [etiqueta, f] of CONSULTAS) {
      const m = await cronometrar(() => consultar(eje, id, [9], f));
      const u = m.ultimo;
      fila('BQL', etiqueta + ' · ' + nombre + ' (ms)', m.mediana, u.estado === 'RESUELTO' ? u.texto.slice(0, 32) : u.estado + (u.parcial ? ' (' + u.parcial.examinados + ' de ' + u.parcial.de + ')' : ''));
    }
  }
  const viejo = eje.orden[Math.floor(eje.orden.length / 3)];
  const ref = await cronometrar(() => consultar(eje, focos.hoja, [1], 'REF("' + viejo.slice(0, 8) + '")'), { min: 20 });
  fila('BQL', 'REF por prefijo de 8 (ms)', ref.mediana, 'un registro de hace un tercio del eje');
  const slots = [];
  const recoger = (id, nodo, ind) => {
    if (Array.isArray(nodo)) nodo.forEach((h, i) => recoger(id, h, [...ind, i]));
    else if (esFormula(nodo)) slots.push([id, ind]);
  };
  for (let k = 0; k < 300; k++) { const id = az.de(eje.orden); recoger(id, eje.obtener(id).payload, []); }
  const estados = {};
  const ev = await unaVez(() => {
    for (const [id, ind] of slots) { const s = evaluar(eje, id, ind).estado; estados[s] = (estados[s] ?? 0) + 1; }
  });
  fila('BQL', 'evaluar una fórmula del eje (ms/fórmula)', ev.mediana / Math.max(1, slots.length), slots.length + ' de 300 registros al azar: ' + Object.entries(estados).map(([k, v]) => k + ' ' + v).join(', '));
  }

  // Confluencia del 8 recalculada al vuelo (confluir: el respaldo declarado de bases.js).
  const hijoCaliente = eje.sobre(b.superCaliente)[0]?.id ?? focos.hoja;
  if (quiere('confluir')) {
  const muestra = Array.from({ length: 200 }, () => az.de(eje.orden));
  fila('confluir', 'medir de un registro (ms)', await porElemento(muestra, (id) => medir(eje, id)), 'mediana de 200 al azar');
  for (const alcance of ['hermanos', 'proyecto', 'general']) {
    log('  confluir ' + alcance + '…');
    const c = await unaVez(() => confluir(eje, hijoCaliente, { alcance }));
    fila('confluir', 'confluir, recalcula · ' + alcance + ' (ms)', c.mediana, c.ultimo.n + ' comparables');
  }
  }

  // Bases del 8 (src/bases.js, de la PR #44): fundir frente a recalcular.
  const bases = quiere('bases') ? await import('../src/bases.js').catch(() => null) : null;
  if (!quiere('bases')) {
    // sin medir: no se pidió
  } else if (bases?.escribirBase && bases?.situar && bases?.calcularBase) {
    log('  bases del 8…');
    const cb = await unaVez(() => bases.calcularBase(eje, b.superCaliente));
    fila('bases', 'calcularBase del proyecto caliente (ms)', cb.mediana, cb.ultimo.hijos.n + ' hijos medidos');
    let escritas = 0;
    const eb = await unaVez(async () => {
      for (const p of b.proyectos) {
        if (!bases.hijos(eje, p.id).length) continue;
        await bases.escribirBase(eje, { registro: p.id, privada: b.privadas.get(p.identidad), t: b.instante(p.id) });
        escritas++;
      }
      await bases.escribirBase(eje, { registro: eje.genesisId, privada: b.privadas.get(GENESIS), t: b.instante(eje.genesisId) });
      escritas++;
    });
    fila('bases', 'escribirBase (ms por base)', eb.mediana / escritas, escritas + ' bases, de abajo arriba: los proyectos y el génesis');
    for (const alcance of ['hermanos', 'proyecto', 'general']) {
      const s = await cronometrar(() => bases.situar(eje, hijoCaliente, { alcance }));
      const conf = await unaVez(() => confluir(eje, hijoCaliente, { alcance }));
      fila('bases', 'situar, lee la base · ' + alcance + ' (ms)', s.mediana, s.ultimo.estado + ', n ' + (s.ultimo.n ?? '—') + '; confluir ' + fmt(conf.mediana) + ' ms con n ' + conf.ultimo.n + ': ×' + fmt(conf.mediana / s.mediana));
    }
    const fu = await cronometrar(() => {
      const base = bases.leerBase(eje, b.superCaliente);
      return bases.fundir(base.hijos, base.subarbol);
    });
    fila('bases', 'leerBase + fundir dos estadísticas (ms)', fu.mediana);
  } else {
    fila('bases', 'bases del 8', null, 'src/bases.js no está o no tiene la API de la #44 (calcularBase, escribirBase, situar): sin medir');
  }

  // Serializar y restaurar (restaurar vuelve a validar cada evento: ids, firmas, saldos).
  if (quiere('persistencia')) {
  log('  persistencia…');
  const se = await cronometrar(() => serializar(eje), { presupuesto: 100 });
  fila('persistencia', 'serializar (ms)', se.mediana);
  let texto;
  const js = await unaVez(() => { texto = JSON.stringify(serializar(eje)); });
  fila('persistencia', 'JSON.stringify (ms)', js.mediana, (texto.length / 1048576).toFixed(1) + ' MB');
  let datos;
  const jp = await unaVez(() => { datos = JSON.parse(texto); });
  fila('persistencia', 'JSON.parse (ms)', jp.mediana);
  const re = await unaVez(() => restaurar(datos));
  fila('persistencia', 'restaurar (ms)', re.mediana, fmt(re.mediana / datos.eventos.length) + ' ms/evento');
  if (re.ultimo.orden.length !== eje.orden.length) throw new Error('banco: restaurar no da el mismo eje');
  }

  // Escribir con el eje ya lleno: los eventos preparados antes, añadidos; y escribir de punta a punta.
  if (!quiere('escribir')) return r;
  fila('escribir', 'añadir firmado con el eje lleno (ms/evento)', await porElemento(firmados, (x) => eje.anadir(x)), firmados.length + ' eventos');
  const nuevos = [];
  for (let k = 0; k < 100; k++) {
    const autor = conClave[k % conClave.length];
    const sobre = az.de(eje.orden);
    nuevos.push({ autor, sobre, en: '1000000000', t: b.instante(sobre), movimientos: [{ token: 'T', escala: 'minuto', cantidad: 3, de: autor, a: null }], payload: ['nuevo', k, '=CONTAR(BUSCAR(1))'] });
  }
  fila('escribir', 'eje.escribir firmado: crear + firmar + añadir (ms/evento)', await porElemento(nuevos, (d) => eje.escribir(d, b.privadas.get(d.autor))), nuevos.length + ' eventos');
  return r;
}

// ---------- salida ----------

function fmt(x) {
  if (x === null || x === undefined || Number.isNaN(x)) return '—';
  if (x < 0.01) return x.toFixed(4);
  if (x < 1) return x.toFixed(3);
  if (x < 10) return x.toFixed(2);
  if (x < 100) return x.toFixed(1);
  return String(Math.round(x));
}

function tabla(pasadas) {
  const cabecera = '| sección | medida | ' + pasadas.map((p) => String(p.n)).join(' | ') + ' | nota (del mayor) |';
  const raya = '|---|---|' + pasadas.map(() => '---:|').join('') + '---|';
  const filas = [];
  for (const p of pasadas) for (const f of p.filas) if (!filas.some((x) => x.nombre === f.nombre)) filas.push(f);
  const lineas = filas.map((f) => {
    const celdas = pasadas.map((p) => fmt(p.filas.find((x) => x.nombre === f.nombre)?.valor));
    const nota = [...pasadas].reverse().map((p) => p.filas.find((x) => x.nombre === f.nombre)?.nota).find(Boolean) ?? '';
    return '| ' + f.seccion + ' | ' + f.nombre + ' | ' + celdas.join(' | ') + ' | ' + nota.replace(/\|/g, '\\|') + ' |';
  });
  return [cabecera, raya, ...lineas].join('\n');
}

// El generador se puede importar (para perfilar una pieza sola); el banco corre solo si se ejecuta este fichero.
export { construir, elegirFocos, Azar };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const opciones = argumentos(process.argv.slice(2));
  const pasadas = [];
  for (const n of opciones.tamanos) pasadas.push(await pasada(n, opciones.semilla, opciones.solo));
  console.log('Banco del núcleo · semilla ' + opciones.semilla + ' · Node ' + process.version + ' · ' + process.platform + '/' + process.arch);
  for (const p of pasadas) console.log('Focos de ' + p.n + ': ' + Object.entries(p.focos).map(([k, v]) => k + ' ' + v.hijos + ' hijos, hilo ' + v.hilo).join('; ') + '. Memoria tras construir: ' + p.heapMB.toFixed(0) + ' MB.');
  console.log('');
  console.log(tabla(pasadas));
  if (opciones.json) {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(opciones.json, JSON.stringify({ semilla: opciones.semilla, node: process.version, pasadas }, null, 2));
  }
}
